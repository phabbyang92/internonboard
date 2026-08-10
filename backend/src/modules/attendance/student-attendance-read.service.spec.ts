import { BadRequestException } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { BusinessClockService } from '../../common/time/business-clock.service';
import type { AttendanceCheckInPolicyService } from './attendance-check-in-policy.service';
import type { AttendanceEligibilityService } from './attendance-eligibility.service';
import type { AttendanceQueryPreparationService } from './attendance-query-preparation.service';
import { AttendanceEligibilityReason } from './enums/attendance-eligibility-reason.enum';
import { AttendanceSource } from './enums/attendance-source.enum';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { CheckInMode } from './enums/check-in-mode.enum';
import { LateLevel } from './enums/late-level.enum';
import type { AttendanceEligibilityResult } from './interfaces/attendance-eligibility-result.interface';
import type { AttendanceRecordDocument } from './schemas/attendance-record.schema';
import { StudentAttendanceReadService } from './student-attendance-read.service';

const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const NOW = new Date('2026-08-06T01:30:00.000Z');

const ELIGIBLE_RESULT: AttendanceEligibilityResult = {
  eligible: true,
  reason: AttendanceEligibilityReason.Eligible,
  attendanceDate: '2026-08-06',
  student: {
    id: STUDENT_ID,
    ownerHrId: '6a574ec45bd0f7b2a8b65b99',
    onboardingStatus: 'onboarded',
    onboardingStartAt: new Date('2026-08-01T00:00:00+08:00'),
    onboardingEndAt: null,
  },
  location: {
    assignmentId: '6a574ec45bd0f7b2a8b65b10',
    studentId: STUDENT_ID,
    workLocation: '上海办公室 - 绿地汇',
    regionCode: 'shanghai',
    effectiveFrom: new Date('2026-08-01T00:00:00+08:00'),
    effectiveTo: null,
  },
  workday: {
    attendanceDate: '2026-08-06',
    regionCode: 'shanghai',
    isWorkday: true,
    reason: 'weekday',
    holiday: null,
  },
};

function createService(
  options: {
    todayRecord?: Record<string, unknown> | null;
    records?: Array<Record<string, unknown>>;
    eligibility?: AttendanceEligibilityResult;
  } = {},
) {
  const findOneExec = jest.fn().mockResolvedValue(options.todayRecord ?? null);
  const records = options.records ?? [];
  const sort = jest.fn().mockReturnValue({
    lean: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(records),
    }),
  });
  const attendanceRecordModel = {
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({ exec: findOneExec }),
    }),
    find: jest.fn().mockReturnValue({ sort }),
  };
  const businessClock = {
    now: jest.fn().mockReturnValue(NOW),
    getBusinessDate: jest.fn().mockReturnValue('2026-08-06'),
    getAttendanceWindow: jest.fn().mockReturnValue('on_time'),
  };
  const eligibilityService = {
    evaluate: jest
      .fn()
      .mockResolvedValue(options.eligibility ?? ELIGIBLE_RESULT),
  };
  const checkInPolicyService = {
    getPolicy: jest.fn().mockReturnValue({
      assignedWorkLocation: '上海办公室 - 绿地汇',
      allowedCheckInModes: [CheckInMode.Online, CheckInMode.Offline],
      officeNetworkRequiredFor: [CheckInMode.Offline],
    }),
  };
  const queryPreparationService = {
    prepareStudentDaily: jest.fn().mockResolvedValue({}),
    prepareStudentMonth: jest.fn().mockResolvedValue({}),
  };

  return {
    attendanceRecordModel,
    queryPreparationService,
    service: new StudentAttendanceReadService(
      attendanceRecordModel as unknown as Model<AttendanceRecordDocument>,
      businessClock as unknown as BusinessClockService,
      eligibilityService as unknown as AttendanceEligibilityService,
      checkInPolicyService as unknown as AttendanceCheckInPolicyService,
      queryPreparationService as unknown as AttendanceQueryPreparationService,
    ),
  };
}

