import { ForbiddenException, INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import request from 'supertest';
import { AttendanceCalendarService } from '../src/modules/attendance/attendance-calendar.service';
import { AttendanceSource } from '../src/modules/attendance/enums/attendance-source.enum';
import { AttendanceStatus } from '../src/modules/attendance/enums/attendance-status.enum';
import { AttendanceCalendarScope } from '../src/modules/attendance/enums/attendance-calendar-scope.enum';
import { CalendarExceptionType } from '../src/modules/attendance/enums/calendar-exception-type.enum';
import { CheckInMode } from '../src/modules/attendance/enums/check-in-mode.enum';
import { RegionCode } from '../src/modules/attendance/enums/region-code.enum';
import { OfficeNetworkService } from '../src/modules/attendance/office-network.service';
import {
  AttendanceCalendar,
  type AttendanceCalendarDocument,
} from '../src/modules/attendance/schemas/attendance-calendar.schema';
import {
  AttendanceRecord,
  type AttendanceRecordDocument,
} from '../src/modules/attendance/schemas/attendance-record.schema';
import {
  OfficeNetwork,
  type OfficeNetworkDocument,
} from '../src/modules/attendance/schemas/office-network.schema';
import { HrRole } from '../src/modules/auth/enums/hr-role.enum';
import {
  HrUser,
  type HrUserDocument,
} from '../src/modules/auth/schemas/hr-user.schema';
import { WorkLocation } from '../src/modules/student/enums/student.enums';
import {
  createE2eApp,
  getE2eHttpServer,
  loginHr,
  removeE2eUploadDirectory,
  resetE2eState,
  seedHr,
  TEST_HR,
} from './e2e-test-utils';

const ADMIN_HR = {
  email: 'attendance.e2e.admin@example.com',
  password: 'AttendanceE2eAdmin123!',
  name: 'Attendance E2E Admin',
};

const OWNER_HR_ID = new Types.ObjectId('6a574ec45bd0f7b2a8b65b99');
const ASSIGNMENT_ID = new Types.ObjectId('6a574ec45bd0f7b2a8b65c20');

interface AttendanceFixtureOptions {
  studentId: Types.ObjectId;
  attendanceDate: string;
  deviceIdHash: string | null;
  source?: AttendanceSource;
}

function attendanceFixture(options: AttendanceFixtureOptions) {
  const source = options.source ?? AttendanceSource.CheckIn;
  const isCheckIn = source === AttendanceSource.CheckIn;

  return {
    studentId: options.studentId,
    ownerHrId: OWNER_HR_ID,
    attendanceDate: options.attendanceDate,
    status: isCheckIn ? AttendanceStatus.OnTime : AttendanceStatus.Absent,
    lateLevel: null,
    source,
    checkInAt: isCheckIn ? new Date('2026-08-07T01:00:00.000Z') : null,
    checkInAttemptAt: null,
    assignedWorkLocation: WorkLocation.Online,
    assignedWorkLocationAssignmentId: ASSIGNMENT_ID,
    checkInMode: isCheckIn ? CheckInMode.Online : null,
    checkInLocation: isCheckIn ? WorkLocation.Online : null,
    deviceIdHash: options.deviceIdHash,
    matchedOfficeNetworkId: null,
    ipMatchSucceeded: null,
    leaveBatchId: null,
    leaveRegisteredAt: null,
  };
}

function expectSingleDuplicateKey(
  results: PromiseSettledResult<unknown>[],
  indexName: string,
): void {
  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  const rejected = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );

  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);
  expect(rejected[0].reason).toMatchObject({ code: 11000 });
  expect(String(rejected[0].reason)).toContain(indexName);
}

