import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { BusinessClockService } from '../../common/time/business-clock.service';
import { HrRole } from '../auth/enums/hr-role.enum';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import type { HrUserDocument } from '../auth/schemas/hr-user.schema';
import { OnboardingStatus, WorkLocation } from '../student/enums/student.enums';
import type { StudentService } from '../student/student.service';
import type { WorkLocationAssignmentDocument } from '../work-location/schemas/work-location-assignment.schema';
import { RegionAccessService } from './access/region-access.service';
import { AttendanceCalendarService } from './attendance-calendar.service';
import { AttendanceEligibilityService } from './attendance-eligibility.service';
import { AttendanceLeavePolicyService } from './attendance-leave-policy.service';
import { AttendanceLeaveRegistrationService } from './attendance-leave-registration.service';
import { AttendanceLocationService } from './attendance-location.service';
import { AttendanceCalendarScope } from './enums/attendance-calendar-scope.enum';
import { AttendanceEligibilityReason } from './enums/attendance-eligibility-reason.enum';
import { AttendanceErrorCode } from './enums/attendance-error-code.enum';
import { AttendanceSource } from './enums/attendance-source.enum';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { CalendarExceptionType } from './enums/calendar-exception-type.enum';
import { RegionCode } from './enums/region-code.enum';
import type { AttendanceCalendarDocument } from './schemas/attendance-calendar.schema';
import type { AttendanceRecordDocument } from './schemas/attendance-record.schema';

const SHANGHAI_STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const BEIJING_STUDENT_ID = '6a574ec45bd0f7b2a8b65a03';
const OWNER_HR_ID = '6a574ec45bd0f7b2a8b65b99';
const SHANGHAI_ASSIGNMENT_ID = '6a574ec45bd0f7b2a8b65c20';
const BEIJING_ASSIGNMENT_ID = '6a574ec45bd0f7b2a8b65c21';
const NOW = new Date('2026-08-06T02:00:00.000Z');

interface CalendarFixtureRecord {
  _id: Types.ObjectId;
  date: string;
  name: string;
  type: CalendarExceptionType;
  scope: AttendanceCalendarScope;
  regionCode: RegionCode | null;
}

type StoredAttendanceRecord = Record<string, unknown> & {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  attendanceDate: string;
  status: AttendanceStatus;
  source: AttendanceSource;
  leaveBatchId: string;
};

function chainQuery<T>(value: T) {
  const query = {
    sort: jest.fn(),
    select: jest.fn(),
    lean: jest.fn(),
    exec: jest.fn().mockResolvedValue(value),
  };
  query.sort.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.lean.mockReturnValue(query);

  return query;
}

function createClock(): BusinessClockService {
  const configValues: Record<string, string> = {
    ATTENDANCE_TIMEZONE: 'Asia/Shanghai',
    ATTENDANCE_ON_TIME_BEFORE: '10:01',
    ATTENDANCE_LATE_THROUGH: '10:30',
    ATTENDANCE_CHECK_IN_CLOSE_AFTER: '11:00',
  };
  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;

  return new BusinessClockService(config, () => NOW);
}

