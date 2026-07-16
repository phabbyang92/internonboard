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
import { OnboardingStatus } from './enums/student.enums';
import { BatchUpdateStudentArrangementDto } from './dto/batch-update-student-arrangement.dto';

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

  constructor(
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
  ) {}

  async findAll(query: ListStudentsQueryDto) {
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
      ];
    }

    if (query.status) {
      filter.onboardingStatus = query.status;
    }

    // Run the data query and count query at the same time.
    const [students, total] = await Promise.all([
      this.studentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.studentModel.countDocuments(filter).exec(),
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
    };
  }

  async updateArrangement(
    id: string,
    dto: UpdateStudentArrangementDto,
    hrUserId: string,
  ) {
    const student = await this.findActiveStudentById(id);

    if (student.onboardingStatus === OnboardingStatus.Onboarded) {
      throw new ConflictException('已入职学生不能重新安排入职开始时间');
    }

    student.workLocation = dto.workLocation.trim();
    student.onboardingStartAt = new Date(dto.onboardingStartAt);

    // A student becomes eligible to log in after HR completes the arrangement.
    student.onboardingStatus = OnboardingStatus.PendingOnboarding;

    await student.save();

    // Record who performed the important HR operation.
    this.logger.log(
      `HR ${hrUserId} arranged onboarding for student ${student._id.toString()}`,
    );

    return {
      id: student._id.toString(),
      name: student.name,
      email: student.email,
      onboardingStatus: student.onboardingStatus,
      workLocation: student.workLocation,
      onboardingStartAt: student.onboardingStartAt,
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
      throw new ConflictException('已入职学生不能重新安排入职开始时间');
    }

    const workLocation = dto.workLocation.trim();
    const onboardingStartAt = new Date(dto.onboardingStartAt);

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
