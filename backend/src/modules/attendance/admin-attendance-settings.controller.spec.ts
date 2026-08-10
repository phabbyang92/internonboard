import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { HR_AUTH_COOKIE } from '../auth/auth.constants';
import { AuthService } from '../auth/auth.service';
import { HrRole } from '../auth/enums/hr-role.enum';
import { HrAuthGuard } from '../auth/guards/hr-auth.guard';
import { AdminAttendanceSettingsController } from './admin-attendance-settings.controller';
import { RegionAccessService } from './access/region-access.service';
import { AttendanceCalendarManagementService } from './attendance-calendar-management.service';
import { AttendanceCalendarScope } from './enums/attendance-calendar-scope.enum';

const HR_ID = '6a574ec45bd0f7b2a8b65b99';
const TEST_JWT_SECRET = 'admin-attendance-settings-test-secret';

describe('AdminAttendanceSettingsController', () => {
  let app: INestApplication;
  let server: App;
  let jwtService: JwtService;
  let list: jest.Mock;
  let create: jest.Mock;
  let getCalendarAccess: jest.Mock;

  beforeEach(async () => {
    list = jest.fn().mockResolvedValue({ month: '2026-10', items: [] });
    create = jest.fn().mockResolvedValue({ createdCount: 1, items: [] });
    getCalendarAccess = jest.fn().mockResolvedValue({
      role: HrRole.Admin,
      managedRegionCodes: [],
      canManageGlobal: true,
    });

    const moduleFixture = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: TEST_JWT_SECRET })],
      controllers: [AdminAttendanceSettingsController],
      providers: [
        HrAuthGuard,
        {
          provide: AuthService,
          useValue: {
            getSessionUser: jest.fn().mockResolvedValue({
              id: HR_ID,
              email: 'admin@example.com',
              name: '测试管理员',
              role: HrRole.Admin,
            }),
          },
        },
        {
          provide: AttendanceCalendarManagementService,
          useValue: {
            list,
            create,
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: RegionAccessService,
          useValue: { getCalendarAccess },
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

  function adminCookie(): string {
    const token = jwtService.sign({
      sub: HR_ID,
      actor: 'hr',
      email: 'admin@example.com',
      role: HrRole.Admin,
    });
    return `${HR_AUTH_COOKIE}=${token}`;
  }

  it('requires an HR login cookie', async () => {
    await request(server)
      .get('/api/hr/attendance/calendar?month=2026-10')
      .expect(401);
    expect(list).not.toHaveBeenCalled();
  });

  it('validates the month query before calling the service', async () => {
    await request(server)
      .get('/api/hr/attendance/calendar?month=2026-13')
      .set('Cookie', adminCookie())
      .expect(400);
    expect(list).not.toHaveBeenCalled();
  });

  it('lists calendar records with the authenticated HR context', async () => {
    await request(server)
      .get('/api/hr/attendance/calendar?month=2026-10')
      .set('Cookie', adminCookie())
      .expect(200);

    expect(list).toHaveBeenCalledWith(
      { month: '2026-10' },
      { hrUserId: HR_ID, role: HrRole.Admin },
    );
  });

  it('returns the current HR calendar access from the database-backed service', async () => {
    await request(server)
      .get('/api/hr/attendance/calendar/access')
      .set('Cookie', adminCookie())
      .expect(200)
      .expect({
        role: HrRole.Admin,
        managedRegionCodes: [],
        canManageGlobal: true,
      });

    expect(getCalendarAccess).toHaveBeenCalledWith({
      hrUserId: HR_ID,
      role: HrRole.Admin,
    });
  });

  it('creates a validated global holiday range', async () => {
    await request(server)
      .post('/api/hr/attendance/calendar')
      .set('Cookie', adminCookie())
      .send({
        startDate: '2026-10-01',
        endDate: '2026-10-07',
        name: '国庆节',
        scope: AttendanceCalendarScope.Global,
      })
      .expect(201);

    expect(create).toHaveBeenCalledWith(
      {
        startDate: '2026-10-01',
        endDate: '2026-10-07',
        name: '国庆节',
        scope: AttendanceCalendarScope.Global,
      },
      { hrUserId: HR_ID, role: HrRole.Admin },
    );
  });

  it('rejects unknown create fields', async () => {
    await request(server)
      .post('/api/hr/attendance/calendar')
      .set('Cookie', adminCookie())
      .send({
        startDate: '2026-10-01',
        endDate: '2026-10-01',
        name: '国庆节',
        scope: AttendanceCalendarScope.Global,
        unexpected: true,
      })
      .expect(400);
    expect(create).not.toHaveBeenCalled();
  });
});
