import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CreateStudentDto } from './dto/create-student.dto';
import { Student, StudentDocument } from './schemas/student.schema';
import { isValidObjectId } from 'mongoose';
import type { Model, QueryFilter } from 'mongoose';
import { ListStudentsQueryDto } from './dto/list-students-query.dto';
import { UpdateStudentArrangementDto } from './dto/update-student-arrangement.dto';
import {
  AttachmentType,
  FormSubmissionStatus,
  OnboardingStatus,
} from './enums/student.enums';
import { BatchUpdateStudentArrangementDto } from './dto/batch-update-student-arrangement.dto';
import { SubmitStudentFormDto } from './dto/submit-student-form.dto';
import { UpdateStudentProfileDto } from '../hr/dto/update-student-profile.dto';
import { normalizeUploadedFileName } from '../file/filename/normalize-uploaded-file-name';

interface AttachmentMetadataInput {
  type: AttachmentType;
  originalName: string;
  storageKey: string;
}

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

  constructor(
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
  ) {}

  async findByLoginIdentity(name: string, email: string) {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // Students can only log in through records previously created by HR.
    return this.studentModel
      .findOne({
        name: normalizedName,
        email: normalizedEmail,
        isDeleted: false,
      })
      .exec();
  }

  async ensureStudentExistsIncludingDeleted(id: string): Promise<void> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    const exists = await this.studentModel.exists({ _id: id });

    if (!exists) {
      throw new NotFoundException('学生不存在');
    }
  }

  async findAll(query: ListStudentsQueryDto) {
    // MVP 阶段由 HR 列表请求触发到期状态更新；未来定时任务可复用同一方法。
    await this.updateDueOnboardingStatuses();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // Soft-deleted students must not appear in the normal HR list.
    const filter: QueryFilter<Student> = {
      isDeleted: false,
    };

    const keyword = query.keyword?.trim();

    if (keyword) {
      // Escape special regex characters entered by the user.
      const safeKeyword = this.escapeRegex(keyword);

      filter.$or = [
        { name: { $regex: safeKeyword, $options: 'i' } },
        { email: { $regex: safeKeyword, $options: 'i' } },
        { phone: { $regex: safeKeyword, $options: 'i' } },
        { 'basicInfo.currentSchool': { $regex: safeKeyword, $options: 'i' } },
        {
          'educationExperiences.school': { $regex: safeKeyword, $options: 'i' },
        },
      ];
    }

    if (query.status) {
      filter.onboardingStatus = query.status;
    }

    if (query.workLocation) {
      filter.workLocation = query.workLocation;
    }

    if (query.formStatus === FormSubmissionStatus.Submitted) {
      filter.submittedAt = { $ne: null };
    } else if (query.formStatus === FormSubmissionStatus.NotSubmitted) {
      filter.submittedAt = null;
    }

    // 列表总数受筛选条件影响，顶部统计始终基于全部有效学生。
    const [students, total, all, notSubmitted, pendingOnboarding, onboarded] =
      await Promise.all([
        this.studentModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .exec(),
        this.studentModel.countDocuments(filter).exec(),
        this.studentModel.countDocuments({ isDeleted: false }).exec(),
        this.studentModel
          .countDocuments({ isDeleted: false, submittedAt: null })
          .exec(),
        this.studentModel
          .countDocuments({
            isDeleted: false,
            onboardingStatus: OnboardingStatus.PendingOnboarding,
          })
          .exec(),
        this.studentModel
          .countDocuments({
            isDeleted: false,
            onboardingStatus: OnboardingStatus.Onboarded,
          })
          .exec(),
      ]);

    return {
      items: students.map((student) => ({
        id: student._id.toString(),
        name: student.name,
        email: student.email,
        phone: student.phone ?? null,
        onboardingStatus: student.onboardingStatus,
        workLocation: student.workLocation ?? null,
        onboardingStartAt: student.onboardingStartAt ?? null,
        onboardingEndAt: student.onboardingEndAt ?? null,
        submittedAt: student.submittedAt ?? null,
        createdAt: student.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        all,
        notSubmitted,
        pendingOnboarding,
        onboarded,
      },
    };
  }

  async updateDueOnboardingStatuses(referenceDate = new Date()) {
    const chinaTodayStart = this.getChinaTodayStart(referenceDate);
    const chinaTomorrowStart = new Date(
      chinaTodayStart.getTime() + 24 * 60 * 60 * 1000,
    );

    const result = await this.studentModel
      .updateMany(
        {
          isDeleted: false,
          onboardingStatus: OnboardingStatus.PendingOnboarding,
          // 使用次日零点作为上界，兼容仍保存了具体时间的旧测试数据。
          onboardingStartAt: { $ne: null, $lt: chinaTomorrowStart },
        },
        {
          $set: {
            onboardingStatus: OnboardingStatus.Onboarded,
          },
        },
        {
          runValidators: true,
        },
      )
      .exec();

    if (result.modifiedCount > 0) {
      this.logger.log(
        `Automatically marked ${result.modifiedCount} students as onboarded`,
      );
    }

    return {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      effectiveDate: chinaTodayStart,
    };
  }

  async ensureFormIsEditable(id: string): Promise<StudentDocument> {
    const student = await this.findActiveStudentById(id);

    // submittedAt 一旦有值，学生端不允许再次修改任何登记内容。
    if (student.submittedAt) {
      throw new ConflictException('登记表已经提交，不能重复提交或修改');
    }

    return student;
  }

  async addAttachmentMetadata(id: string, attachment: AttachmentMetadataInput) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    const updatedStudent = await this.studentModel
      .findOneAndUpdate(
        {
          _id: id,
          isDeleted: false,

          // 学生提交登记表后，不能继续往附件数组中添加内容。
          submittedAt: null,
        },
        {
          $push: {
            attachments: attachment,
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      )
      .exec();

    if (!updatedStudent) {
      // 给已删除、已提交等情况返回更明确的业务错误。
      await this.ensureFormIsEditable(id);

      throw new ConflictException('附件保存状态发生变化，请重试');
    }

    this.logger.log(`Student ${id} added attachment ${attachment.storageKey}`);

    // 只返回 mentor 确认需要保存的三个字段。
    return {
      type: attachment.type,
      originalName: normalizeUploadedFileName(attachment.originalName),
      storageKey: attachment.storageKey,
    };
  }

  async addAttachmentMetadataByHr(
    id: string,
    attachment: AttachmentMetadataInput,
  ) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    const updatedStudent = await this.studentModel
      .findOneAndUpdate(
        {
          _id: id,
          isDeleted: false,

          // 这里故意不检查 submittedAt 和 onboardingStatus。
          // HR 可以为已提交、已入职学生补充或更正附件。
        },
        {
          $push: {
            attachments: attachment,
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      )
      .exec();

    if (!updatedStudent) {
      throw new NotFoundException('学生不存在或已删除');
    }

    return {
      type: attachment.type,
      originalName: attachment.originalName,
      storageKey: attachment.storageKey,
    };
  }

  async removeAttachmentMetadata(id: string, storageKey: string) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    const normalizedStorageKey = storageKey.trim();

    const studentBeforeUpdate = await this.studentModel
      .findOneAndUpdate(
        {
          _id: id,
          isDeleted: false,
          submittedAt: null,

          // 确保该附件确实属于当前学生。
          'attachments.storageKey': normalizedStorageKey,
        },
        {
          $pull: {
            attachments: {
              storageKey: normalizedStorageKey,
            },
          },
        },
        {
          // 返回删除前的记录，以便取得附件的三个元数据字段。
          returnDocument: 'before',
        },
      )
      .exec();

    if (!studentBeforeUpdate) {
      // 先判断学生是否已删除或已提交。
      await this.ensureFormIsEditable(id);

      // 学生仍可编辑时，说明 storageKey 不属于该学生。
      throw new NotFoundException('附件不存在');
    }

    const attachment = studentBeforeUpdate.attachments.find(
      (item) => item.storageKey === normalizedStorageKey,
    );

    if (!attachment) {
      throw new NotFoundException('附件不存在');
    }

    this.logger.log(`Student ${id} removed attachment ${normalizedStorageKey}`);

    return {
      type: attachment.type,
      originalName: attachment.originalName,
      storageKey: attachment.storageKey,
    };
  }

  async findOneById(id: string) {
    // Reuse the shared lookup to validate the ID and exclude deleted students.
    const student = await this.findActiveStudentById(id);
    const hasSubmitted = Boolean(student.submittedAt);

    return {
      id: student._id.toString(),

      name: student.name,
      email: student.email,
      phone: student.phone ?? null,
      onboardingStatus: student.onboardingStatus,

      basicInfo: student.basicInfo ?? null,
      educationExperiences: student.educationExperiences,
      familyMembers: student.familyMembers,
      internshipExperiences: student.internshipExperiences,

      emergencyContactName: student.emergencyContactName ?? null,
      emergencyContactPhone: student.emergencyContactPhone ?? null,
      emergencyContactRelation: student.emergencyContactRelation ?? null,

      hasIdCopyAndAgreement: student.hasIdCopyAndAgreement ?? null,
      agreementSignedAt: student.agreementSignedAt ?? null,
      notes: student.notes ?? null,
      applicantSignature: student.applicantSignature ?? null,
      applicantSignedAt: student.applicantSignedAt ?? null,

      // Only return file metadata. File download will use a separate API later.
      attachments: student.attachments.map((attachment) => ({
        type: attachment.type,
        originalName: normalizeUploadedFileName(attachment.originalName),
        storageKey: attachment.storageKey,
      })),

      workLocation: student.workLocation ?? null,
      onboardingStartAt: student.onboardingStartAt ?? null,
      onboardingEndAt: student.onboardingEndAt ?? null,
      submittedAt: student.submittedAt ?? null,
      // 前端根据这两个字段显示可编辑表单或只读页面。
      hasSubmitted,
      canEdit: !hasSubmitted,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
    };
  }

  async submitForm(id: string, dto: SubmitStudentFormDto) {
    // 先读取当前记录，用于给出明确错误并校验 HR 安排的开始日期。
    const student = await this.ensureFormIsEditable(id);

    this.validateRequiredAttachments(student);
    this.validateExperienceYears(dto);
    this.validateFormDates(dto);
    this.validateAgreementInfo(dto);

    if (!student.onboardingStartAt) {
      throw new BadRequestException('HR 尚未安排入职开始日期');
    }

    const onboardingEndAt = new Date(dto.onboardingEndAt);

    if (onboardingEndAt <= student.onboardingStartAt) {
      throw new BadRequestException('实习结束日期必须晚于入职开始日期');
    }

    const submittedAt = new Date();

    const updatedStudent = await this.studentModel
      .findOneAndUpdate(
        {
          _id: id,
          isDeleted: false,
          submittedAt: null,

          // 防止附件在提交请求执行期间被另一个请求删除。
          'attachments.type': {
            $all: [
              AttachmentType.Resume,
              AttachmentType.IdCardFront,
              AttachmentType.IdCardBack,
            ],
          },
        },
        {
          $set: {
            phone: dto.phone.trim(),

            basicInfo: {
              ...dto.basicInfo,
              formDate: dto.basicInfo.formDate
                ? new Date(dto.basicInfo.formDate)
                : null,
              birthDate: new Date(dto.basicInfo.birthDate),
            },

            educationExperiences: dto.educationExperiences,
            familyMembers: dto.familyMembers,
            internshipExperiences: dto.internshipExperiences,

            emergencyContactName: dto.emergencyContactName.trim(),
            emergencyContactPhone: dto.emergencyContactPhone.trim(),
            emergencyContactRelation: dto.emergencyContactRelation.trim(),

            hasIdCopyAndAgreement: dto.hasIdCopyAndAgreement,
            agreementSignedAt: dto.agreementSignedAt
              ? new Date(dto.agreementSignedAt)
              : null,
            notes: dto.notes?.trim() ?? null,

            applicantSignature: dto.applicantSignature.trim(),
            applicantSignedAt: new Date(dto.applicantSignedAt),

            onboardingEndAt,
            submittedAt,
          },
        },
        {
          // 返回更新后的学生记录，并执行 Mongoose Schema 校验。
          returnDocument: 'after',
          runValidators: true,
        },
      )
      .exec();

    if (!updatedStudent) {
      // 并发情况下，另一个请求可能已经先完成提交。
      const currentStudent = await this.ensureFormIsEditable(id);

      // 如果提交期间附件被删除，返回明确的附件缺失提示。
      this.validateRequiredAttachments(currentStudent);

      throw new ConflictException('登记表提交状态已发生变化，请重试');
    }

    this.logger.log(`Student ${id} submitted onboarding form`);

    return {
      message: '登记表提交成功',
      studentId: updatedStudent._id.toString(),
      submittedAt: updatedStudent.submittedAt,
      hasSubmitted: true,
      canEdit: false,
    };
  }

  async updateProfile(
    id: string,
    dto: UpdateStudentProfileDto,
    hrUserId: string,
  ) {
    // 检查 ID、学生是否存在以及是否已经软删除。
    // 不检查 submittedAt 或 onboardingStatus，因此已提交、已入职学生也能由 HR 修改。
    const student = await this.findActiveStudentById(id);

    const updates: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      updates.name = dto.name.trim();
    }

    if (dto.email !== undefined) {
      updates.email = dto.email.trim().toLowerCase();
    }

    const stringFields = [
      'phone',
      'emergencyContactName',
      'emergencyContactPhone',
      'emergencyContactRelation',
      'notes',
      'applicantSignature',
    ] as const;

    for (const field of stringFields) {
      const value = dto[field];

      if (value !== undefined) {
        updates[field] = value.trim();
      }
    }

    // 使用 basicInfo.xxx 路径，只更新传入的内部字段。
    // 不能直接替换 basicInfo，否则未传入的字段可能被删除。
    if (dto.basicInfo) {
      const normalizedBasicInfo: Record<string, unknown> = {};

      for (const [field, value] of Object.entries(dto.basicInfo)) {
        if (value === undefined) {
          continue;
        }

        if (field === 'formDate' || field === 'birthDate') {
          normalizedBasicInfo[field] =
            value === null ? null : new Date(String(value));
        } else {
          normalizedBasicInfo[field] =
            typeof value === 'string' ? value.trim() : value;
        }
      }

      if (student.basicInfo) {
        // 已有 basicInfo 时，仅修改 HR 传入的内部字段。
        for (const [field, value] of Object.entries(normalizedBasicInfo)) {
          updates[`basicInfo.${field}`] = value;
        }
      } else {
        // 尚未填表时 basicInfo 为 null，需要先创建整个对象。
        updates.basicInfo = normalizedBasicInfo;
      }
    }

    if (dto.educationExperiences !== undefined) {
      const hasInvalidYears = dto.educationExperiences.some(
        (item) => item.endYear < item.startYear,
      );

      if (hasInvalidYears) {
        throw new BadRequestException('教育经历的结束年份不能早于开始年份');
      }

      updates.educationExperiences = dto.educationExperiences;
    }

    if (dto.familyMembers !== undefined) {
      updates.familyMembers = dto.familyMembers;
    }

    if (dto.internshipExperiences !== undefined) {
      const hasInvalidYears = dto.internshipExperiences.some(
        (item) => item.endYear < item.startYear,
      );

      if (hasInvalidYears) {
        throw new BadRequestException('实习经历的结束年份不能早于开始年份');
      }

      updates.internshipExperiences = dto.internshipExperiences;
    }

    if (dto.hasIdCopyAndAgreement !== undefined) {
      updates.hasIdCopyAndAgreement = dto.hasIdCopyAndAgreement;
    }

    if (dto.agreementSignedAt !== undefined) {
      updates.agreementSignedAt = dto.agreementSignedAt
        ? new Date(dto.agreementSignedAt)
        : null;
    }

    if (dto.applicantSignedAt !== undefined) {
      updates.applicantSignedAt = dto.applicantSignedAt
        ? new Date(dto.applicantSignedAt)
        : null;
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('没有提供需要修改的登记信息');
    }

    try {
      const updatedStudent = await this.studentModel
        .findOneAndUpdate(
          {
            _id: id,
            isDeleted: false,
          },
          {
            $set: updates,
          },
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )
        .exec();

      if (!updatedStudent) {
        throw new NotFoundException('学生不存在或已删除');
      }

      // 日志只记录字段名，避免把身份证号等敏感内容写入日志。
      this.logger.log(
        `HR ${hrUserId} updated student ${id} profile fields: ${Object.keys(
          updates,
        ).join(', ')}`,
      );

      return this.findOneById(id);
    } catch (error: unknown) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('该姓名和邮箱的学生已存在');
      }

      throw error;
    }
  }

  async updateArrangement(
    id: string,
    dto: UpdateStudentArrangementDto,
    hrUserId: string,
  ) {
    const student = await this.findActiveStudentById(id);

    const changedFields: string[] = [];

    const hasUpdate =
      dto.workLocation !== undefined ||
      dto.onboardingStartAt !== undefined ||
      dto.onboardingEndAt !== undefined;

    if (!hasUpdate) {
      throw new BadRequestException('没有提供需要修改的入职安排');
    }

    // 已入职后，开始日期成为历史数据，不允许再修改。
    if (
      student.onboardingStatus === OnboardingStatus.Onboarded &&
      dto.onboardingStartAt !== undefined
    ) {
      throw new ConflictException('已入职学生不能修改入职开始日期');
    }

    // 使用修改后的值和数据库原值共同进行日期校验。
    const effectiveStartAt =
      dto.onboardingStartAt !== undefined
        ? this.normalizeOnboardingStartDate(dto.onboardingStartAt)
        : (student.onboardingStartAt ?? null);

    const effectiveEndAt =
      dto.onboardingEndAt !== undefined
        ? new Date(dto.onboardingEndAt)
        : (student.onboardingEndAt ?? null);

    if (
      dto.onboardingStartAt !== undefined &&
      effectiveStartAt &&
      effectiveStartAt < this.getChinaTodayStart()
    ) {
      throw new BadRequestException('入职开始日期不能早于今天');
    }

    if (dto.onboardingEndAt !== undefined && !effectiveStartAt) {
      throw new BadRequestException('设置实习结束日期前必须先安排入职开始日期');
    }

    if (
      effectiveStartAt &&
      effectiveEndAt &&
      effectiveEndAt <= effectiveStartAt
    ) {
      throw new BadRequestException('实习结束日期必须晚于入职开始日期');
    }

    if (dto.workLocation !== undefined) {
      student.workLocation = dto.workLocation;
      changedFields.push('workLocation');
    }

    if (dto.onboardingStartAt !== undefined) {
      student.onboardingStartAt = effectiveStartAt;
      changedFields.push('onboardingStartAt');
    }

    if (dto.onboardingEndAt !== undefined) {
      student.onboardingEndAt = effectiveEndAt;
      changedFields.push('onboardingEndAt');
    }

    // 学生拥有地点和开始日期后才具备登录填表资格。
    // 已入职学生修改地点或结束日期时，不能退回待入职状态。
    if (
      student.onboardingStatus !== OnboardingStatus.Onboarded &&
      student.workLocation &&
      student.onboardingStartAt
    ) {
      student.onboardingStatus = OnboardingStatus.PendingOnboarding;
    }

    await student.save();

    this.logger.log(
      `HR ${hrUserId} updated onboarding arrangement for student ${id}: ${changedFields.join(
        ', ',
      )}`,
    );

    return {
      id: student._id.toString(),
      name: student.name,
      email: student.email,
      onboardingStatus: student.onboardingStatus,
      workLocation: student.workLocation ?? null,
      onboardingStartAt: student.onboardingStartAt ?? null,
      onboardingEndAt: student.onboardingEndAt ?? null,
      updatedAt: student.updatedAt,
    };
  }

  async batchUpdateArrangement(
    dto: BatchUpdateStudentArrangementDto,
    hrUserId: string,
  ) {
    // Check all selected students before changing any record.
    const students = await this.studentModel
      .find({
        _id: { $in: dto.studentIds },
        isDeleted: false,
      })
      .select('_id onboardingStatus')
      .exec();

    if (students.length !== dto.studentIds.length) {
      throw new NotFoundException('部分学生不存在或已删除');
    }

    const containsOnboardedStudent = students.some(
      (student) => student.onboardingStatus === OnboardingStatus.Onboarded,
    );

    if (containsOnboardedStudent) {
      throw new ConflictException('已入职学生不能重新安排入职开始日期');
    }

    const workLocation = dto.workLocation;
    const onboardingStartAt = this.normalizeOnboardingStartDate(
      dto.onboardingStartAt,
    );

    if (onboardingStartAt < this.getChinaTodayStart()) {
      throw new BadRequestException('入职开始日期不能早于今天');
    }

    // updateMany sends one database update for all selected students.
    const result = await this.studentModel
      .updateMany(
        {
          _id: { $in: dto.studentIds },
          isDeleted: false,
        },
        {
          $set: {
            workLocation,
            onboardingStartAt,
            onboardingStatus: OnboardingStatus.PendingOnboarding,
          },
        },
        {
          runValidators: true,
        },
      )
      .exec();

    // Record the operator and affected record count.
    this.logger.log(
      `HR ${hrUserId} arranged onboarding for ${result.matchedCount} students`,
    );

    return {
      requestedCount: dto.studentIds.length,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      onboardingStatus: OnboardingStatus.PendingOnboarding,
      workLocation,
      onboardingStartAt,
    };
  }

  async softDelete(id: string, hrUserId: string) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    const deletedAt = new Date();
    const student = await this.studentModel
      .findOneAndUpdate(
        {
          _id: id,
          isDeleted: false,
        },
        {
          $set: {
            isDeleted: true,
            deletedAt,
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      )
      .exec();

    if (!student) {
      throw new NotFoundException('学生不存在或已经被删除');
    }

    this.logger.log(`HR ${hrUserId} soft-deleted student ${id}`);

    return {
      id: student._id.toString(),
      name: student.name,
      email: student.email,
      isDeleted: student.isDeleted,
      deletedAt,
    };
  }

  async create(dto: CreateStudentDto) {
    try {
      const student = await this.studentModel.create({
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim(),
      });

      this.logger.log(`Created student ${student._id.toString()}`);

      return {
        id: student._id.toString(),
        name: student.name,
        email: student.email,
        phone: student.phone ?? null,
        onboardingStatus: student.onboardingStatus,
        createdAt: student.createdAt,
      };
    } catch (error: unknown) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('该姓名和邮箱的学生已存在');
      }

      throw error;
    }
  }

  private validateRequiredAttachments(student: StudentDocument): void {
    const attachmentTypes = new Set(
      student.attachments.map((attachment) => attachment.type),
    );

    const missingAttachments: string[] = [];

    if (!attachmentTypes.has(AttachmentType.Resume)) {
      missingAttachments.push('简历');
    }

    if (!attachmentTypes.has(AttachmentType.IdCardFront)) {
      missingAttachments.push('身份证正面');
    }

    if (!attachmentTypes.has(AttachmentType.IdCardBack)) {
      missingAttachments.push('身份证反面');
    }

    if (missingAttachments.length > 0) {
      throw new BadRequestException(
        `请先上传必需附件：${missingAttachments.join('、')}`,
      );
    }
  }

  private validateExperienceYears(dto: SubmitStudentFormDto): void {
    const hasInvalidEducation = dto.educationExperiences.some(
      (item) => item.endYear < item.startYear,
    );

    if (hasInvalidEducation) {
      throw new BadRequestException('教育经历的结束年份不能早于开始年份');
    }

    const hasInvalidInternship = dto.internshipExperiences.some(
      (item) => item.endYear < item.startYear,
    );

    if (hasInvalidInternship) {
      throw new BadRequestException('实习经历的结束年份不能早于开始年份');
    }
  }

  private validateFormDates(dto: SubmitStudentFormDto): void {
    const now = new Date();

    if (new Date(dto.basicInfo.birthDate) >= now) {
      throw new BadRequestException('出生日期必须早于当前时间');
    }

    if (new Date(dto.applicantSignedAt) > now) {
      throw new BadRequestException('申请人签署时间不能晚于当前时间');
    }

    if (dto.agreementSignedAt && new Date(dto.agreementSignedAt) > now) {
      throw new BadRequestException('协议签署时间不能晚于当前时间');
    }
  }

  private validateAgreementInfo(dto: SubmitStudentFormDto): void {
    if (dto.hasIdCopyAndAgreement && !dto.agreementSignedAt) {
      throw new BadRequestException('请填写服务协议签署时间');
    }
  }

  private normalizeOnboardingStartDate(value: string): Date {
    const inputDate = new Date(value);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(inputDate);
    const getPart = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';

    // Date 仍用于数据库兼容，但只保留中国时区的自然日含义。
    return new Date(
      `${getPart('year')}-${getPart('month')}-${getPart('day')}T00:00:00+08:00`,
    );
  }

  private getChinaTodayStart(referenceDate = new Date()): Date {
    return this.normalizeOnboardingStartDate(referenceDate.toISOString());
  }

  private isDuplicateKeyError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    return (error as { code?: unknown }).code === 11000;
  }

  private escapeRegex(value: string): string {
    // Treat the keyword as normal text instead of executable regex syntax.
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async findActiveStudentById(id: string): Promise<StudentDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('学生 ID 格式错误');
    }

    // Deleted students are treated as unavailable.
    const student = await this.studentModel
      .findOne({
        _id: id,
        isDeleted: false,
      })
      .exec();

    if (!student) {
      throw new NotFoundException('学生不存在');
    }

    return student;
  }
}
