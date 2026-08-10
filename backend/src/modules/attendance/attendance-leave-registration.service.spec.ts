import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Model } from 'mongoose';
import type { BusinessClockService } from '../../common/time/business-clock.service';
import { OnboardingStatus, WorkLocation } from '../student/enums/student.enums';
import type { AttendanceEligibilityService } from './attendance-eligibility.service';
import type { AttendanceLeavePolicyService } from './attendance-leave-policy.service';
import { AttendanceLeaveRegistrationService } from './attendance-leave-registration.service';
import { AttendanceEligibilityReason } from './enums/attendance-eligibility-reason.enum';
import { AttendanceErrorCode } from './enums/attendance-error-code.enum';
import { AttendanceSource } from './enums/attendance-source.enum';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { RegionCode } from './enums/region-code.enum';
import type { AttendanceEligibilityResult } from './interfaces/attendance-eligibility-result.interface';
import type { AttendanceRecordDocument } from './schemas/attendance-record.schema';

const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const OWNER_HR_ID = '6a574ec45bd0f7b2a8b65b99';
const ASSIGNMENT_ID = '6a574ec45bd0f7b2a8b65c20';
const NOW = new Date('2026-08-06T02:00:00.000Z');

function eligibility(attendanceDate: string): AttendanceEligibilityResult {
  return {
    eligible: true,
    reason: AttendanceEligibilityReason.Eligible,
    attendanceDate,
    student: {
      id: STUDENT_ID,
      ownerHrId: OWNER_HR_ID,
      onboardingStatus: OnboardingStatus.Onboarded,
      onboardingStartAt: new Date('2026-08-01T00:00:00.000Z'),
      onboardingEndAt: null,
    },
    location: {
      assignmentId: ASSIGNMENT_ID,
      studentId: STUDENT_ID,
      workLocation: WorkLocation.ShanghaiOffice,
      regionCode: RegionCode.Shanghai,
      effectiveFrom: new Date('2026-07-31T16:00:00.000Z'),
      effectiveTo: null,
    },
    workday: {
      attendanceDate,
      regionCode: RegionCode.Shanghai,
      isWorkday: true,
      reason: 'weekday',
      holiday: null,
    },
  };
}

function createService() {
  const findExec = jest.fn().mockResolvedValue([]);
  const select = jest.fn().mockReturnValue({
    lean: () => ({ exec: findExec }),
  });
  const deleteExec = jest.fn().mockResolvedValue({ deletedCount: 0 });
  const model = {
    find: jest.fn().mockReturnValue({ select }),
    insertMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn().mockReturnValue({ exec: deleteExec }),
  };
  const clock = {
    now: jest.fn().mockReturnValue(NOW),
  };
  const eligibilityService = {
    evaluateMany: jest.fn((_studentId: string, dates: string[]) =>
      Promise.resolve(dates.map(eligibility)),
    ),
  };
  const leavePolicyService = {
    validateRequestedDates: jest
      .fn()
      .mockReturnValue(['2026-08-07', '2026-08-08']),
    assertCanRegisterLeave: jest.fn(),
  };

  return {
    model,
    findExec,
    deleteExec,
    eligibilityService,
    leavePolicyService,
    service: new AttendanceLeaveRegistrationService(
      model as unknown as Model<AttendanceRecordDocument>,
      clock as unknown as BusinessClockService,
      eligibilityService as unknown as AttendanceEligibilityService,
      leavePolicyService as unknown as AttendanceLeavePolicyService,
    ),
  };
}

