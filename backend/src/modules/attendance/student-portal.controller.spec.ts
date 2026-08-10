import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { STUDENT_AUTH_COOKIE } from '../auth/auth.constants';
import { StudentAuthGuard } from '../auth/guards/student-auth.guard';
import { StudentAuthService } from '../auth/student-auth.service';
import { OnboardingStatus } from '../student/enums/student.enums';
import { StudentPortalState } from './enums/student-portal-state.enum';
import { StudentPortalController } from './student-portal.controller';
import { StudentPortalService } from './student-portal.service';

const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const TEST_JWT_SECRET = 'student-portal-controller-test-secret';

describe('StudentPortalController', () => {
  let app: INestApplication;
  let server: App;
  let jwtService: JwtService;
  let getPortal: jest.Mock;

  beforeEach(async () => {
    getPortal = jest.fn().mockResolvedValue({
      portalState: StudentPortalState.Attendance,
      student: {
        id: STUDENT_ID,
        name: '测试学生',
        onboardingStatus: OnboardingStatus.Onboarded,
      },
    });
    const moduleFixture = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: TEST_JWT_SECRET })],
      controllers: [StudentPortalController],
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
          provide: StudentPortalService,
          useValue: { getPortal },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
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

  it('rejects a portal request without a student cookie', async () => {
    await request(server).get('/api/student/portal').expect(401);

    expect(getPortal).not.toHaveBeenCalled();
  });

  it('returns portal state for the authenticated student only', async () => {
    const response = await request(server)
      .get('/api/student/portal')
      .set('Cookie', studentCookie())
      .expect(200);

    expect(response.body).toMatchObject({
      portalState: StudentPortalState.Attendance,
      student: { id: STUDENT_ID, name: '测试学生' },
    });
    expect(getPortal).toHaveBeenCalledWith(STUDENT_ID);
  });
});