function createPhaseThreeFixture(holidays: CalendarFixtureRecord[] = []) {
  const clock = createClock();
  const regionAccess = new RegionAccessService({} as Model<HrUserDocument>);
  const assignments = [
    {
      _id: new Types.ObjectId(SHANGHAI_ASSIGNMENT_ID),
      studentId: new Types.ObjectId(SHANGHAI_STUDENT_ID),
      workLocation: WorkLocation.ShanghaiOffice,
      effectiveFrom: new Date('2026-07-31T16:00:00.000Z'),
      effectiveTo: null,
    },
    {
      _id: new Types.ObjectId(BEIJING_ASSIGNMENT_ID),
      studentId: new Types.ObjectId(BEIJING_STUDENT_ID),
      workLocation: WorkLocation.BeijingOffice,
      effectiveFrom: new Date('2026-07-31T16:00:00.000Z'),
      effectiveTo: null,
    },
  ];
  const assignmentModel = {
    findOne: jest.fn((filter: { studentId: Types.ObjectId }) =>
      chainQuery(
        assignments.find(
          (assignment) =>
            assignment.studentId.toString() === filter.studentId.toString(),
        ) ?? null,
      ),
    ),
  };
  const locationService = new AttendanceLocationService(
    assignmentModel as unknown as Model<WorkLocationAssignmentDocument>,
    clock,
    regionAccess,
  );

  const calendarModel = {
    findOne: jest.fn(
      (filter: {
        date: string;
        $or: Array<{ regionCode: RegionCode | null }>;
      }) => {
        const requestedRegion = filter.$or[1]?.regionCode;
        const holiday = holidays.find(
          (item) =>
            item.date === filter.date &&
            (item.scope === AttendanceCalendarScope.Global ||
              item.regionCode === requestedRegion),
        );

        return chainQuery(holiday ?? null);
      },
    ),
  };
  const calendarService = new AttendanceCalendarService(
    calendarModel as unknown as Model<AttendanceCalendarDocument>,
    clock,
  );

  const students = new Map(
    [SHANGHAI_STUDENT_ID, BEIJING_STUDENT_ID].map((id) => [
      id,
      {
        id,
        ownerHrId: OWNER_HR_ID,
        onboardingStatus: OnboardingStatus.Onboarded,
        onboardingStartAt: new Date('2026-07-31T16:00:00.000Z'),
        onboardingEndAt: new Date('2026-08-31T16:00:00.000Z'),
      },
    ]),
  );
  const studentService = {
    updateDueOnboardingStatuses: jest.fn().mockResolvedValue({}),
    findOneById: jest.fn((studentId: string) =>
      Promise.resolve(students.get(studentId)),
    ),
  };
  const eligibilityService = new AttendanceEligibilityService(
    studentService as unknown as StudentService,
    clock,
    locationService,
    calendarService,
  );
  const leavePolicyService = new AttendanceLeavePolicyService(clock);

  // 这个内存模型模拟学生每日唯一索引，便于稳定验证并发竞争和批次回滚。
  const attendanceRecords: StoredAttendanceRecord[] = [];
  const attendanceRecordModel = {
    find: jest.fn(
      (filter: {
        studentId: Types.ObjectId;
        attendanceDate: { $in: string[] };
      }) =>
        chainQuery(
          attendanceRecords
            .filter(
              (record) =>
                record.studentId.toString() === filter.studentId.toString() &&
                filter.attendanceDate.$in.includes(record.attendanceDate),
            )
            .map((record) => ({
              attendanceDate: record.attendanceDate,
              status: record.status,
            })),
        ),
    ),
    insertMany: jest.fn((rows: Array<Record<string, unknown>>) => {
      const inserted: StoredAttendanceRecord[] = [];

      for (const row of rows) {
        const studentId = row.studentId as Types.ObjectId;
        const attendanceDate = row.attendanceDate as string;
        const duplicate = attendanceRecords.some(
          (record) =>
            record.studentId.toString() === studentId.toString() &&
            record.attendanceDate === attendanceDate,
        );

        if (duplicate) {
          const error = Object.assign(new Error('duplicate attendance'), {
            code: 11000,
            keyPattern: { studentId: 1, attendanceDate: 1 },
          });
          throw error;
        }

        const record = {
          ...row,
          _id: new Types.ObjectId(),
        } as StoredAttendanceRecord;
        attendanceRecords.push(record);
        inserted.push(record);
      }

      return Promise.resolve(inserted);
    }),
    deleteMany: jest.fn(
      (filter: { leaveBatchId: string; source: AttendanceSource }) => ({
        exec: jest.fn().mockImplementation(() => {
          let deletedCount = 0;

          for (let index = attendanceRecords.length - 1; index >= 0; index--) {
            const record = attendanceRecords[index];

            if (
              record.leaveBatchId === filter.leaveBatchId &&
              record.source === filter.source
            ) {
              attendanceRecords.splice(index, 1);
              deletedCount++;
            }
          }

          return Promise.resolve({ deletedCount });
        }),
      }),
    ),
  };
  const registrationService = new AttendanceLeaveRegistrationService(
    attendanceRecordModel as unknown as Model<AttendanceRecordDocument>,
    clock,
    eligibilityService,
    leavePolicyService,
  );

  return {
    attendanceRecords,
    attendanceRecordModel,
    eligibilityService,
    registrationService,
  };
}

function holiday(
  date: string,
  scope: AttendanceCalendarScope,
  regionCode: RegionCode | null,
): CalendarFixtureRecord {
  return {
    _id: new Types.ObjectId(),
    date,
    name:
      scope === AttendanceCalendarScope.Global
        ? '全国法定假期'
        : '地区临时假期',
    type:
      scope === AttendanceCalendarScope.Global
        ? CalendarExceptionType.PublicHoliday
        : CalendarExceptionType.TemporaryHoliday,
    scope,
    regionCode,
  };
}

