import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { STUDENT_AUTH_COOKIE } from '../auth/auth.constants';
import { StudentAuthGuard } from '../auth/guards/student-auth.guard';
import type { AuthenticatedStudentRequest } from '../auth/interfaces/authenticated-student-request.interface';
import { StudentAuthService } from '../auth/student-auth.service';
import { AttendanceCheckInService } from './attendance-check-in.service';
import { AttendanceLeaveCancellationService } from './attendance-leave-cancellation.service';
import { AttendanceLeaveOptionsService } from './attendance-leave-options.service';
import { AttendanceLeaveRegistrationService } from './attendance-leave-registration.service';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { CheckInMode } from './enums/check-in-mode.enum';
import { StudentAttendanceController } from './student-attendance.controller';
import { StudentAttendanceReadService } from './student-attendance-read.service';

const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';
const CLIENT_IP = '140.207.40.253';
const CHECK_IN_AT = new Date('2026-08-06T01:30:00.000Z');
const TEST_JWT_SECRET = 'student-attendance-controller-test-secret';

function successfulCheckInResponse() {
  return {
    attendanceDate: '2026-08-06',
    status: AttendanceStatus.OnTime,
    lateLevel: null,
    message: '打卡成功',
    checkInAt: CHECK_IN_AT,
    assignedWorkLocation: '上海办公室 - 绿地汇',
    checkInMode: CheckInMode.Offline,
    checkInLocation: '上海办公室 - 绿地汇',
  };
}

