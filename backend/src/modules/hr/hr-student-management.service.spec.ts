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
import { HrStudentManagementService } from './hr-student-management.service';

const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const SECOND_STUDENT_ID = '6a5898b91231f75de80eec8e';
const HR_ID = '6a574ec45bd0f7b2a8b65b99';
const HR_ACCESS: HrAccessContext = { hrUserId: HR_ID, role: HrRole.Hr };

describe('HrStudentManagementService', () => {
  function createDependencies() {
    const studentService = {
      create: jest.fn(),
      updateProfile: jest.fn(),
      findOneByIdForHr: jest.fn(),
      updateArrangement: jest.fn(),
      batchUpdateArrangement: jest.fn(),
      softDelete: jest.fn(),
      ensureStudentExistsIncludingDeletedForHr: jest.fn(),
    };
    const operationLogService = {
      record: jest.fn().mockResolvedValue(undefined),
      findByStudentId: jest.fn(),
    };
    const workLocationHistoryService = {
      recordAssignment: jest.fn().mockResolvedValue(undefined),
      findByStudentId: jest.fn(),
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
