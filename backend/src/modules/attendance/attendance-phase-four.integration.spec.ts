import { ConfigService } from '@nestjs/config';
import type { Model, QueryFilter } from 'mongoose';
import { Types } from 'mongoose';
import { BusinessClockService } from '../../common/time/business-clock.service';
import { HrRole } from '../auth/enums/hr-role.enum';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { WorkLocation } from '../student/enums/student.enums';
import type {
  Student,
  StudentDocument,
} from '../student/schemas/student.schema';
import type { StudentService } from '../student/student.service';
import type { AttendanceCalendarService } from './attendance-calendar.service';
import type { AttendanceLocationService } from './attendance-location.service';
import { AttendanceQueryPreparationService } from './attendance-query-preparation.service';
import { AttendanceReconciliationService } from './attendance-reconciliation.service';
import { AttendanceSource } from './enums/attendance-source.enum';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { RegionCode } from './enums/region-code.enum';
import type { AttendanceRecordDocument } from './schemas/attendance-record.schema';
import { AttendanceAbsenceScheduler } from './schedulers/attendance-absence.scheduler';

const ATTENDANCE_DATE = '2026-08-06';
const NOW = new Date('2026-08-06T03:01:00.000Z');
const OWNER_ONE_ID = '6a574ec45bd0f7b2a8b65b91';
const OWNER_TWO_ID = '6a574ec45bd0f7b2a8b65b92';
const STUDENT_ONE_ID = '6a574ec45bd0f7b2a8b65a01';
const STUDENT_TWO_ID = '6a574ec45bd0f7b2a8b65a02';
const STUDENT_WITH_LEAVE_ID = '6a574ec45bd0f7b2a8b65a03';
const ASSIGNMENT_IDS = [
  '6a574ec45bd0f7b2a8b65c01',
  '6a574ec45bd0f7b2a8b65c02',
  '6a574ec45bd0f7b2a8b65c03',
];

interface FixtureStudent {
  _id: Types.ObjectId;
  ownerHrId: Types.ObjectId;
}

type StoredAttendanceRecord = Record<string, unknown> & {
  studentId: Types.ObjectId;
  attendanceDate: string;
  status: AttendanceStatus;
  source: AttendanceSource;
};

function chainQuery<T>(value: T) {
  const query = {
    select: jest.fn(),
    lean: jest.fn(),
    exec: jest.fn().mockResolvedValue(value),
  };
  query.select.mockReturnValue(query);
  query.lean.mockReturnValue(query);

  return query;
}

function objectIdEquals(value: unknown, expected: Types.ObjectId): boolean {
  return value instanceof Types.ObjectId && value.equals(expected);
}

