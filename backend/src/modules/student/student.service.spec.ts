import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Model } from 'mongoose';
import { BatchUpdateStudentArrangementDto } from './dto/batch-update-student-arrangement.dto';
import { SubmitStudentFormDto } from './dto/submit-student-form.dto';
import {
  ApplicationDirection,
  AttachmentType,
  FormSubmissionStatus,
  OnboardingStatus,
  WorkLocation,
} from './enums/student.enums';
import type { StudentDocument } from './schemas/student.schema';
import { StudentService } from './student.service';

const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const SECOND_STUDENT_ID = '6a5898b91231f75de80eec8e';
const START_AT = new Date('2026-08-05T01:30:00.000Z');

interface StudentModelMock {
  findOne: jest.Mock;
  findOneAndUpdate: jest.Mock;
  find: jest.Mock;
  countDocuments: jest.Mock;
  updateMany: jest.Mock;
}

function queryResult<T>(value: T) {
  return {
    exec: jest.fn().mockResolvedValue(value),
  };
}

function createModelMock(): StudentModelMock {
  return {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    updateMany: jest.fn(),
  };
}

function createService(model: StudentModelMock): StudentService {
  return new StudentService(model as unknown as Model<StudentDocument>);
}

function createStudent(
  overrides: Partial<StudentDocument> = {},
): StudentDocument {
  return {
    _id: { toString: () => STUDENT_ID },
    name: '测试学生',
    email: 'student@example.com',
    phone: '13800138000',
    onboardingStatus: OnboardingStatus.PendingOnboarding,
    workLocation: WorkLocation.ShanghaiOffice,
    onboardingStartAt: START_AT,
    onboardingEndAt: null,
    submittedAt: null,
    attachments: [
      {
        type: AttachmentType.Resume,
        originalName: 'resume.pdf',
        storageKey: 'students/test/resume.pdf',
      },
      {
        type: AttachmentType.IdCardFront,
        originalName: 'id-card-front.pdf',
        storageKey: 'students/test/id-card-front.pdf',
      },
      {
        type: AttachmentType.IdCardBack,
        originalName: 'id-card-back.pdf',
        storageKey: 'students/test/id-card-back.pdf',
      },
    ],
    educationExperiences: [],
    familyMembers: [],
    internshipExperiences: [],
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    isDeleted: false,
    deletedAt: null,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as StudentDocument;
}

function createValidFormDto(
  overrides: Partial<SubmitStudentFormDto> = {},
): SubmitStudentFormDto {
  return {
    phone: ' 13800138000 ',
    basicInfo: {
      position: '实习生',
      applicationDirection: ApplicationDirection.Ai,
      formDate: '2026-07-20T00:00:00.000Z',
      gender: '女',
      birthDate: '2000-01-01T00:00:00.000Z',
      idNumber: 'test-id-number',
      householdRegistration: '上海',
      currentSchool: '测试大学',
      major: '计算机科学',
      degree: '硕士',
      sourceChannel: '官网',
      homeAddress: '测试地址',
    },
    educationExperiences: [
      {
        startYear: 2021,
        endYear: 2025,
        school: '测试大学',
        major: '计算机科学',
      },
    ],
    familyMembers: [],
    internshipExperiences: [],
    emergencyContactName: '紧急联系人',
    emergencyContactPhone: '13800138001',
    emergencyContactRelation: '家人',
    hasIdCopyAndAgreement: true,
    agreementSignedAt: '2026-07-19T00:00:00.000Z',
    applicantSignature: '测试学生',
    applicantSignedAt: '2026-07-20T00:00:00.000Z',
    onboardingEndAt: '2026-12-31T00:00:00.000Z',
    ...overrides,
  };
}

describe('StudentService', () => {
  describe('findAll', () => {
    it('applies all filters, searches schools, and returns global stats', async () => {
      const model = createModelMock();
      const student = createStudent();
      const listQuery = {
        sort: jest.fn(),
        skip: jest.fn(),
        limit: jest.fn(),
        exec: jest.fn().mockResolvedValue([student]),
      };
      listQuery.sort.mockReturnValue(listQuery);
      listQuery.skip.mockReturnValue(listQuery);
      listQuery.limit.mockReturnValue(listQuery);
      model.find.mockReturnValue(listQuery);
      model.updateMany.mockReturnValue(
        queryResult({ matchedCount: 0, modifiedCount: 0 }),
      );
      model.countDocuments
        .mockReturnValueOnce(queryResult(1))
        .mockReturnValueOnce(queryResult(24))
        .mockReturnValueOnce(queryResult(6))
        .mockReturnValueOnce(queryResult(13))
        .mockReturnValueOnce(queryResult(5));

      const result = await createService(model).findAll({
        page: 1,
        limit: 20,
        keyword: '测试.*',
        status: OnboardingStatus.PendingOnboarding,
        workLocation: WorkLocation.ShanghaiOffice,
        formStatus: FormSubmissionStatus.NotSubmitted,
      });

      expect(model.find).toHaveBeenCalledWith({
        isDeleted: false,
        onboardingStatus: OnboardingStatus.PendingOnboarding,
        workLocation: WorkLocation.ShanghaiOffice,
        submittedAt: null,
        $or: [
          { name: { $regex: '测试\\.\\*', $options: 'i' } },
          { email: { $regex: '测试\\.\\*', $options: 'i' } },
          { phone: { $regex: '测试\\.\\*', $options: 'i' } },
          {
            'basicInfo.currentSchool': {
              $regex: '测试\\.\\*',
              $options: 'i',
            },
          },
          {
            'educationExperiences.school': {
              $regex: '测试\\.\\*',
              $options: 'i',
            },
          },
        ],
      });
      expect(result.stats).toEqual({
        all: 24,
        notSubmitted: 6,
        pendingOnboarding: 13,
        onboarded: 5,
      });
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('updateDueOnboardingStatuses', () => {
    it('marks active pending students whose China start date has arrived', async () => {
      const model = createModelMock();
      model.updateMany.mockReturnValue(
        queryResult({ matchedCount: 2, modifiedCount: 2 }),
      );

      const result = await createService(model).updateDueOnboardingStatuses(
        new Date('2026-08-05T12:00:00.000Z'),
      );

      expect(model.updateMany).toHaveBeenCalledWith(
        {
          isDeleted: false,
          onboardingStatus: OnboardingStatus.PendingOnboarding,
          onboardingStartAt: {
            $ne: null,
            $lt: new Date('2026-08-05T16:00:00.000Z'),
          },
        },
        {
          $set: {
            onboardingStatus: OnboardingStatus.Onboarded,
          },
        },
        {
          runValidators: true,
        },
      );
      expect(result).toEqual({
        matchedCount: 2,
        modifiedCount: 2,
        effectiveDate: new Date('2026-08-04T16:00:00.000Z'),
      });
    });

    it('is safe to repeat because the database filter only targets pending students', async () => {
      const model = createModelMock();
      model.updateMany
        .mockReturnValueOnce(queryResult({ matchedCount: 1, modifiedCount: 1 }))
        .mockReturnValueOnce(
          queryResult({ matchedCount: 0, modifiedCount: 0 }),
        );
      const service = createService(model);
      const referenceDate = new Date('2026-08-05T12:00:00.000Z');

      await service.updateDueOnboardingStatuses(referenceDate);
      const repeatedResult =
        await service.updateDueOnboardingStatuses(referenceDate);

      expect(model.updateMany).toHaveBeenCalledTimes(2);
      expect(repeatedResult.modifiedCount).toBe(0);
    });
  });

  describe('submitForm', () => {
    it.each([
      {
        missingType: AttachmentType.Resume,
        expectedMessage: '请先上传必需附件：简历',
      },
      {
        missingType: AttachmentType.IdCardFront,
        expectedMessage: '请先上传必需附件：身份证正面',
      },
      {
        missingType: AttachmentType.IdCardBack,
        expectedMessage: '请先上传必需附件：身份证反面',
      },
    ])(
      'rejects submission when $missingType is missing',
      async ({ missingType, expectedMessage }) => {
        const model = createModelMock();
        const student = createStudent({
          attachments: createStudent().attachments.filter(
            (attachment) => attachment.type !== missingType,
          ),
        });
        model.findOne.mockReturnValue(queryResult(student));

        await expect(
          createService(model).submitForm(STUDENT_ID, createValidFormDto()),
        ).rejects.toThrow(expectedMessage);
        expect(model.findOneAndUpdate).not.toHaveBeenCalled();
      },
    );

    it('rejects an end date that is not later than the HR start date', async () => {
      const model = createModelMock();
      model.findOne.mockReturnValue(queryResult(createStudent()));

      await expect(
        createService(model).submitForm(
          STUDENT_ID,
          createValidFormDto({
            onboardingEndAt: START_AT.toISOString(),
          }),
        ),
      ).rejects.toThrow('实习结束日期必须晚于入职开始日期');
    });

    it('rejects a future birth date', async () => {
      const model = createModelMock();
      model.findOne.mockReturnValue(queryResult(createStudent()));
      const dto = createValidFormDto();
      dto.basicInfo.birthDate = '2999-01-01T00:00:00.000Z';

      await expect(
        createService(model).submitForm(STUDENT_ID, dto),
      ).rejects.toThrow('出生日期必须早于当前时间');
    });

    it('requires an agreement date when the agreement is confirmed', async () => {
      const model = createModelMock();
      model.findOne.mockReturnValue(queryResult(createStudent()));

      await expect(
        createService(model).submitForm(
          STUDENT_ID,
          createValidFormDto({ agreementSignedAt: undefined }),
        ),
      ).rejects.toThrow('请填写服务协议签署时间');
    });

    it('uses an atomic filter and returns the successful submission', async () => {
      const model = createModelMock();
      const student = createStudent();
      const updatedStudent = createStudent({
        submittedAt: new Date('2026-07-20T10:00:00.000Z'),
      });
      model.findOne.mockReturnValue(queryResult(student));
      model.findOneAndUpdate.mockReturnValue(queryResult(updatedStudent));

      const result = await createService(model).submitForm(
        STUDENT_ID,
        createValidFormDto(),
      );

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: STUDENT_ID,
          isDeleted: false,
          submittedAt: null,
          'attachments.type': {
            $all: [
              AttachmentType.Resume,
              AttachmentType.IdCardFront,
              AttachmentType.IdCardBack,
            ],
          },
        }),
        expect.any(Object),
        expect.objectContaining({
          returnDocument: 'after',
          runValidators: true,
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          message: '登记表提交成功',
          hasSubmitted: true,
          canEdit: false,
        }),
      );
    });

    it('rejects a duplicate submission before attempting an update', async () => {
      const model = createModelMock();
      model.findOne.mockReturnValue(
        queryResult(createStudent({ submittedAt: new Date() })),
      );

      await expect(
        createService(model).submitForm(STUDENT_ID, createValidFormDto()),
      ).rejects.toThrow(ConflictException);
      expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('rechecks required attachments if the atomic update loses a race', async () => {
      const model = createModelMock();
      const completeStudent = createStudent();
      const studentMissingIdCardBack = createStudent({
        attachments: completeStudent.attachments.filter(
          (attachment) => attachment.type !== AttachmentType.IdCardBack,
        ),
      });
      model.findOne
        .mockReturnValueOnce(queryResult(completeStudent))
        .mockReturnValueOnce(queryResult(studentMissingIdCardBack));
      model.findOneAndUpdate.mockReturnValue(queryResult(null));

      await expect(
        createService(model).submitForm(STUDENT_ID, createValidFormDto()),
      ).rejects.toThrow('请先上传必需附件：身份证反面');
    });
  });

  describe('updateArrangement', () => {
    it('rejects an empty arrangement patch', async () => {
      const model = createModelMock();
      model.findOne.mockReturnValue(queryResult(createStudent()));

      await expect(
        createService(model).updateArrangement(STUDENT_ID, {}, 'hr-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('normalizes the start value to midnight in China', async () => {
      const model = createModelMock();
      const save = jest.fn().mockResolvedValue(undefined);
      const student = createStudent({ save });
      model.findOne.mockReturnValue(queryResult(student));

      await createService(model).updateArrangement(
        STUDENT_ID,
        { onboardingStartAt: '2026-09-01T09:30:00+08:00' },
        'hr-id',
      );

      expect(student.onboardingStartAt?.toISOString()).toBe(
        '2026-08-31T16:00:00.000Z',
      );
      expect(save).toHaveBeenCalledTimes(1);
    });

    it('rejects an onboarding start date before today', async () => {
      const model = createModelMock();
      const save = jest.fn().mockResolvedValue(undefined);
      model.findOne.mockReturnValue(queryResult(createStudent({ save })));

      await expect(
        createService(model).updateArrangement(
          STUDENT_ID,
          { onboardingStartAt: '2000-01-01T00:00:00+08:00' },
          'hr-id',
        ),
      ).rejects.toThrow('入职开始日期不能早于今天');
      expect(save).not.toHaveBeenCalled();
    });

    it('does not allow an onboarded student start time to change', async () => {
      const model = createModelMock();
      model.findOne.mockReturnValue(
        queryResult(
          createStudent({ onboardingStatus: OnboardingStatus.Onboarded }),
        ),
      );

      await expect(
        createService(model).updateArrangement(
          STUDENT_ID,
          { onboardingStartAt: '2026-09-01T00:00:00.000Z' },
          'hr-id',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('allows location and end time changes after onboarding', async () => {
      const model = createModelMock();
      const save = jest.fn().mockResolvedValue(undefined);
      const student = createStudent({
        onboardingStatus: OnboardingStatus.Onboarded,
        save,
      });
      model.findOne.mockReturnValue(queryResult(student));

      const result = await createService(model).updateArrangement(
        STUDENT_ID,
        {
          workLocation: WorkLocation.Online,
          onboardingEndAt: '2026-12-31T00:00:00.000Z',
        },
        'hr-id',
      );

      expect(save).toHaveBeenCalledTimes(1);
      expect(result.workLocation).toBe(WorkLocation.Online);
      expect(result.onboardingStatus).toBe(OnboardingStatus.Onboarded);
    });
  });

  describe('batchUpdateArrangement', () => {
    function batchDto(): BatchUpdateStudentArrangementDto {
      return {
        studentIds: [STUDENT_ID, SECOND_STUDENT_ID],
        workLocation: WorkLocation.ShanghaiOffice,
        onboardingStartAt: '2026-08-05T01:30:00.000Z',
      };
    }

    it('rejects the whole batch when a selected student is missing', async () => {
      const model = createModelMock();
      model.find.mockReturnValue({
        select: jest.fn().mockReturnValue(queryResult([createStudent()])),
      });

      await expect(
        createService(model).batchUpdateArrangement(batchDto(), 'hr-id'),
      ).rejects.toThrow(NotFoundException);
      expect(model.updateMany).not.toHaveBeenCalled();
    });

    it('rejects the whole batch when it contains an onboarded student', async () => {
      const model = createModelMock();
      model.find.mockReturnValue({
        select: jest
          .fn()
          .mockReturnValue(
            queryResult([
              createStudent(),
              createStudent({ onboardingStatus: OnboardingStatus.Onboarded }),
            ]),
          ),
      });

      await expect(
        createService(model).batchUpdateArrangement(batchDto(), 'hr-id'),
      ).rejects.toThrow(ConflictException);
      expect(model.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a batch start date before today', async () => {
      const model = createModelMock();
      model.find.mockReturnValue({
        select: jest
          .fn()
          .mockReturnValue(queryResult([createStudent(), createStudent()])),
      });

      await expect(
        createService(model).batchUpdateArrangement(
          {
            ...batchDto(),
            onboardingStartAt: '2000-01-01T00:00:00+08:00',
          },
          'hr-id',
        ),
      ).rejects.toThrow('入职开始日期不能早于今天');
      expect(model.updateMany).not.toHaveBeenCalled();
    });
  });
});