describe('Attendance critical rules (e2e)', () => {
  let app: INestApplication;
  let attendanceRecordModel: Model<AttendanceRecordDocument>;
  let calendarModel: Model<AttendanceCalendarDocument>;
  let officeNetworkModel: Model<OfficeNetworkDocument>;

  beforeAll(async () => {
    app = await createE2eApp();
    attendanceRecordModel = app.get<Model<AttendanceRecordDocument>>(
      getModelToken(AttendanceRecord.name),
    );
    calendarModel = app.get<Model<AttendanceCalendarDocument>>(
      getModelToken(AttendanceCalendar.name),
    );
    officeNetworkModel = app.get<Model<OfficeNetworkDocument>>(
      getModelToken(OfficeNetwork.name),
    );

    // 8C 必须验证真实 MongoDB 索引，而不是仅检查 Mongoose schema 定义。
    await attendanceRecordModel.syncIndexes();
    await calendarModel.syncIndexes();
    await officeNetworkModel.syncIndexes();
  });

  beforeEach(async () => {
    await resetE2eState(app);
  });

  afterAll(async () => {
    await resetE2eState(app);
    await app.close();
    await removeE2eUploadDirectory();
  });

  it('allows only one concurrent record for the same student and date', async () => {
    const studentId = new Types.ObjectId();
    const results = await Promise.allSettled([
      attendanceRecordModel.create(
        attendanceFixture({
          studentId,
          attendanceDate: '2026-08-07',
          deviceIdHash: 'device-hash-student-first',
        }),
      ),
      attendanceRecordModel.create(
        attendanceFixture({
          studentId,
          attendanceDate: '2026-08-07',
          deviceIdHash: 'device-hash-student-second',
        }),
      ),
    ]);

    expectSingleDuplicateKey(results, 'unique_student_attendance_date');
    await expect(
      attendanceRecordModel.countDocuments({
        studentId,
        attendanceDate: '2026-08-07',
      }),
    ).resolves.toBe(1);
  });

  it('allows only one student to use a device per date but permits reuse on another date', async () => {
    const deviceIdHash = 'shared-browser-device-hash';
    const results = await Promise.allSettled([
      attendanceRecordModel.create(
        attendanceFixture({
          studentId: new Types.ObjectId(),
          attendanceDate: '2026-08-07',
          deviceIdHash,
        }),
      ),
      attendanceRecordModel.create(
        attendanceFixture({
          studentId: new Types.ObjectId(),
          attendanceDate: '2026-08-07',
          deviceIdHash,
        }),
      ),
    ]);

    expectSingleDuplicateKey(results, 'unique_check_in_device_attendance_date');

    await expect(
      attendanceRecordModel.create(
        attendanceFixture({
          studentId: new Types.ObjectId(),
          attendanceDate: '2026-08-08',
          deviceIdHash,
        }),
      ),
    ).resolves.toBeDefined();
  });

  it('does not apply device uniqueness to automatic records without a device', async () => {
    await expect(
      Promise.all([
        attendanceRecordModel.create(
          attendanceFixture({
            studentId: new Types.ObjectId(),
            attendanceDate: '2026-08-07',
            deviceIdHash: null,
            source: AttendanceSource.AbsenceScheduler,
          }),
        ),
        attendanceRecordModel.create(
          attendanceFixture({
            studentId: new Types.ObjectId(),
            attendanceDate: '2026-08-07',
            deviceIdHash: null,
            source: AttendanceSource.AbsenceScheduler,
          }),
        ),
      ]),
    ).resolves.toHaveLength(2);
  });

  it('applies a regional holiday only to that region and permits recreation after soft delete', async () => {
    const calendarService = app.get(AttendanceCalendarService);
    const createdByHrId = new Types.ObjectId();
    const holiday = await calendarModel.create({
      date: '2026-08-05',
      name: '上海临时假期',
      type: CalendarExceptionType.TemporaryHoliday,
      scope: AttendanceCalendarScope.Region,
      regionCode: RegionCode.Shanghai,
      reason: '8C E2E',
      createdByHrId,
      updatedByHrId: createdByHrId,
    });

    await expect(
      calendarService.isWorkday('2026-08-05', RegionCode.Shanghai),
    ).resolves.toMatchObject({ isWorkday: false, regionCode: 'shanghai' });
    await expect(
      calendarService.isWorkday('2026-08-05', RegionCode.Beijing),
    ).resolves.toMatchObject({ isWorkday: true, regionCode: 'beijing' });

    await expect(
      calendarModel.create({
        date: '2026-08-05',
        name: '重复上海假期',
        type: CalendarExceptionType.TemporaryHoliday,
        scope: AttendanceCalendarScope.Region,
        regionCode: RegionCode.Shanghai,
        createdByHrId,
        updatedByHrId: createdByHrId,
      }),
    ).rejects.toMatchObject({ code: 11000 });

    await calendarModel.updateOne(
      { _id: holiday._id },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    );
    await expect(
      calendarModel.create({
        date: '2026-08-05',
        name: '重新创建上海假期',
        type: CalendarExceptionType.TemporaryHoliday,
        scope: AttendanceCalendarScope.Region,
        regionCode: RegionCode.Shanghai,
        createdByHrId,
        updatedByHrId: createdByHrId,
      }),
    ).resolves.toBeDefined();
  });

  it('loads an office CIDR from MongoDB and fails closed for a different IP', async () => {
    const officeNetworkService = app.get(OfficeNetworkService);
    const updatedByHrId = new Types.ObjectId();
    await officeNetworkModel.create({
      workLocation: WorkLocation.ShanghaiInstitute,
      cidrs: ['140.207.40.253/32'],
      enabled: true,
      description: '8C E2E network',
      updatedByHrId,
    });

    await expect(
      officeNetworkService.assertIpAllowed(
        WorkLocation.ShanghaiInstitute,
        '140.207.40.253',
      ),
    ).resolves.toMatchObject({ ipMatchSucceeded: true });
    await expect(
      officeNetworkService.assertIpAllowed(
        WorkLocation.ShanghaiInstitute,
        '140.207.40.254',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('enforces regular HR regional scope and Admin global scope over HTTP', async () => {
    const server = getE2eHttpServer(app);
    const regularAgent = request.agent(server);
    const adminAgent = request.agent(server);
    await seedHr(app, TEST_HR);
    await seedHr(app, ADMIN_HR, HrRole.Admin);

    const hrUserModel = app.get<Model<HrUserDocument>>(
      getModelToken(HrUser.name),
    );
    await hrUserModel.updateOne(
      { email: TEST_HR.email },
      { $set: { managedRegionCodes: [RegionCode.Shanghai] } },
    );

    expect((await loginHr(regularAgent)).status).toBe(200);
    expect((await loginHr(adminAgent, ADMIN_HR)).status).toBe(200);

    await regularAgent
      .post('/api/hr/attendance/calendar')
      .send({
        startDate: '2026-09-01',
        endDate: '2026-09-01',
        name: '上海临时假期',
        scope: AttendanceCalendarScope.Region,
        regionCode: RegionCode.Shanghai,
      })
      .expect(201);

    await regularAgent
      .post('/api/hr/attendance/calendar')
      .send({
        startDate: '2026-09-02',
        endDate: '2026-09-02',
        name: '北京临时假期',
        scope: AttendanceCalendarScope.Region,
        regionCode: RegionCode.Beijing,
      })
      .expect(403);

    await regularAgent
      .post('/api/hr/attendance/calendar')
      .send({
        startDate: '2026-10-01',
        endDate: '2026-10-01',
        name: '全国法定假期',
        scope: AttendanceCalendarScope.Global,
      })
      .expect(403);

    await adminAgent
      .post('/api/hr/attendance/calendar')
      .send({
        startDate: '2026-10-01',
        endDate: '2026-10-01',
        name: '全国法定假期',
        scope: AttendanceCalendarScope.Global,
      })
      .expect(201);
  });
});