function createPhaseFourFixture(options?: {
  cronEnabled?: boolean;
  locationFailureStudentId?: string;
  includeProtectedLeave?: boolean;
}) {
  const configValues: Record<string, string> = {
    ATTENDANCE_TIMEZONE: 'Asia/Shanghai',
    ATTENDANCE_ON_TIME_BEFORE: '10:01',
    ATTENDANCE_LATE_THROUGH: '10:30',
    ATTENDANCE_CHECK_IN_CLOSE_AFTER: '11:00',
    ATTENDANCE_CRON_ENABLED: options?.cronEnabled ? 'true' : 'false',
  };
  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;
  const clock = new BusinessClockService(config, () => NOW);
  const students: FixtureStudent[] = [
    {
      _id: new Types.ObjectId(STUDENT_ONE_ID),
      ownerHrId: new Types.ObjectId(OWNER_ONE_ID),
    },
    {
      _id: new Types.ObjectId(STUDENT_TWO_ID),
      ownerHrId: new Types.ObjectId(OWNER_TWO_ID),
    },
    {
      _id: new Types.ObjectId(STUDENT_WITH_LEAVE_ID),
      ownerHrId: new Types.ObjectId(OWNER_ONE_ID),
    },
  ];
  const records: StoredAttendanceRecord[] = [];

  if (options?.includeProtectedLeave) {
    records.push({
      studentId: new Types.ObjectId(STUDENT_WITH_LEAVE_ID),
      attendanceDate: ATTENDANCE_DATE,
      status: AttendanceStatus.Leave,
      source: AttendanceSource.LeaveRegistration,
      preservedMarker: 'do-not-overwrite',
    });
  }

  const studentModel = {
    find: jest.fn((filter: QueryFilter<Student>) => {
      const scopedStudents = students.filter((student) => {
        if (filter._id && !objectIdEquals(filter._id, student._id)) {
          return false;
        }

        if (
          filter.ownerHrId &&
          !objectIdEquals(filter.ownerHrId, student.ownerHrId)
        ) {
          return false;
        }

        return true;
      });

      return chainQuery(scopedStudents);
    }),
  };
  const attendanceRecordModel = {
    find: jest.fn(
      (filter: {
        attendanceDate: string;
        studentId: { $in: Types.ObjectId[] };
      }) =>
        chainQuery(
          records
            .filter(
              (record) =>
                record.attendanceDate === filter.attendanceDate &&
                filter.studentId.$in.some((studentId) =>
                  studentId.equals(record.studentId),
                ),
            )
            .map((record) => ({ studentId: record.studentId })),
        ),
    ),
    updateOne: jest.fn(
      (
        filter: { studentId: Types.ObjectId; attendanceDate: string },
        update: { $setOnInsert: StoredAttendanceRecord },
      ) => ({
        exec: jest.fn(async () => {
          // 让并发调用都经过异步边界，再由这个原子段决定最终写入者。
          await Promise.resolve();
          const existing = records.find(
            (record) =>
              record.studentId.equals(filter.studentId) &&
              record.attendanceDate === filter.attendanceDate,
          );

          if (existing) {
            return {
              acknowledged: true,
              matchedCount: 1,
              modifiedCount: 0,
              upsertedCount: 0,
            };
          }

          records.push(update.$setOnInsert);
          return {
            acknowledged: true,
            matchedCount: 0,
            modifiedCount: 0,
            upsertedCount: 1,
            upsertedId: new Types.ObjectId(),
          };
        }),
      }),
    ),
  };
  const studentService = {
    updateDueOnboardingStatuses: jest.fn().mockResolvedValue({}),
  };
  const locationService = {
    findEffectiveLocation: jest.fn((studentId: string) => {
      if (studentId === options?.locationFailureStudentId) {
        return Promise.reject(new Error('地点服务暂时不可用'));
      }

      const index = [
        STUDENT_ONE_ID,
        STUDENT_TWO_ID,
        STUDENT_WITH_LEAVE_ID,
      ].indexOf(studentId);

      return Promise.resolve({
        assignmentId: ASSIGNMENT_IDS[index],
        studentId,
        workLocation: WorkLocation.ShanghaiOffice,
        regionCode: RegionCode.Shanghai,
        effectiveFrom: new Date('2026-07-31T16:00:00.000Z'),
        effectiveTo: null,
      });
    }),
  };
  const calendarService = {
    isWorkday: jest.fn().mockResolvedValue({
      attendanceDate: ATTENDANCE_DATE,
      regionCode: RegionCode.Shanghai,
      isWorkday: true,
      reason: 'weekday',
      holiday: null,
    }),
  };
  const reconciliationService = new AttendanceReconciliationService(
    studentModel as unknown as Model<StudentDocument>,
    attendanceRecordModel as unknown as Model<AttendanceRecordDocument>,
    studentService as unknown as StudentService,
    clock,
    locationService as unknown as AttendanceLocationService,
    calendarService as unknown as AttendanceCalendarService,
  );
  const queryPreparationService = new AttendanceQueryPreparationService(
    reconciliationService,
    clock,
  );
  const scheduler = new AttendanceAbsenceScheduler(
    config,
    reconciliationService,
    clock,
  );

  return {
    records,
    studentModel,
    attendanceRecordModel,
    reconciliationService,
    queryPreparationService,
    scheduler,
  };
}

