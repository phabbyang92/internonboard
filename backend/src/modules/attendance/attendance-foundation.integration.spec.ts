import { ConfigService } from '@nestjs/config';
import { model, Types } from 'mongoose';
import type { Model } from 'mongoose';
import { BusinessClockService } from '../../common/time/business-clock.service';
import type { HrUserDocument } from '../auth/schemas/hr-user.schema';
import { OnboardingStatus, WorkLocation } from '../student/enums/student.enums';
import type { StudentService } from '../student/student.service';
import type { WorkLocationAssignmentDocument } from '../work-location/schemas/work-location-assignment.schema';
import { RegionAccessService } from './access/region-access.service';
import { AttendanceCalendarService } from './attendance-calendar.service';
import { AttendanceEligibilityService } from './attendance-eligibility.service';
import { AttendanceLocationService } from './attendance-location.service';
import { AttendanceCalendarScope } from './enums/attendance-calendar-scope.enum';
import { AttendanceEligibilityReason } from './enums/attendance-eligibility-reason.enum';
import { AttendanceSource } from './enums/attendance-source.enum';
import { CalendarExceptionType } from './enums/calendar-exception-type.enum';
import { RegionCode } from './enums/region-code.enum';
import {
  AttendanceCalendarSchema,
  type AttendanceCalendarDocument,
} from './schemas/attendance-calendar.schema';
import { AttendanceRecordSchema } from './schemas/attendance-record.schema';
import { OfficeNetworkSchema } from './schemas/office-network.schema';

const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const OWNER_HR_ID = '6a574ec45bd0f7b2a8b65b99';
const ASSIGNMENT_ID = '6a574ec45bd0f7b2a8b65c20';
const CALENDAR_ID = '6a574ec45bd0f7b2a8b65c21';
const NOW = new Date('2026-08-05T01:30:00.000Z');

const CalendarValidationModel = model(
  'AttendanceCalendarPhaseOneValidation',
  AttendanceCalendarSchema,
);

function queryResult<T>(value: T) {
  return {
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(value),
      }),
    }),
  };
}

function createFoundation(holiday: Record<string, unknown> | null = null) {
  const configValues: Record<string, string> = {
    ATTENDANCE_TIMEZONE: 'Asia/Shanghai',
    ATTENDANCE_ON_TIME_BEFORE: '10:01',
    ATTENDANCE_LATE_THROUGH: '10:30',
    ATTENDANCE_CHECK_IN_CLOSE_AFTER: '11:00',
  };
  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;
  const clock = new BusinessClockService(config, () => NOW);

  const hrModel = {} as Model<HrUserDocument>;
  const regionAccess = new RegionAccessService(hrModel);
  const assignment = {
    _id: new Types.ObjectId(ASSIGNMENT_ID),
    studentId: new Types.ObjectId(STUDENT_ID),
    workLocation: WorkLocation.ShanghaiOffice,
    effectiveFrom: new Date('2026-07-31T16:00:00.000Z'),
    effectiveTo: null,
  };
  const assignmentModel = {
    findOne: jest.fn().mockReturnValue(queryResult(assignment)),
  };
  const locationService = new AttendanceLocationService(
    assignmentModel as unknown as Model<WorkLocationAssignmentDocument>,
    clock,
    regionAccess,
  );

  const calendarModel = {
    findOne: jest.fn().mockReturnValue(queryResult(holiday)),
  };
  const calendarService = new AttendanceCalendarService(
    calendarModel as unknown as Model<AttendanceCalendarDocument>,
    clock,
  );

  const studentService = {
    updateDueOnboardingStatuses: jest.fn().mockResolvedValue({}),
    findOneById: jest.fn().mockResolvedValue({
      id: STUDENT_ID,
      ownerHrId: OWNER_HR_ID,
      onboardingStatus: OnboardingStatus.Onboarded,
      onboardingStartAt: new Date('2026-07-31T16:00:00.000Z'),
      onboardingEndAt: new Date('2026-08-31T16:00:00.000Z'),
    }),
  };

  return {
    service: new AttendanceEligibilityService(
      studentService as unknown as StudentService,
      clock,
      locationService,
      calendarService,
    ),
    studentService,
    assignmentModel,
    calendarModel,
  };
}

