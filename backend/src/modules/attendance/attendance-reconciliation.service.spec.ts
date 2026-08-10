import { BadRequestException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { BusinessClockService } from '../../common/time/business-clock.service';
import { WorkLocation } from '../student/enums/student.enums';
import type { StudentDocument } from '../student/schemas/student.schema';
import type { StudentService } from '../student/student.service';
import type { AttendanceCalendarService } from './attendance-calendar.service';
import { AttendanceSource } from './enums/attendance-source.enum';
import { AttendanceStatus } from './enums/attendance-status.enum';
import type { AttendanceLocationService } from './attendance-location.service';
import { AttendanceReconciliationService } from './attendance-reconciliation.service';
import { RegionCode } from './enums/region-code.enum';
import type { AttendanceLocationResult } from './interfaces/attendance-location-result.interface';
import type { AttendanceRecordDocument } from './schemas/attendance-record.schema';

const STARTED_AT = new Date('2026-08-06T03:01:00.000Z');
const COMPLETED_AT = new Date('2026-08-06T03:01:01.000Z');
const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const SECOND_STUDENT_ID = '6a574ec45bd0f7b2a8b65a03';
const THIRD_STUDENT_ID = '6a574ec45bd0f7b2a8b65a04';
const FOURTH_STUDENT_ID = '6a574ec45bd0f7b2a8b65a05';
const OWNER_HR_ID = '6a574ec45bd0f7b2a8b65b99';
const ASSIGNMENT_ID = '6a574ec45bd0f7b2a8b65c20';

interface StudentRow {
  _id: Types.ObjectId;
  ownerHrId: Types.ObjectId;
}

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

function studentRow(id: string): StudentRow {
  return {
    _id: new Types.ObjectId(id),
    ownerHrId: new Types.ObjectId(OWNER_HR_ID),
  };
}

function location(
  studentId: string,
  regionCode: RegionCode,
  workLocation: WorkLocation,
): AttendanceLocationResult {
  return {
    assignmentId: ASSIGNMENT_ID,
    studentId,
    workLocation,
    regionCode,
    effectiveFrom: new Date('2026-07-31T16:00:00.000Z'),
    effectiveTo: null,
  };
}

function createService(options?: {
  students?: StudentRow[];
  existingStudentIds?: string[];
  locations?: Record<string, AttendanceLocationResult | null>;
  locationErrorStudentId?: string;
  nonWorkdayRegions?: RegionCode[];
  businessDate?: string;
  attendanceWindow?: 'on_time' | 'late' | 'severe' | 'closed';
  createErrorStudentIds?: string[];
  duplicateErrorStudentIds?: string[];
  preexistingWriteStudentIds?: string[];
}) {
  const clock = {
    now: jest.fn().mockReturnValue(COMPLETED_AT),
    getBusinessDate: jest
      .fn()
      .mockReturnValue(options?.businessDate ?? '2026-08-06'),
    getAttendanceWindow: jest
      .fn()
      .mockReturnValue(options?.attendanceWindow ?? 'closed'),
  };
  const students = options?.students ?? [];
  const existingRecords = (options?.existingStudentIds ?? []).map(
    (studentId) => ({ studentId: new Types.ObjectId(studentId) }),
  );
  const studentModel = {
    find: jest.fn().mockReturnValue(chainQuery(students)),
  };
  const persistedKeys = new Set(
    (options?.preexistingWriteStudentIds ?? []).map(
      (studentId) => `${studentId}:2026-08-06`,
    ),
  );
  const attendanceRecordModel = {
    find: jest.fn().mockReturnValue(chainQuery(existingRecords)),
    updateOne: jest.fn(
      (filter: { studentId: Types.ObjectId; attendanceDate: string }) => ({
        exec: jest.fn(() => {
          const studentId = filter.studentId.toString();
          const key = `${studentId}:${filter.attendanceDate}`;

          if ((options?.createErrorStudentIds ?? []).includes(studentId)) {
            return Promise.reject(new Error('缺勤写入失败'));
          }

          if ((options?.duplicateErrorStudentIds ?? []).includes(studentId)) {
            return Promise.reject(
              Object.assign(
                new Error('duplicate key unique_student_attendance_date'),
                {
                  code: 11000,
                  keyPattern: { studentId: 1, attendanceDate: 1 },
                },
              ),
            );
          }

          if (persistedKeys.has(key)) {
            return Promise.resolve({
              acknowledged: true,
              matchedCount: 1,
              modifiedCount: 0,
              upsertedCount: 0,
            });
          }

          persistedKeys.add(key);
          return Promise.resolve({
            acknowledged: true,
            matchedCount: 0,
            modifiedCount: 0,
            upsertedCount: 1,
            upsertedId: new Types.ObjectId(),
          });
        }),
      }),
    ),
  };
  const studentService = {
    updateDueOnboardingStatuses: jest.fn().mockResolvedValue({}),
  };
  const locationService = {
    findEffectiveLocation: jest.fn((studentId: string) => {
      if (studentId === options?.locationErrorStudentId) {
        return Promise.reject(new Error('地点查询失败'));
      }

      return Promise.resolve(options?.locations?.[studentId] ?? null);
    }),
  };
  const calendarService = {
    isWorkday: jest.fn((attendanceDate: string, regionCode: RegionCode) =>
      Promise.resolve({
        attendanceDate,
        regionCode,
        isWorkday: !(options?.nonWorkdayRegions ?? []).includes(regionCode),
        reason: 'weekday',
        holiday: null,
      }),
    ),
  };

  return {
    clock,
    studentModel,
    attendanceRecordModel,
    studentService,
    locationService,
    calendarService,
    service: new AttendanceReconciliationService(
      studentModel as unknown as Model<StudentDocument>,
      attendanceRecordModel as unknown as Model<AttendanceRecordDocument>,
      studentService as unknown as StudentService,
      clock as unknown as BusinessClockService,
      locationService as unknown as AttendanceLocationService,
      calendarService as unknown as AttendanceCalendarService,
    ),
  };
}

describe('AttendanceReconciliationService', () => {
  it('prepares a single-date reconciliation result', async () => {
    const { service } = createService();

    await expect(
      service.reconcileDate('2026-08-06', STARTED_AT),
    ).resolves.toEqual({
      startDate: '2026-08-06',
      endDate: '2026-08-06',
      studentId: null,
      startedAt: STARTED_AT,
      completedAt: COMPLETED_AT,
      scannedCount: 0,
      createdCount: 0,
      skippedCount: 0,
      failedCount: 0,
      failures: [],
    });
  });

  it('prepares an inclusive date-range reconciliation result', async () => {
    const { service } = createService();

    const result = await service.reconcileRange(
      '2026-08-01',
      '2026-08-06',
      STARTED_AT,
    );

    expect(result).toMatchObject({
      startDate: '2026-08-01',
      endDate: '2026-08-06',
      studentId: null,
    });
  });

  it('finds only students who need attendance and have no existing record', async () => {
    const shanghaiLocation = location(
      FOURTH_STUDENT_ID,
      RegionCode.Shanghai,
      WorkLocation.ShanghaiOffice,
    );
    const beijingLocation = location(
      THIRD_STUDENT_ID,
      RegionCode.Beijing,
      WorkLocation.BeijingOffice,
    );
    const { service, calendarService, studentService } = createService({
      students: [
        studentRow(STUDENT_ID),
        studentRow(SECOND_STUDENT_ID),
        studentRow(THIRD_STUDENT_ID),
        studentRow(FOURTH_STUDENT_ID),
      ],
      existingStudentIds: [STUDENT_ID],
      locations: {
        [SECOND_STUDENT_ID]: null,
        [THIRD_STUDENT_ID]: beijingLocation,
        [FOURTH_STUDENT_ID]: shanghaiLocation,
      },
      nonWorkdayRegions: [RegionCode.Beijing],
    });

    await expect(
      service.scanCandidates('2026-08-06', '2026-08-06', null, STARTED_AT),
    ).resolves.toEqual({
      startDate: '2026-08-06',
      endDate: '2026-08-06',
      studentId: null,
      scannedCount: 4,
      skippedCount: 3,
      failedCount: 0,
      failures: [],
      candidates: [
        {
          studentId: FOURTH_STUDENT_ID,
          ownerHrId: OWNER_HR_ID,
          attendanceDate: '2026-08-06',
          assignedWorkLocation: WorkLocation.ShanghaiOffice,
          assignedWorkLocationAssignmentId: ASSIGNMENT_ID,
        },
      ],
    });
    expect(studentService.updateDueOnboardingStatuses).toHaveBeenCalledTimes(1);
    expect(calendarService.isWorkday).toHaveBeenCalledTimes(2);
  });

  it('keeps scanning when one student location lookup fails', async () => {
    const { service } = createService({
      students: [studentRow(STUDENT_ID), studentRow(SECOND_STUDENT_ID)],
      locationErrorStudentId: STUDENT_ID,
      locations: {
        [SECOND_STUDENT_ID]: location(
          SECOND_STUDENT_ID,
          RegionCode.Shanghai,
          WorkLocation.ShanghaiOffice,
        ),
      },
    });

    const result = await service.scanCandidates(
      '2026-08-06',
      '2026-08-06',
      null,
      STARTED_AT,
    );

    expect(result.failedCount).toBe(1);
    expect(result.failures).toEqual([
      {
        studentId: STUDENT_ID,
        attendanceDate: '2026-08-06',
        message: '地点查询失败',
      },
    ]);
    expect(result.candidates).toHaveLength(1);
  });

  it('scans an inclusive date range after refreshing statuses once', async () => {
    const { service, studentService } = createService({
      students: [studentRow(STUDENT_ID)],
      locations: {
        [STUDENT_ID]: location(
          STUDENT_ID,
          RegionCode.Shanghai,
          WorkLocation.ShanghaiOffice,
        ),
      },
    });

    const result = await service.scanCandidates(
      '2026-08-05',
      '2026-08-06',
      null,
      STARTED_AT,
    );

    expect(result.scannedCount).toBe(2);
    expect(result.candidates.map((item) => item.attendanceDate)).toEqual([
      '2026-08-05',
      '2026-08-06',
    ]);
    expect(studentService.updateDueOnboardingStatuses).toHaveBeenCalledTimes(1);
  });

  it('limits a student scan at the database query level', async () => {
    const { service, studentModel } = createService();

    await service.scanCandidates(
      '2026-08-06',
      '2026-08-06',
      STUDENT_ID,
      STARTED_AT,
    );

    expect(studentModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: new Types.ObjectId(STUDENT_ID),
      }),
    );
  });

  it('writes an automatic absence with backend-owned snapshots', async () => {
    const { service, attendanceRecordModel } = createService({
      students: [studentRow(STUDENT_ID)],
      locations: {
        [STUDENT_ID]: location(
          STUDENT_ID,
          RegionCode.Shanghai,
          WorkLocation.ShanghaiOffice,
        ),
      },
    });

    const result = await service.reconcileDate('2026-08-06', STARTED_AT);

    expect(result).toMatchObject({
      scannedCount: 1,
      createdCount: 1,
      skippedCount: 0,
      failedCount: 0,
    });
    expect(attendanceRecordModel.updateOne).toHaveBeenCalledWith(
      {
        studentId: new Types.ObjectId(STUDENT_ID),
        attendanceDate: '2026-08-06',
      },
      {
        $setOnInsert: {
          studentId: new Types.ObjectId(STUDENT_ID),
          ownerHrId: new Types.ObjectId(OWNER_HR_ID),
          attendanceDate: '2026-08-06',
          status: AttendanceStatus.Absent,
          lateLevel: null,
          source: AttendanceSource.AbsenceScheduler,
          checkInAt: null,
          checkInAttemptAt: null,
          assignedWorkLocation: WorkLocation.ShanghaiOffice,
          assignedWorkLocationAssignmentId: new Types.ObjectId(ASSIGNMENT_ID),
          checkInMode: null,
          checkInLocation: null,
          deviceIdHash: null,
          matchedOfficeNetworkId: null,
          ipMatchSucceeded: null,
          leaveBatchId: null,
          leaveRegisteredAt: null,
          createdAt: STARTED_AT,
          updatedAt: STARTED_AT,
        },
      },
      { upsert: true, timestamps: false },
    );
  });

  it('does not create today absence before the check-in window closes', async () => {
    const beforeClose = new Date('2026-08-06T02:59:00.000Z');
    const { service, attendanceRecordModel } = createService({
      students: [studentRow(STUDENT_ID)],
      locations: {
        [STUDENT_ID]: location(
          STUDENT_ID,
          RegionCode.Shanghai,
          WorkLocation.ShanghaiOffice,
        ),
      },
      attendanceWindow: 'severe',
    });

    const result = await service.reconcileDate('2026-08-06', beforeClose);

    expect(result).toMatchObject({
      scannedCount: 1,
      createdCount: 0,
      skippedCount: 1,
      failedCount: 0,
    });
    expect(attendanceRecordModel.updateOne).not.toHaveBeenCalled();
  });

  it('does not create absence records for future dates', async () => {
    const { service, attendanceRecordModel } = createService({
      students: [studentRow(STUDENT_ID)],
      locations: {
        [STUDENT_ID]: location(
          STUDENT_ID,
          RegionCode.Shanghai,
          WorkLocation.ShanghaiOffice,
        ),
      },
    });

    const result = await service.reconcileDate('2026-08-07', STARTED_AT);

    expect(result.createdCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(attendanceRecordModel.updateOne).not.toHaveBeenCalled();
  });

  it('continues writing after one candidate fails', async () => {
    const { service, attendanceRecordModel } = createService({
      students: [studentRow(STUDENT_ID), studentRow(SECOND_STUDENT_ID)],
      locations: {
        [STUDENT_ID]: location(
          STUDENT_ID,
          RegionCode.Shanghai,
          WorkLocation.ShanghaiOffice,
        ),
        [SECOND_STUDENT_ID]: location(
          SECOND_STUDENT_ID,
          RegionCode.Shanghai,
          WorkLocation.ShanghaiOffice,
        ),
      },
      createErrorStudentIds: [STUDENT_ID],
    });

    const result = await service.reconcileDate('2026-08-06', STARTED_AT);

    expect(attendanceRecordModel.updateOne).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      scannedCount: 2,
      createdCount: 1,
      skippedCount: 0,
      failedCount: 1,
      failures: [
        {
          studentId: STUDENT_ID,
          attendanceDate: '2026-08-06',
          message: '缺勤写入失败',
        },
      ],
    });
  });

  it('treats repeated reconciliation as an idempotent skip', async () => {
    const { service, attendanceRecordModel } = createService({
      students: [studentRow(STUDENT_ID)],
      locations: {
        [STUDENT_ID]: location(
          STUDENT_ID,
          RegionCode.Shanghai,
          WorkLocation.ShanghaiOffice,
        ),
      },
    });

    const first = await service.reconcileDate('2026-08-06', STARTED_AT);
    const second = await service.reconcileDate('2026-08-06', STARTED_AT);

    expect(first).toMatchObject({ createdCount: 1, skippedCount: 0 });
    expect(second).toMatchObject({
      createdCount: 0,
      skippedCount: 1,
      failedCount: 0,
    });
    expect(attendanceRecordModel.updateOne).toHaveBeenCalledTimes(2);
  });

  it('does not overwrite a record created after candidate scanning', async () => {
    const { service, attendanceRecordModel } = createService({
      preexistingWriteStudentIds: [STUDENT_ID],
    });

    const result = await service.writeAbsenceRecords(
      [
        {
          studentId: STUDENT_ID,
          ownerHrId: OWNER_HR_ID,
          attendanceDate: '2026-08-06',
          assignedWorkLocation: WorkLocation.ShanghaiOffice,
          assignedWorkLocationAssignmentId: ASSIGNMENT_ID,
        },
      ],
      STARTED_AT,
    );

    expect(result).toEqual({
      createdCount: 0,
      skippedCount: 1,
      failedCount: 0,
      failures: [],
    });
    expect(attendanceRecordModel.updateOne).toHaveBeenCalledTimes(1);
  });

  it('treats a concurrent student unique-index conflict as a skip', async () => {
    const { service } = createService({
      duplicateErrorStudentIds: [STUDENT_ID],
    });

    const result = await service.writeAbsenceRecords(
      [
        {
          studentId: STUDENT_ID,
          ownerHrId: OWNER_HR_ID,
          attendanceDate: '2026-08-06',
          assignedWorkLocation: WorkLocation.ShanghaiOffice,
          assignedWorkLocationAssignmentId: ASSIGNMENT_ID,
        },
      ],
      STARTED_AT,
    );

    expect(result).toEqual({
      createdCount: 0,
      skippedCount: 1,
      failedCount: 0,
      failures: [],
    });
  });

  it('prepares a reconciliation scoped to one student', async () => {
    const { service } = createService();

    const result = await service.reconcileStudent(
      STUDENT_ID,
      '2026-08-01',
      '2026-08-06',
      STARTED_AT,
    );

    expect(result.studentId).toBe(STUDENT_ID);
  });

  it('limits an HR reconciliation to students owned by that HR', async () => {
    const { service, studentModel } = createService();

    await service.reconcileOwner(
      OWNER_HR_ID,
      '2026-08-06',
      '2026-08-06',
      STARTED_AT,
    );

    expect(studentModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerHrId: new Types.ObjectId(OWNER_HR_ID),
      }),
    );
  });

  it.each([
    ['2026/08/01', '2026-08-06'],
    ['2026-02-30', '2026-08-06'],
    ['2026-08-01', '2026-13-01'],
  ])('rejects an invalid reconciliation range %s to %s', async (start, end) => {
    const { service } = createService();

    await expect(
      service.reconcileRange(start, end, STARTED_AT),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a range whose start date is after its end date', async () => {
    const { service } = createService();

    await expect(
      service.reconcileRange('2026-08-07', '2026-08-06', STARTED_AT),
    ).rejects.toThrow('补算开始日期不能晚于结束日期');
  });

  it('rejects an invalid student ID before preparing reconciliation', () => {
    const { service } = createService();

    expect(() =>
      service.reconcileStudent(
        'invalid',
        '2026-08-01',
        '2026-08-06',
        STARTED_AT,
      ),
    ).toThrow('学生 ID 格式错误');
  });

  it('rejects an invalid owner HR ID before preparing reconciliation', () => {
    const { service } = createService();

    expect(() =>
      service.reconcileOwner('invalid', '2026-08-01', '2026-08-06', STARTED_AT),
    ).toThrow('负责 HR ID 格式错误');
  });
});
