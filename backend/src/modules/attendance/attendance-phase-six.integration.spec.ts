import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { HR_AUTH_COOKIE } from '../auth/auth.constants';
import { AuthService } from '../auth/auth.service';
import { HrRole } from '../auth/enums/hr-role.enum';
import { HrAuthGuard } from '../auth/guards/hr-auth.guard';
import { WorkLocation } from '../student/enums/student.enums';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { CheckInMode } from './enums/check-in-mode.enum';
import {
  HrAttendanceSummarySort,
  HrDailyAttendanceSort,
} from './enums/hr-attendance-sort.enum';
import { LateLevel } from './enums/late-level.enum';
import { HrAttendanceController } from './hr-attendance.controller';
import { HrAttendanceCorrectionService } from './hr-attendance-correction.service';
import { HrAttendanceSummaryService } from './hr-attendance-summary.service';
import { HrDailyAttendanceService } from './hr-daily-attendance.service';
import { HrStudentAttendanceService } from './hr-student-attendance.service';

const HR_ID = '6a574ec45bd0f7b2a8b65b91';
const ADMIN_ID = '6a574ec45bd0f7b2a8b65b92';
const OWNER_HR_ID = '6a574ec45bd0f7b2a8b65b93';
const STUDENT_ID = '6a574ec45bd0f7b2a8b65a01';
const TEST_JWT_SECRET = 'attendance-phase-six-http-test-secret';