describe('Attendance foundation phase-one acceptance', () => {
  it('accepts an onboarded student on a normal weekday at the effective location', async () => {
    const { service, studentService, assignmentModel, calendarModel } =
      createFoundation();

    const result = await service.evaluateToday(STUDENT_ID);

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(AttendanceEligibilityReason.Eligible);
    expect(result.attendanceDate).toBe('2026-08-05');
    expect(result.location?.workLocation).toBe(WorkLocation.ShanghaiOffice);
    expect(result.location?.regionCode).toBe(RegionCode.Shanghai);
    expect(studentService.updateDueOnboardingStatuses).toHaveBeenCalledWith(
      NOW,
    );
    expect(assignmentModel.findOne).toHaveBeenCalledTimes(1);
    expect(calendarModel.findOne).toHaveBeenCalledTimes(1);
  });

  it('rejects the same student when Shanghai has a regional temporary holiday', async () => {
    const { service } = createFoundation({
      _id: new Types.ObjectId(CALENDAR_ID),
      date: '2026-08-05',
      name: '上海临时假期',
      type: CalendarExceptionType.TemporaryHoliday,
      scope: AttendanceCalendarScope.Region,
      regionCode: RegionCode.Shanghai,
    });

    const result = await service.evaluateToday(STUDENT_ID);

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(AttendanceEligibilityReason.NonWorkday);
    expect(result.workday?.reason).toBe(CalendarExceptionType.TemporaryHoliday);
    expect(result.workday?.holiday?.name).toBe('上海临时假期');
  });

  it('enforces the calendar scope and exception type combinations', async () => {
    const globalTemporaryHoliday = new CalendarValidationModel({
      date: '2026-08-05',
      name: '错误的全国临时假期',
      type: CalendarExceptionType.TemporaryHoliday,
      scope: AttendanceCalendarScope.Global,
      regionCode: null,
      createdByHrId: new Types.ObjectId(OWNER_HR_ID),
      updatedByHrId: new Types.ObjectId(OWNER_HR_ID),
    });
    const regionalPublicHoliday = new CalendarValidationModel({
      date: '2026-08-06',
      name: '错误的地区法定假期',
      type: CalendarExceptionType.PublicHoliday,
      scope: AttendanceCalendarScope.Region,
      regionCode: RegionCode.Shanghai,
      createdByHrId: new Types.ObjectId(OWNER_HR_ID),
      updatedByHrId: new Types.ObjectId(OWNER_HR_ID),
    });

    await expect(globalTemporaryHoliday.validate()).rejects.toThrow(
      '全国日历只能配置法定假期',
    );
    await expect(regionalPublicHoliday.validate()).rejects.toThrow(
      '地区日历只能配置临时假期',
    );
  });

  it('keeps the database uniqueness and query indexes required by phase one', () => {
    const attendanceIndexNames = AttendanceRecordSchema.indexes().map(
      ([, options]) => options.name,
    );
    const calendarIndexNames = AttendanceCalendarSchema.indexes().map(
      ([, options]) => options.name,
    );
    const officeNetworkIndexNames = OfficeNetworkSchema.indexes().map(
      ([, options]) => options.name,
    );

    expect(attendanceIndexNames).toContain('unique_student_attendance_date');
    expect(attendanceIndexNames).toContain(
      'unique_check_in_device_attendance_date',
    );
    expect(calendarIndexNames).toContain(
      'unique_active_attendance_calendar_region_date',
    );
    expect(officeNetworkIndexNames).toContain(
      'unique_office_network_work_location',
    );

    const deviceIndex = AttendanceRecordSchema.indexes().find(
      ([, options]) =>
        options.name === 'unique_check_in_device_attendance_date',
    );
    expect(deviceIndex?.[1].partialFilterExpression).toEqual({
      deviceIdHash: { $type: 'string' },
      source: AttendanceSource.CheckIn,
    });

    const attendanceIndexKeys = AttendanceRecordSchema.indexes().map(
      ([keys]) => keys,
    );
    expect(attendanceIndexKeys).toEqual(
      expect.arrayContaining([
        { ownerHrId: 1, attendanceDate: 1, status: 1 },
        {
          attendanceDate: 1,
          assignedWorkLocation: 1,
          checkInMode: 1,
          status: 1,
        },
        { studentId: 1, attendanceDate: -1 },
      ]),
    );
  });
});
