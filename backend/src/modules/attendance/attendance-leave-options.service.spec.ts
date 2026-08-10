import { BadRequestException } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { BusinessClockService } from '../../common/time/business-clock.service';
import { WorkLocation } from '../student/enums/student.enums';
import type { AttendanceEligibilityService } from './attendance-eligibility.service';
import { AttendanceLeaveOptionsService } from './attendance-leave-options.service';
import { AttendanceEligibilityReason } from './enums/attendance-eligibility-reason.enum';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { CalendarExceptionType } from './enums/calendar-exception-type.enum';
import { LeaveDateOptionReason } from './enums/leave-date-option-reason.enum';
import { RegionCode } from './enums/region-code.enum';
import type { AttendanceEligibilityResult } from './interfaces/attendance-eligibility-result.interface';
import type { AttendanceRecordDocument } from './schemas/attendance-record.schema';

const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const NOW = new Date('2026-08-06T02:00:00.000Z');

function eligible(attendanceDate: string): AttendanceEligibilityResult {
  return {
    eligible: true,
    reason: AttendanceEligibilityReason.Eligible,
    attendanceDate,
    student: {
      id: STUDENT_ID,
      ownerHrId: '6a574ec45bd0f7b2a8b65b99',
      onboardingStatus: 'onboarded',
      onboardingStartAt: new Date('2026-08-01T00:00:00.000Z'),
      onboardingEndAt: null,
    },
    location: {
      assignmentId: '6a574ec45bd0f7b2a8b65c20',
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

function createService(
  existingRecords: Array<{
    attendanceDate: string;
    status: AttendanceStatus;
  }> = [],
) {
  const exec = jest.fn().mockResolvedValue(existingRecords);
  const select = jest.fn().mockReturnValue({ lean: () => ({ exec }) });
  const model = {
    find: jest.fn().mockReturnValue({ select }),
  };
  const clock = {
    now: jest.fn().mockReturnValue(NOW),
    getBusinessDate: jest.fn().mockReturnValue('2026-08-06'),
  };
  const eligibilityService = {
    evaluateMany: jest.fn((_studentId: string, dates: string[]) =>
      Promise.resolve(dates.map(eligible)),
    ),
  };

  return {
    model,
    select,
    eligibilityService,
    service: new AttendanceLeaveOptionsService(
      model as unknown as Model<AttendanceRecordDocument>,
      clock as unknown as BusinessClockService,
      eligibilityService as unknown as AttendanceEligibilityService,
    ),
  };
}

describe('AttendanceLeaveOptionsService', () => {
  it('returns today through the future fourteenth day as 15 options', async () => {
    const { service, model, eligibilityService } = createService();

    const result = await service.getOptions(STUDENT_ID);

    expect(result).toMatchObject({
      startDate: '2026-08-06',
      endDate: '2026-08-20',
      maxDaysAhead: 14,
    });
    expect(result.items).toHaveLength(15);
    expect(result.items[0]).toMatchObject({
      attendanceDate: '2026-08-06',
      selectable: true,
      reason: LeaveDateOptionReason.Available,
      workLocation: WorkLocation.ShanghaiOffice,
    });
    expect(result.items[14].attendanceDate).toBe('2026-08-20');
    expect(eligibilityService.evaluateMany).toHaveBeenCalledWith(
      STUDENT_ID,
      expect.arrayContaining(['2026-08-06', '2026-08-20']),
      NOW,
    );
    expect(model.find).toHaveBeenCalledWith(
      expect.objectContaining({
        attendanceDate: { $gte: '2026-08-06', $lte: '2026-08-20' },
      }),
    );
  });

  it('disables a date that already contains an attendance record', async () => {
    const { service } = createService([
      { attendanceDate: '2026-08-07', status: AttendanceStatus.Late },
      { attendanceDate: '2026-08-08', status: AttendanceStatus.Leave },
      { attendanceDate: '2026-08-09', status: AttendanceStatus.Absent },
    ]);

    const result = await service.getOptions(STUDENT_ID);

    expect(result.items[1]).toMatchObject({
      selectable: false,
      reason: LeaveDateOptionReason.AttendanceAlreadyRecorded,
      existingStatus: AttendanceStatus.Late,
    });
    expect(result.items[2]).toMatchObject({
      reason: LeaveDateOptionReason.LeaveAlreadyRegistered,
      existingStatus: AttendanceStatus.Leave,
    });
    expect(result.items[3]).toMatchObject({
      reason: LeaveDateOptionReason.AbsenceAlreadyRecorded,
      existingStatus: AttendanceStatus.Absent,
    });
  });

  it('maps weekends and configured holidays to explicit disabled reasons', async () => {
    const { service, eligibilityService } = createService();
    eligibilityService.evaluateMany.mockImplementation(
      (_studentId: string, dates: string[]) =>
        Promise.resolve(
          dates.map((date, index) => {
            const result = eligible(date);

            if (index === 0) {
              return {
                ...result,
                eligible: false,
                reason: AttendanceEligibilityReason.NonWorkday,
                workday: {
                  ...result.workday!,
                  isWorkday: false,
                  reason: 'weekend' as const,
                },
              };
            }

            if (index === 1) {
              return {
                ...result,
                eligible: false,
                reason: AttendanceEligibilityReason.NonWorkday,
                workday: {
                  ...result.workday!,
                  isWorkday: false,
                  reason: CalendarExceptionType.TemporaryHoliday,
                  holiday: {
                    id: 'holiday-id',
                    name: '上海临时假期',
                    type: CalendarExceptionType.TemporaryHoliday,
                    scope: 'region',
                    regionCode: RegionCode.Shanghai,
                  },
                },
              };
            }

            return result;
          }),
        ),
    );

    const result = await service.getOptions(STUDENT_ID);

    expect(result.items[0]).toMatchObject({
      selectable: false,
      reason: LeaveDateOptionReason.Weekend,
      message: '周末无需登记出勤',
    });
    expect(result.items[1]).toMatchObject({
      selectable: false,
      reason: LeaveDateOptionReason.TemporaryHoliday,
      message: '上海临时假期',
      holidayName: '上海临时假期',
    });
  });

  it('rejects an invalid student ID before querying MongoDB', async () => {
    const { service, model } = createService();

    await expect(service.getOptions('invalid')).rejects.toThrow(
      BadRequestException,
    );
    expect(model.find).not.toHaveBeenCalled();
  });
});