describe('Attendance Phase 6 HTTP integration', () => {
  let app: INestApplication;
  let server: App;
  let jwtService: JwtService;
  let listDaily: jest.Mock;
  let listSummary: jest.Mock;
  let getStudentAttendance: jest.Mock;
  let correctAttendance: jest.Mock;

  beforeEach(async () => {
    listDaily = jest.fn().mockResolvedValue({
      attendanceDate: '2026-08-07',
      statistics: {},
      items: [],
    });
    listSummary = jest.fn().mockResolvedValue({
      month: '2026-08',
      items: [],
    });
    getStudentAttendance = jest.fn().mockResolvedValue({
      month: '2026-08',
      items: [],
    });
    correctAttendance = jest.fn().mockResolvedValue({
      message: '考勤记录更正成功',
    });

    const moduleFixture = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: TEST_JWT_SECRET })],
      controllers: [HrAttendanceController],
      providers: [
        HrAuthGuard,
        {
          provide: AuthService,
          useValue: {
            getSessionUser: jest.fn().mockImplementation((hrUserId: string) =>
              Promise.resolve({
                id: hrUserId,
                email: `${hrUserId}@example.com`,
                name: hrUserId === ADMIN_ID ? '测试管理员' : '测试 HR',
                role: hrUserId === ADMIN_ID ? HrRole.Admin : HrRole.Hr,
              }),
            ),
          },
        },
        {
          provide: HrDailyAttendanceService,
          useValue: { listDaily },
        },
        {
          provide: HrAttendanceSummaryService,
          useValue: { listSummary },
        },
        {
          provide: HrStudentAttendanceService,
          useValue: { getStudentAttendance },
        },
        {
          provide: HrAttendanceCorrectionService,
          useValue: { correctAttendance },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    jwtService = app.get(JwtService);
    server = app.getHttpServer() as App;
  });

  afterEach(async () => {
    await app.close();
  });

  function hrCookie(role: HrRole, hrId: string): string {
    const token = jwtService.sign({
      sub: hrId,
      actor: 'hr',
      email: `${role}@example.com`,
      name: role === HrRole.Admin ? '测试管理员' : '测试 HR',
      role,
    });

    return `${HR_AUTH_COOKIE}=${token}`;
  }

  it('rejects all HR attendance endpoints without an HR login cookie', async () => {
    await request(server)
      .get('/api/hr/attendance/daily?date=2026-08-07')
      .expect(401);
    await request(server)
      .get('/api/hr/attendance/summary?month=2026-08')
      .expect(401);
    await request(server)
      .get(`/api/hr/attendance/students/${STUDENT_ID}?month=2026-08`)
      .expect(401);
    await request(server)
      .patch(`/api/hr/attendance/students/${STUDENT_ID}/records/2026-08-07`)
      .send({ status: AttendanceStatus.Leave, reason: '补录请假' })
      .expect(401);

    expect(listDaily).not.toHaveBeenCalled();
    expect(listSummary).not.toHaveBeenCalled();
    expect(getStudentAttendance).not.toHaveBeenCalled();
    expect(correctAttendance).not.toHaveBeenCalled();
  });

  it('validates and transforms the daily query before using the ordinary HR identity', async () => {
    await request(server)
      .get('/api/hr/attendance/daily')
      .set('Cookie', hrCookie(HrRole.Hr, HR_ID))
      .query({
        date: '2026-08-07',
        page: '2',
        limit: '5',
        keyword: '  张三  ',
        workLocation: WorkLocation.ShanghaiOffice,
        checkInMode: CheckInMode.Offline,
        status: AttendanceStatus.Late,
        sortBy: HrDailyAttendanceSort.CheckInAtDesc,
      })
      .expect(200);

    expect(listDaily).toHaveBeenCalledWith(
      {
        date: '2026-08-07',
        page: 2,
        limit: 5,
        keyword: '张三',
        workLocation: WorkLocation.ShanghaiOffice,
        checkInMode: CheckInMode.Offline,
        status: AttendanceStatus.Late,
        sortBy: HrDailyAttendanceSort.CheckInAtDesc,
      },
      { hrUserId: HR_ID, role: HrRole.Hr },
    );
  });

  it('applies the daily query defaults through the HTTP validation pipeline', async () => {
    await request(server)
      .get('/api/hr/attendance/daily?date=2026-08-07')
      .set('Cookie', hrCookie(HrRole.Hr, HR_ID))
      .expect(200);

    expect(listDaily).toHaveBeenCalledWith(
      {
        date: '2026-08-07',
        page: 1,
        limit: 20,
        sortBy: HrDailyAttendanceSort.StudentNameAsc,
      },
      { hrUserId: HR_ID, role: HrRole.Hr },
    );
  });

  it('rejects malformed or unknown daily query fields before reaching the service', async () => {
    await request(server)
      .get('/api/hr/attendance/daily?date=2026-08-99&limit=101&unexpected=true')
      .set('Cookie', hrCookie(HrRole.Hr, HR_ID))
      .expect(400);

    expect(listDaily).not.toHaveBeenCalled();
  });

  it('passes Admin HR filters and identity to the monthly summary service', async () => {
    await request(server)
      .get('/api/hr/attendance/summary')
      .set('Cookie', hrCookie(HrRole.Admin, ADMIN_ID))
      .query({
        month: '2026-08',
        ownerHrId: OWNER_HR_ID,
        checkInMode: CheckInMode.Online,
        page: '3',
        limit: '10',
        sortBy: HrAttendanceSummarySort.TotalAttendanceDaysDesc,
      })
      .expect(200);

    expect(listSummary).toHaveBeenCalledWith(
      {
        month: '2026-08',
        ownerHrId: OWNER_HR_ID,
        checkInMode: CheckInMode.Online,
        page: 3,
        limit: 10,
        sortBy: HrAttendanceSummarySort.TotalAttendanceDaysDesc,
      },
      { hrUserId: ADMIN_ID, role: HrRole.Admin },
    );
  });

  it('validates the detail month and passes the student route parameter unchanged', async () => {
    await request(server)
      .get(`/api/hr/attendance/students/${STUDENT_ID}?month=2026-13`)
      .set('Cookie', hrCookie(HrRole.Hr, HR_ID))
      .expect(400);
    expect(getStudentAttendance).not.toHaveBeenCalled();

    await request(server)
      .get(`/api/hr/attendance/students/${STUDENT_ID}?month=2026-08`)
      .set('Cookie', hrCookie(HrRole.Hr, HR_ID))
      .expect(200);

    expect(getStudentAttendance).toHaveBeenCalledWith(
      STUDENT_ID,
      { month: '2026-08' },
      { hrUserId: HR_ID, role: HrRole.Hr },
    );
  });

  it('accepts only controlled correction fields and trims HR-entered text', async () => {
    await request(server)
      .patch(`/api/hr/attendance/students/${STUDENT_ID}/records/2026-08-07`)
      .set('Cookie', hrCookie(HrRole.Hr, HR_ID))
      .send({
        status: AttendanceStatus.Absent,
        reason: '  补录严重迟到  ',
        checkInAt: '2026-08-07T02:45:00.000Z',
        checkInMode: CheckInMode.Offline,
        lateLevel: LateLevel.Severe,
        checkInLocation: '  上海办公室前台  ',
      })
      .expect(200);

    expect(correctAttendance).toHaveBeenCalledWith(
      STUDENT_ID,
      '2026-08-07',
      {
        status: AttendanceStatus.Absent,
        reason: '补录严重迟到',
        checkInAt: '2026-08-07T02:45:00.000Z',
        checkInMode: CheckInMode.Offline,
        lateLevel: LateLevel.Severe,
        checkInLocation: '上海办公室前台',
      },
      { hrUserId: HR_ID, role: HrRole.Hr },
    );
  });

  it('rejects backend-controlled correction fields', async () => {
    await request(server)
      .patch(`/api/hr/attendance/students/${STUDENT_ID}/records/2026-08-07`)
      .set('Cookie', hrCookie(HrRole.Hr, HR_ID))
      .send({
        status: AttendanceStatus.Leave,
        reason: '补录请假',
        deviceId: 'client-must-not-control-this',
      })
      .expect(400);

    expect(correctAttendance).not.toHaveBeenCalled();
  });

  it('preserves service-level access failures as HTTP errors', async () => {
    getStudentAttendance.mockRejectedValueOnce(
      new NotFoundException('学生不存在'),
    );

    await request(server)
      .get(`/api/hr/attendance/students/${STUDENT_ID}?month=2026-08`)
      .set('Cookie', hrCookie(HrRole.Hr, HR_ID))
      .expect(404);
  });
});