describe('StudentAttendanceController', () => {
  it('uses the authenticated student ID and server-observed request IP', async () => {
    const response = successfulCheckInResponse();
    const attendanceCheckInService = {
      checkIn: jest.fn().mockResolvedValue(response),
    };
    const controller = new StudentAttendanceController(
      attendanceCheckInService as unknown as AttendanceCheckInService,
      { getOptions: jest.fn() } as unknown as AttendanceLeaveOptionsService,
      {
        register: jest.fn(),
      } as unknown as AttendanceLeaveRegistrationService,
      {
        cancel: jest.fn(),
      } as unknown as AttendanceLeaveCancellationService,
      {
        getToday: jest.fn(),
        getRecords: jest.fn(),
      } as unknown as StudentAttendanceReadService,
    );
    const request = {
      ip: CLIENT_IP,
      studentUser: {
        sub: STUDENT_ID,
        actor: 'student',
        name: '测试学生',
        email: 'student@example.com',
      },
    } as AuthenticatedStudentRequest;
    const dto = {
      checkInMode: CheckInMode.Offline,
      deviceId: DEVICE_ID,
    };

    await expect(controller.checkIn(request, dto)).resolves.toEqual(response);
    expect(attendanceCheckInService.checkIn).toHaveBeenCalledWith(
      STUDENT_ID,
      dto,
      CLIENT_IP,
    );
  });

  describe('HTTP authentication and validation', () => {
    let app: INestApplication;
    let server: App;
    let jwtService: JwtService;
    let checkIn: jest.Mock;
    let getOptions: jest.Mock;
    let registerLeave: jest.Mock;
    let cancelLeave: jest.Mock;
    let getToday: jest.Mock;
    let getRecords: jest.Mock;

    beforeEach(async () => {
      checkIn = jest.fn().mockResolvedValue(successfulCheckInResponse());
      getOptions = jest.fn().mockResolvedValue({
        startDate: '2026-08-06',
        endDate: '2026-08-20',
        maxDaysAhead: 14,
        items: [],
      });
      registerLeave = jest.fn().mockResolvedValue({
        leaveBatchId: 'leave-batch-id',
        dates: ['2026-08-07', '2026-08-10'],
        registeredAt: CHECK_IN_AT,
      });
      cancelLeave = jest.fn().mockResolvedValue({
        attendanceDate: '2026-08-07',
        leaveBatchId: 'leave-batch-id',
        cancelledAt: CHECK_IN_AT,
      });
      getToday = jest.fn().mockResolvedValue({
        attendanceDate: '2026-08-06',
        isWorkday: true,
        assignedWorkLocation: '上海办公室 - 绿地汇',
        allowedCheckInModes: [CheckInMode.Online, CheckInMode.Offline],
        officeNetworkRequiredFor: [CheckInMode.Offline],
        checkInWindow: 'open',
        status: 'pending',
        checkInAt: null,
      });
      getRecords = jest.fn().mockResolvedValue({
        month: '2026-08',
        summary: {
          totalAttendanceDays: 0,
          late: { count: 0, dates: [] },
          leave: { count: 0, dates: [] },
          absent: { count: 0, dates: [] },
          onlineAttendanceDays: 0,
          offlineAttendanceDays: 0,
        },
        items: [],
      });
      const moduleFixture = await Test.createTestingModule({
        imports: [JwtModule.register({ secret: TEST_JWT_SECRET })],
        controllers: [StudentAttendanceController],
        providers: [
          StudentAuthGuard,
          {
            provide: StudentAuthService,
            useValue: {
              getSessionStudent: jest.fn().mockResolvedValue({
                id: STUDENT_ID,
                name: '测试学生',
                email: 'student@example.com',
              }),
            },
          },
          {
            provide: AttendanceCheckInService,
            useValue: { checkIn },
          },
          {
            provide: AttendanceLeaveOptionsService,
            useValue: { getOptions },
          },
          {
            provide: AttendanceLeaveRegistrationService,
            useValue: { register: registerLeave },
          },
          {
            provide: AttendanceLeaveCancellationService,
            useValue: { cancel: cancelLeave },
          },
          {
            provide: StudentAttendanceReadService,
            useValue: { getToday, getRecords },
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

    function studentCookie(): string {
      const token = jwtService.sign({
        sub: STUDENT_ID,
        actor: 'student',
        name: '测试学生',
        email: 'student@example.com',
      });

      return `${STUDENT_AUTH_COOKIE}=${token}`;
    }

    it('rejects requests without a student login cookie', async () => {
      await request(server)
        .post('/api/student/attendance/check-in')
        .send({
          checkInMode: CheckInMode.Online,
          deviceId: DEVICE_ID,
        })
        .expect(401);

      expect(checkIn).not.toHaveBeenCalled();
    });

    it('validates the check-in DTO after authenticating the student', async () => {
      await request(server)
        .post('/api/student/attendance/check-in')
        .set('Cookie', studentCookie())
        .send({
          checkInMode: CheckInMode.Online,
          deviceId: 'not-a-uuid',
        })
        .expect(400);

      expect(checkIn).not.toHaveBeenCalled();
    });

    it('accepts a valid student cookie and forwards the observed IP', async () => {
      const response = await request(server)
        .post('/api/student/attendance/check-in')
        .set('Cookie', studentCookie())
        .send({
          checkInMode: CheckInMode.Offline,
          deviceId: DEVICE_ID,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        attendanceDate: '2026-08-06',
        message: '打卡成功',
      });
      expect(checkIn).toHaveBeenCalledWith(
        STUDENT_ID,
        {
          checkInMode: CheckInMode.Offline,
          deviceId: DEVICE_ID,
        },
        expect.any(String),
      );
    });

    it('returns leave options only for the authenticated student', async () => {
      const response = await request(server)
        .get('/api/student/attendance/leave-options')
        .set('Cookie', studentCookie())
        .expect(200);

      expect(response.body).toMatchObject({
        startDate: '2026-08-06',
        endDate: '2026-08-20',
        maxDaysAhead: 14,
      });
      expect(getOptions).toHaveBeenCalledWith(STUDENT_ID);
    });

    it('returns today status only for the authenticated student', async () => {
      const response = await request(server)
        .get('/api/student/attendance/today')
        .set('Cookie', studentCookie())
        .expect(200);

      expect(response.body).toMatchObject({
        attendanceDate: '2026-08-06',
        status: 'pending',
      });
      expect(getToday).toHaveBeenCalledWith(STUDENT_ID);
    });

    it('validates the month and returns only the authenticated student records', async () => {
      const response = await request(server)
        .get('/api/student/attendance/records?month=2026-08')
        .set('Cookie', studentCookie())
        .expect(200);

      expect(response.body).toMatchObject({ month: '2026-08', items: [] });
      expect(getRecords).toHaveBeenCalledWith(STUDENT_ID, '2026-08');
    });

    it('rejects an invalid records month before calling the service', async () => {
      await request(server)
        .get('/api/student/attendance/records?month=2026-13')
        .set('Cookie', studentCookie())
        .expect(400);

      expect(getRecords).not.toHaveBeenCalled();
    });

    it('validates and registers multiple leave dates for the logged-in student', async () => {
      const response = await request(server)
        .post('/api/student/attendance/leaves')
        .set('Cookie', studentCookie())
        .send({ dates: ['2026-08-07', '2026-08-10'] })
        .expect(201);

      expect(response.body).toMatchObject({
        leaveBatchId: 'leave-batch-id',
        dates: ['2026-08-07', '2026-08-10'],
      });
      expect(registerLeave).toHaveBeenCalledWith(STUDENT_ID, {
        dates: ['2026-08-07', '2026-08-10'],
      });
    });

    it('rejects duplicate leave dates before calling the service', async () => {
      await request(server)
        .post('/api/student/attendance/leaves')
        .set('Cookie', studentCookie())
        .send({ dates: ['2026-08-07', '2026-08-07'] })
        .expect(400);

      expect(registerLeave).not.toHaveBeenCalled();
    });

    it('cancels a future leave for the logged-in student', async () => {
      const response = await request(server)
        .delete('/api/student/attendance/leaves/2026-08-07')
        .set('Cookie', studentCookie())
        .expect(200);

      expect(response.body).toMatchObject({
        attendanceDate: '2026-08-07',
        leaveBatchId: 'leave-batch-id',
      });
      expect(cancelLeave).toHaveBeenCalledWith(STUDENT_ID, '2026-08-07');
    });

    it('rejects an invalid cancellation date before calling the service', async () => {
      await request(server)
        .delete('/api/student/attendance/leaves/2026_08_07')
        .set('Cookie', studentCookie())
        .expect(400);

      expect(cancelLeave).not.toHaveBeenCalled();
    });

    it('does not allow an unauthenticated student to cancel leave', async () => {
      await request(server)
        .delete('/api/student/attendance/leaves/2026-08-07')
        .expect(401);

      expect(cancelLeave).not.toHaveBeenCalled();
    });
  });
});