const ADMIN_ACCESS: HrAccessContext = {
  hrUserId: OWNER_ONE_ID,
  role: HrRole.Admin,
};

const OWNER_ONE_ACCESS: HrAccessContext = {
  hrUserId: OWNER_ONE_ID,
  role: HrRole.Hr,
};

describe('Attendance phase-four acceptance', () => {
  it('scopes normal HR reconciliation, preserves existing records, then lets Admin finish globally', async () => {
    const fixture = createPhaseFourFixture({ includeProtectedLeave: true });
    const protectedLeave = fixture.records[0];

    const ownerResult = await fixture.queryPreparationService.prepareHrDaily(
      ATTENDANCE_DATE,
      OWNER_ONE_ACCESS,
      NOW,
    );

    expect(ownerResult).toMatchObject({
      scannedCount: 2,
      createdCount: 1,
      skippedCount: 1,
      failedCount: 0,
    });
    expect(
      fixture.records.some((record) =>
        record.studentId.equals(new Types.ObjectId(STUDENT_TWO_ID)),
      ),
    ).toBe(false);
    expect(fixture.records[0]).toBe(protectedLeave);
    expect(protectedLeave).toMatchObject({
      status: AttendanceStatus.Leave,
      source: AttendanceSource.LeaveRegistration,
      preservedMarker: 'do-not-overwrite',
    });

    const adminResult = await fixture.queryPreparationService.prepareHrDaily(
      ATTENDANCE_DATE,
      ADMIN_ACCESS,
      NOW,
    );

    expect(adminResult).toMatchObject({
      scannedCount: 3,
      createdCount: 1,
      skippedCount: 2,
      failedCount: 0,
    });
    expect(fixture.records).toHaveLength(3);
  });

  it('keeps Cron and later query reconciliation idempotent', async () => {
    const fixture = createPhaseFourFixture({ cronEnabled: true });

    await fixture.scheduler.reconcileDailyAbsences();
    const queryResult = await fixture.queryPreparationService.prepareHrDaily(
      ATTENDANCE_DATE,
      ADMIN_ACCESS,
      NOW,
    );

    expect(fixture.records).toHaveLength(3);
    expect(queryResult).toMatchObject({
      createdCount: 0,
      skippedCount: 3,
      failedCount: 0,
    });
  });

  it('creates one final record per student when two reconciliations race', async () => {
    const fixture = createPhaseFourFixture();

    const results = await Promise.all([
      fixture.reconciliationService.reconcileDate(ATTENDANCE_DATE, NOW),
      fixture.reconciliationService.reconcileDate(ATTENDANCE_DATE, NOW),
    ]);

    expect(fixture.records).toHaveLength(3);
    expect(
      new Set(fixture.records.map((record) => record.studentId.toString()))
        .size,
    ).toBe(3);
    expect(results.reduce((sum, result) => sum + result.createdCount, 0)).toBe(
      3,
    );
  });

  it('returns an isolated failure while still creating other absence records', async () => {
    const fixture = createPhaseFourFixture({
      locationFailureStudentId: STUDENT_ONE_ID,
    });

    const result = await fixture.queryPreparationService.prepareHrDaily(
      ATTENDANCE_DATE,
      ADMIN_ACCESS,
      NOW,
    );

    expect(result).toMatchObject({
      scannedCount: 3,
      createdCount: 2,
      skippedCount: 0,
      failedCount: 1,
      failures: [
        {
          studentId: STUDENT_ONE_ID,
          attendanceDate: ATTENDANCE_DATE,
          message: '地点服务暂时不可用',
        },
      ],
    });
    expect(fixture.records).toHaveLength(2);
  });
});