describe('AttendanceLeaveRegistrationService', () => {
  it('writes all selected dates with one shared leave batch ID', async () => {
    const { service, model, eligibilityService, leavePolicyService } =
      createService();

    const result = await service.register(STUDENT_ID, {
      dates: ['2026-08-08', '2026-08-07'],
    });

    expect(leavePolicyService.validateRequestedDates).toHaveBeenCalledWith(
      ['2026-08-08', '2026-08-07'],
      NOW,
    );
    expect(eligibilityService.evaluateMany).toHaveBeenCalledWith(
      STUDENT_ID,
      ['2026-08-07', '2026-08-08'],
      NOW,
    );
    expect(leavePolicyService.assertCanRegisterLeave).toHaveBeenCalledTimes(2);
    expect(model.insertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          attendanceDate: '2026-08-07',
          status: AttendanceStatus.Leave,
          source: AttendanceSource.LeaveRegistration,
          assignedWorkLocation: WorkLocation.ShanghaiOffice,
          leaveBatchId: result.leaveBatchId,
          leaveRegisteredAt: NOW,
        }),
        expect.objectContaining({
          attendanceDate: '2026-08-08',
          leaveBatchId: result.leaveBatchId,
        }),
      ]),
      { ordered: true },
    );
    expect(typeof result.leaveBatchId).toBe('string');
    expect(result.dates).toEqual(['2026-08-07', '2026-08-08']);
    expect(result.registeredAt).toBe(NOW);
  });

  it('rejects the whole request before writing when a selected date has leave', async () => {
    const { service, findExec, model } = createService();
    findExec.mockResolvedValueOnce([
      { attendanceDate: '2026-08-07', status: AttendanceStatus.Leave },
    ]);

    await expect(
      service.register(STUDENT_ID, { dates: ['2026-08-07'] }),
    ).rejects.toMatchObject({
      response: { code: AttendanceErrorCode.LeaveAlreadyRegistered },
    });
    expect(model.insertMany).not.toHaveBeenCalled();
  });

  it('rejects the whole request when a date has an attendance or absence record', async () => {
    const { service, findExec, model } = createService();
    findExec.mockResolvedValueOnce([
      { attendanceDate: '2026-08-07', status: AttendanceStatus.OnTime },
    ]);

    await expect(
      service.register(STUDENT_ID, { dates: ['2026-08-07'] }),
    ).rejects.toMatchObject({
      response: { code: AttendanceErrorCode.AttendanceAlreadyRecorded },
    });
    expect(model.insertMany).not.toHaveBeenCalled();
  });

  it('does not write any record when one selected date fails leave policy', async () => {
    const { service, leavePolicyService, model } = createService();
    leavePolicyService.assertCanRegisterLeave.mockImplementationOnce(() => {
      throw new BadRequestException('周末无需登记出勤');
    });

    await expect(
      service.register(STUDENT_ID, {
        dates: ['2026-08-07', '2026-08-08'],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(model.find).not.toHaveBeenCalled();
    expect(model.insertMany).not.toHaveBeenCalled();
  });

  it('removes partial batch records after a concurrent unique-index conflict', async () => {
    const { service, model, findExec, deleteExec } = createService();
    model.insertMany.mockRejectedValueOnce({
      code: 11000,
      keyPattern: { studentId: 1, attendanceDate: 1 },
    });
    findExec
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { attendanceDate: '2026-08-08', status: AttendanceStatus.Late },
      ]);

    await expect(
      service.register(STUDENT_ID, {
        dates: ['2026-08-07', '2026-08-08'],
      }),
    ).rejects.toMatchObject({
      response: { code: AttendanceErrorCode.AttendanceAlreadyRecorded },
    });
    expect(model.deleteMany).toHaveBeenCalledTimes(1);
    expect(deleteExec).toHaveBeenCalled();
  });

  it('reports a server error if concurrent batch cleanup fails', async () => {
    const { service, model, deleteExec } = createService();
    model.insertMany.mockRejectedValueOnce({
      code: 11000,
      message: 'duplicate key unique_student_attendance_date',
    });
    deleteExec.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      service.register(STUDENT_ID, { dates: ['2026-08-07'] }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('rejects an invalid student ID before applying leave rules', async () => {
    const { service, leavePolicyService } = createService();

    await expect(
      service.register('invalid', { dates: ['2026-08-07'] }),
    ).rejects.toThrow(BadRequestException);
    expect(leavePolicyService.validateRequestedDates).not.toHaveBeenCalled();
  });

  it('does not convert an unrelated database failure into a conflict', async () => {
    const { service, model } = createService();
    model.insertMany.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      service.register(STUDENT_ID, { dates: ['2026-08-07'] }),
    ).rejects.toThrow('database unavailable');
  });

  it('uses ConflictException for stable duplicate-record responses', async () => {
    const { service, findExec } = createService();
    findExec.mockResolvedValueOnce([
      { attendanceDate: '2026-08-07', status: AttendanceStatus.Absent },
    ]);

    await expect(
      service.register(STUDENT_ID, { dates: ['2026-08-07'] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