describe('StudentAttendanceReadService', () => {
  it('prepares and returns an eligible pending workday', async () => {
    const { service, queryPreparationService } = createService();

    await expect(service.getToday(STUDENT_ID)).resolves.toEqual({
      attendanceDate: '2026-08-06',
      isWorkday: true,
      assignedWorkLocation: '上海办公室 - 绿地汇',
      allowedCheckInModes: [CheckInMode.Online, CheckInMode.Offline],
      officeNetworkRequiredFor: [CheckInMode.Offline],
      checkInWindow: 'open',
      status: 'pending',
      checkInAt: null,
    });
    expect(queryPreparationService.prepareStudentDaily).toHaveBeenCalledWith(
      STUDENT_ID,
      '2026-08-06',
      NOW,
    );
  });

  it('returns an existing final record after reconciliation', async () => {
    const checkInAt = new Date('2026-08-06T01:00:00.000Z');
    const { service } = createService({
      todayRecord: {
        status: AttendanceStatus.Late,
        checkInAt,
      },
    });

    await expect(service.getToday(STUDENT_ID)).resolves.toMatchObject({
      status: AttendanceStatus.Late,
      checkInAt,
    });
  });

  it('returns not_required without check-in modes on a non-workday', async () => {
    const { service } = createService({
      eligibility: {
        ...ELIGIBLE_RESULT,
        eligible: false,
        reason: AttendanceEligibilityReason.NonWorkday,
        workday: {
          ...ELIGIBLE_RESULT.workday!,
          isWorkday: false,
          reason: 'weekend',
        },
      },
    });

    await expect(service.getToday(STUDENT_ID)).resolves.toMatchObject({
      isWorkday: false,
      allowedCheckInModes: [],
      officeNetworkRequiredFor: [],
      status: 'not_required',
    });
  });

  it('summarizes only on-time and normal late records as attendance days', async () => {
    const records = [
      {
        attendanceDate: '2026-08-01',
        status: AttendanceStatus.OnTime,
        lateLevel: null,
        source: AttendanceSource.CheckIn,
        checkInAt: NOW,
        assignedWorkLocation: '线上',
        checkInMode: CheckInMode.Online,
        checkInLocation: '线上',
      },
      {
        attendanceDate: '2026-08-02',
        status: AttendanceStatus.Late,
        lateLevel: LateLevel.Normal,
        source: AttendanceSource.CheckIn,
        checkInAt: NOW,
        assignedWorkLocation: '上海办公室 - 绿地汇',
        checkInMode: CheckInMode.Offline,
        checkInLocation: '上海办公室 - 绿地汇',
      },
      {
        attendanceDate: '2026-08-03',
        status: AttendanceStatus.Leave,
        lateLevel: null,
        source: AttendanceSource.LeaveRegistration,
        checkInAt: null,
        assignedWorkLocation: '线上',
        checkInMode: null,
        checkInLocation: null,
      },
      {
        attendanceDate: '2026-08-04',
        status: AttendanceStatus.Absent,
        lateLevel: LateLevel.Severe,
        source: AttendanceSource.CheckIn,
        checkInAt: NOW,
        assignedWorkLocation: '线上',
        checkInMode: CheckInMode.Online,
        checkInLocation: '线上',
      },
    ];
    const { service, queryPreparationService } = createService({ records });

    const result = await service.getRecords(STUDENT_ID, '2026-08');

    expect(queryPreparationService.prepareStudentMonth).toHaveBeenCalledWith(
      STUDENT_ID,
      '2026-08',
      NOW,
    );
    expect(result.summary).toEqual({
      totalAttendanceDays: 2,
      late: { count: 1, dates: ['2026-08-02'] },
      leave: { count: 1, dates: ['2026-08-03'] },
      absent: { count: 1, dates: ['2026-08-04'] },
      onlineAttendanceDays: 1,
      offlineAttendanceDays: 1,
    });
    expect(result.items).toHaveLength(4);
  });

  it('rejects an invalid student ID before querying records', async () => {
    const { service, attendanceRecordModel } = createService();

    await expect(service.getToday('invalid')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(attendanceRecordModel.findOne).not.toHaveBeenCalled();
  });
});
