import { HrRole } from '../auth/enums/hr-role.enum';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { OperationAction } from '../operation-log/enums/operation-action.enum';
import { OperationLogService } from '../operation-log/operation-log.service';
import {
  ApplicationDirection,
  OnboardingStatus,
  WorkLocation,
} from '../student/enums/student.enums';
import { StudentService } from '../student/student.service';
import { WorkLocationHistoryService } from '../work-location/work-location-history.service';
import { WorkLocationAssignmentSource } from '../work-location/work-location-assignment-source.enum';
import { HrStudentManagementService } from './hr-student-management.service';

const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const SECOND_STUDENT_ID = '6a5898b91231f75de80eec8e';
const HR_ID = '6a574ec45bd0f7b2a8b65b99';
const HR_ACCESS: HrAccessContext = { hrUserId: HR_ID, role: HrRole.Hr };

describe('HrStudentManagementService', () => {
  function createDependencies() {
    const studentService = {
      create: jest.fn(),
      findAll: jest.fn(),
      updateProfile: jest.fn(),
      findOneByIdForHr: jest.fn(),
      updateDueOnboardingStatuses: jest.fn().mockResolvedValue(undefined),
      updateArrangement: jest.fn(),
      changeCurrentWorkLocation: jest.fn(),
      batchUpdateArrangement: jest.fn(),
      softDelete: jest.fn(),
      ensureStudentExistsIncludingDeletedForHr: jest.fn(),
    };
    const operationLogService = {
      record: jest.fn().mockResolvedValue(undefined),
      findByStudentId: jest.fn().mockResolvedValue([]),
    };
    const workLocationHistoryService = {
      activateDueAssignments: jest.fn().mockResolvedValue({
        modifiedCount: 0,
      }),
      recordAssignment: jest.fn().mockResolvedValue(undefined),
      changeLocation: jest.fn(),
      updateAssignment: jest.fn(),
      removeAssignment: jest.fn(),
      findByStudentIds: jest.fn().mockResolvedValue([]),
      findByStudentId: jest.fn().mockResolvedValue([]),
      closeCurrentAssignment: jest.fn().mockResolvedValue(undefined),
    };
    return {
      studentService,
      operationLogService,
      workLocationHistoryService,
      service: new HrStudentManagementService(
        studentService as unknown as StudentService,
        operationLogService as unknown as OperationLogService,
        workLocationHistoryService as unknown as WorkLocationHistoryService,
      ),
    };
  }

  it('adds an ordered work-location timeline to every list item', async () => {
    const { service, studentService, workLocationHistoryService } =
      createDependencies();
    studentService.findAll.mockResolvedValue({
      items: [
        {
          id: STUDENT_ID,
          workLocation: WorkLocation.Online,
          onboardingStartAt: new Date('2026-08-01T00:00:00.000Z'),
        },
      ],
      pagination: {},
      stats: {},
    });
    workLocationHistoryService.findByStudentIds.mockResolvedValue([
      {
        studentId: STUDENT_ID,
        workLocation: WorkLocation.ShanghaiOffice,
        effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
        effectiveTo: new Date('2026-09-01T00:00:00.000Z'),
      },
      {
        studentId: STUDENT_ID,
        workLocation: WorkLocation.Online,
        effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
        effectiveTo: null,
      },
    ]);

    const result = await service.findAll({}, HR_ACCESS);

    expect(
      workLocationHistoryService.activateDueAssignments,
    ).toHaveBeenCalledTimes(1);
    expect(result.items[0].workLocationTimeline).toEqual([
      expect.objectContaining({ workLocation: WorkLocation.ShanghaiOffice }),
      expect.objectContaining({ workLocation: WorkLocation.Online }),
    ]);
  });

  it('records a dated work-location change and activates the due snapshot', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-10T04:00:00.000Z'));

    try {
      const {
        service,
        studentService,
        operationLogService,
        workLocationHistoryService,
      } = createDependencies();
      studentService.findOneByIdForHr.mockResolvedValue({
        onboardingStatus: OnboardingStatus.Onboarded,
        workLocation: WorkLocation.ShanghaiOffice,
        onboardingStartAt: new Date('2026-08-01T00:00:00.000Z'),
        onboardingEndAt: null,
      });
      workLocationHistoryService.changeLocation.mockResolvedValue({
        id: 'assignment-id',
      });
      await service.changeWorkLocation(
        STUDENT_ID,
        {
          workLocation: WorkLocation.Online,
          effectiveFrom: '2026-09-01T00:00:00+08:00',
        },
        HR_ACCESS,
      );

      expect(workLocationHistoryService.changeLocation).toHaveBeenCalledWith(
        expect.objectContaining({
          workLocation: WorkLocation.Online,
          effectiveFrom: new Date('2026-08-31T16:00:00.000Z'),
        }),
      );
      expect(
        workLocationHistoryService.activateDueAssignments,
      ).toHaveBeenCalledWith(new Date('2026-09-09T16:00:00.000Z'), STUDENT_ID);
      expect(operationLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: STUDENT_ID,
          action: OperationAction.StudentArrangementUpdated,
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('stores a future location change without updating the current snapshot early', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-10T04:00:00.000Z'));

    try {
      const { service, studentService, workLocationHistoryService } =
        createDependencies();
      const before = {
        onboardingStatus: OnboardingStatus.Onboarded,
        workLocation: WorkLocation.ShanghaiOffice,
        onboardingStartAt: new Date('2026-08-01T00:00:00.000Z'),
        onboardingEndAt: null,
      };
      studentService.findOneByIdForHr.mockResolvedValue(before);
      workLocationHistoryService.changeLocation.mockResolvedValue({
        id: 'future-assignment-id',
      });

      const result = await service.changeWorkLocation(
        STUDENT_ID,
        {
          workLocation: WorkLocation.Online,
          effectiveFrom: '2026-10-01T00:00:00+08:00',
        },
        HR_ACCESS,
      );

      expect(workLocationHistoryService.changeLocation).toHaveBeenCalled();
      expect(studentService.changeCurrentWorkLocation).not.toHaveBeenCalled();
      expect(
        workLocationHistoryService.activateDueAssignments,
      ).toHaveBeenCalledWith(new Date('2026-09-09T16:00:00.000Z'), STUDENT_ID);
      expect(result.student).toBe(before);
    } finally {
      jest.useRealTimers();
    }
  });

  it.each(['2026-08-01T00:00:00+08:00', '2026-07-31T00:00:00+08:00'])(
    'rejects a second location start that is not later than the first start: %s',
    async (effectiveFrom) => {
      const { service, studentService, workLocationHistoryService } =
        createDependencies();
      studentService.findOneByIdForHr.mockResolvedValue({
        onboardingStatus: OnboardingStatus.Onboarded,
        workLocation: WorkLocation.ShanghaiOffice,
        onboardingStartAt: new Date('2026-07-31T16:00:00.000Z'),
        onboardingEndAt: null,
      });

      await expect(
        service.changeWorkLocation(
          STUDENT_ID,
          {
            workLocation: WorkLocation.Online,
            effectiveFrom,
          },
          HR_ACCESS,
        ),
      ).rejects.toThrow('新地点开始日期必须晚于上一段实习开始日期');
      expect(workLocationHistoryService.changeLocation).not.toHaveBeenCalled();
    },
  );

  it('requires a new location segment to start after the latest segment', async () => {
    const { service, studentService, workLocationHistoryService } =
      createDependencies();
    studentService.findOneByIdForHr.mockResolvedValue({
      onboardingStatus: OnboardingStatus.Onboarded,
      workLocation: WorkLocation.Online,
      onboardingStartAt: new Date('2026-08-01T00:00:00.000Z'),
      onboardingEndAt: null,
    });
    workLocationHistoryService.findByStudentId.mockResolvedValue([
      {
        effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
        workLocation: WorkLocation.Online,
      },
      {
        effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
        workLocation: WorkLocation.ShanghaiOffice,
      },
    ]);

    await expect(
      service.changeWorkLocation(
        STUDENT_ID,
        {
          workLocation: WorkLocation.BeijingOffice,
          effectiveFrom: '2026-08-15T00:00:00+08:00',
        },
        HR_ACCESS,
      ),
    ).rejects.toThrow('新地点开始日期必须晚于上一段实习开始日期');
    expect(workLocationHistoryService.changeLocation).not.toHaveBeenCalled();
  });

  it('logs a corrected work-location segment', async () => {
    const {
      service,
      studentService,
      operationLogService,
      workLocationHistoryService,
    } = createDependencies();
    studentService.findOneByIdForHr.mockResolvedValue({ id: STUDENT_ID });
    workLocationHistoryService.updateAssignment.mockResolvedValue({
      before: {
        workLocation: WorkLocation.ShanghaiOffice,
        effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
      },
      assignment: {
        workLocation: WorkLocation.Online,
        effectiveFrom: new Date('2026-09-05T00:00:00.000Z'),
      },
    });

    await service.updateWorkLocationAssignment(
      STUDENT_ID,
      '6a574ec45bd0f7b2a8b65c12',
      {
        workLocation: WorkLocation.Online,
        effectiveFrom: '2026-09-05T00:00:00+08:00',
      },
      HR_ACCESS,
    );

    expect(operationLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: OperationAction.WorkLocationAssignmentUpdated,
        studentId: STUDENT_ID,
      }),
    );
  });

  it('logs a cancelled work-location segment', async () => {
    const {
      service,
      studentService,
      operationLogService,
      workLocationHistoryService,
    } = createDependencies();
    studentService.findOneByIdForHr.mockResolvedValue({ id: STUDENT_ID });
    workLocationHistoryService.removeAssignment.mockResolvedValue({
      removed: {
        workLocation: WorkLocation.Online,
        effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
      },
    });

    await service.cancelWorkLocationAssignment(
      STUDENT_ID,
      '6a574ec45bd0f7b2a8b65c12',
      HR_ACCESS,
    );

    expect(operationLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: OperationAction.WorkLocationAssignmentCancelled,
        studentId: STUDENT_ID,
      }),
    );
  });

  it('records location history when a student is created with an arrangement', async () => {
    const {
      service,
      studentService,
      operationLogService,
      workLocationHistoryService,
    } = createDependencies();
    const onboardingStartAt = new Date('2026-08-01T00:00:00.000Z');
    studentService.create.mockResolvedValue({
      id: STUDENT_ID,
      workLocation: WorkLocation.ShanghaiOffice,
      onboardingStartAt,
    });

    await service.createStudent(
      {
        name: '测试学生',
        email: 'student@example.com',
        workLocation: WorkLocation.ShanghaiOffice,
        onboardingStartAt: '2026-08-01T00:00:00.000Z',
      },
      HR_ACCESS,
    );

    expect(workLocationHistoryService.recordAssignment).toHaveBeenCalledWith({
      studentId: STUDENT_ID,
      workLocation: WorkLocation.ShanghaiOffice,
      onboardingStartAt,
      changedByHrId: HR_ID,
      source: WorkLocationAssignmentSource.Create,
    });
    expect(operationLogService.record).toHaveBeenCalledTimes(1);
    const [createdLog] = operationLogService.record.mock
      .calls[0] as unknown as [
      {
        studentId: string;
        action: OperationAction;
        changes: { fields: string[] };
      },
    ];
    expect(createdLog.studentId).toBe(STUDENT_ID);
    expect(createdLog.action).toBe(OperationAction.StudentCreated);
    expect(createdLog.changes.fields).toEqual(
      expect.arrayContaining([
        'workLocation',
        'onboardingStartAt',
        'onboardingStatus',
      ]),
    );
  });

  it('records only changed profile field names, not sensitive values', async () => {
    const { service, studentService, operationLogService } =
      createDependencies();
    const dto = {
      phone: '13800138000',
      basicInfo: {
        idNumber: 'sensitive-id-number',
        applicationDirection: ApplicationDirection.Consulting,
      },
    };
    studentService.updateProfile.mockResolvedValue({ id: STUDENT_ID });

    await service.updateProfile(STUDENT_ID, dto, HR_ACCESS);

    expect(operationLogService.record).toHaveBeenCalledWith({
      operatorHrId: HR_ID,
      studentId: STUDENT_ID,
      action: OperationAction.StudentProfileUpdated,
      changes: {
        fields: [
          'phone',
          'basicInfo.idNumber',
          'basicInfo.applicationDirection',
        ],
      },
    });
    const firstCall = operationLogService.record.mock.calls[0] as unknown as [
      unknown,
    ];
    expect(JSON.stringify(firstCall[0])).not.toContain('sensitive-id-number');
  });

  it('records a separate arrangement audit entry for every batch student', async () => {
    const { service, studentService, operationLogService } =
      createDependencies();
    studentService.findOneByIdForHr
      .mockResolvedValueOnce({
        workLocation: WorkLocation.BeijingOffice,
        onboardingStartAt: new Date('2026-08-01T00:00:00.000Z'),
        onboardingStatus: OnboardingStatus.PendingOnboarding,
      })
      .mockResolvedValueOnce({
        workLocation: null,
        onboardingStartAt: null,
        onboardingStatus: OnboardingStatus.Candidate,
      });
    studentService.batchUpdateArrangement.mockResolvedValue({
      workLocation: WorkLocation.Online,
      onboardingStartAt: new Date('2026-09-01T00:00:00.000Z'),
      onboardingStatus: OnboardingStatus.PendingOnboarding,
      matchedCount: 2,
    });

    await service.batchUpdateArrangement(
      {
        studentIds: [STUDENT_ID, SECOND_STUDENT_ID],
        workLocation: WorkLocation.Online,
        onboardingStartAt: '2026-09-01T00:00:00.000Z',
      },
      HR_ACCESS,
    );

    expect(operationLogService.record).toHaveBeenCalledTimes(2);
    expect(operationLogService.record).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        studentId: STUDENT_ID,
        action: OperationAction.StudentArrangementUpdated,
      }),
    );
    expect(operationLogService.record).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ studentId: SECOND_STUDENT_ID }),
    );
  });

  it('closes location history and logs the trimmed soft-delete reason', async () => {
    const {
      service,
      studentService,
      operationLogService,
      workLocationHistoryService,
    } = createDependencies();
    const deletedAt = new Date('2026-09-01T00:00:00.000Z');
    studentService.findOneByIdForHr.mockResolvedValue({
      onboardingStatus: OnboardingStatus.PendingOnboarding,
      workLocation: WorkLocation.ShanghaiOffice,
    });
    studentService.softDelete.mockResolvedValue({
      id: STUDENT_ID,
      deletedAt,
    });

    await service.softDeleteStudent(
      STUDENT_ID,
      { reason: '  offer 发生变动  ' },
      HR_ACCESS,
    );

    expect(
      workLocationHistoryService.closeCurrentAssignment,
    ).toHaveBeenCalledWith(STUDENT_ID, deletedAt);
    expect(operationLogService.record).toHaveBeenCalledWith({
      operatorHrId: HR_ID,
      studentId: STUDENT_ID,
      action: OperationAction.StudentSoftDeleted,
      changes: {
        reason: 'offer 发生变动',
        previousOnboardingStatus: OnboardingStatus.PendingOnboarding,
        previousWorkLocation: WorkLocation.ShanghaiOffice,
      },
    });
  });
});