describe('Attendance phase-three acceptance', () => {
  it('applies a regional holiday only to students working in that region', async () => {
    const fixture = createPhaseThreeFixture([
      holiday(
        '2026-08-07',
        AttendanceCalendarScope.Region,
        RegionCode.Shanghai,
      ),
    ]);

    const [shanghai, beijing] = await Promise.all([
      fixture.eligibilityService.evaluate(
        SHANGHAI_STUDENT_ID,
        '2026-08-07',
        NOW,
      ),
      fixture.eligibilityService.evaluate(
        BEIJING_STUDENT_ID,
        '2026-08-07',
        NOW,
      ),
    ]);

    expect(shanghai).toMatchObject({
      eligible: false,
      reason: AttendanceEligibilityReason.NonWorkday,
    });
    expect(beijing).toMatchObject({
      eligible: true,
      reason: AttendanceEligibilityReason.Eligible,
    });

    await expect(
      fixture.registrationService.register(SHANGHAI_STUDENT_ID, {
        dates: ['2026-08-07'],
      }),
    ).rejects.toMatchObject({
      response: { code: AttendanceErrorCode.AttendanceNotRequired },
    });
    await expect(
      fixture.registrationService.register(BEIJING_STUDENT_ID, {
        dates: ['2026-08-07'],
      }),
    ).resolves.toMatchObject({ dates: ['2026-08-07'] });
    expect(fixture.attendanceRecords).toHaveLength(1);
    expect(fixture.attendanceRecords[0]).toMatchObject({
      attendanceDate: '2026-08-07',
      status: AttendanceStatus.Leave,
      assignedWorkLocation: WorkLocation.BeijingOffice,
    });
  });

  it('prevents leave registration for every region on a global holiday', async () => {
    const fixture = createPhaseThreeFixture([
      holiday('2026-08-10', AttendanceCalendarScope.Global, null),
    ]);

    await expect(
      fixture.registrationService.register(SHANGHAI_STUDENT_ID, {
        dates: ['2026-08-10'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      fixture.registrationService.register(BEIJING_STUDENT_ID, {
        dates: ['2026-08-10'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fixture.attendanceRecords).toHaveLength(0);
    expect(fixture.attendanceRecordModel.insertMany).not.toHaveBeenCalled();
  });

  it('keeps one leave record when two requests race for the same student and date', async () => {
    const fixture = createPhaseThreeFixture();

    const results = await Promise.allSettled([
      fixture.registrationService.register(SHANGHAI_STUDENT_ID, {
        dates: ['2026-08-11'],
      }),
      fixture.registrationService.register(SHANGHAI_STUDENT_ID, {
        dates: ['2026-08-11'],
      }),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejected?.reason).toMatchObject({
      response: { code: AttendanceErrorCode.LeaveAlreadyRegistered },
    });
    expect(fixture.attendanceRecords).toHaveLength(1);
    expect(fixture.attendanceRecords[0]).toMatchObject({
      attendanceDate: '2026-08-11',
      status: AttendanceStatus.Leave,
      source: AttendanceSource.LeaveRegistration,
    });
  });

  it('uses current database region permissions instead of stale login claims', async () => {
    let currentHr = {
      role: HrRole.Hr,
      managedRegionCodes: [RegionCode.Shanghai],
    };
    const hrModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn(() => Promise.resolve(currentHr)),
          }),
        }),
      }),
    };
    const service = new RegionAccessService(
      hrModel as unknown as Model<HrUserDocument>,
    );
    const staleAdminAccess: HrAccessContext = {
      hrUserId: OWNER_HR_ID,
      role: HrRole.Admin,
    };

    await expect(
      service.assertCanManageCalendar(
        staleAdminAccess,
        AttendanceCalendarScope.Region,
        RegionCode.Shanghai,
      ),
    ).resolves.toBeUndefined();
    await expect(
      service.assertCanManageCalendar(
        staleAdminAccess,
        AttendanceCalendarScope.Region,
        RegionCode.Beijing,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.assertCanManageCalendar(
        staleAdminAccess,
        AttendanceCalendarScope.Global,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    currentHr = {
      role: HrRole.Admin,
      managedRegionCodes: [],
    };
    await expect(
      service.assertCanManageCalendar(
        staleAdminAccess,
        AttendanceCalendarScope.Global,
        null,
      ),
    ).resolves.toBeUndefined();
  });
});
