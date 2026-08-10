import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import sharp from 'sharp';
import request from 'supertest';
import { AttendanceCheckInService } from '../src/modules/attendance/attendance-check-in.service';
import { AttendanceStatus } from '../src/modules/attendance/enums/attendance-status.enum';
import { CheckInMode } from '../src/modules/attendance/enums/check-in-mode.enum';
import { HrRole } from '../src/modules/auth/enums/hr-role.enum';
import {
  HrUser,
  type HrUserDocument,
} from '../src/modules/auth/schemas/hr-user.schema';
import {
  createE2eApp,
  getE2eHttpServer,
  loginHr,
  removeE2eUploadDirectory,
  resetE2eState,
  responseBody,
  seedHr,
  TEST_HR,
} from './e2e-test-utils';

interface StudentRecord {
  id: string;
  name: string;
  email: string;
  workLocation?: string | null;
  onboardingStartAt?: string | null;
  submittedAt?: string | null;
  hasSubmitted?: boolean;
  canEdit?: boolean;
}

interface StudentResponse {
  student: StudentRecord;
}

interface FormResponse {
  form: StudentRecord & {
    attachments: AttachmentMetadata[];
  };
}

interface AttachmentMetadata {
  type: 'resume' | 'id_card_front' | 'id_card_back';
  originalName: string;
  storageKey: string;
}

interface AttachmentResponse {
  message: string;
  attachment: AttachmentMetadata;
  previousAttachment?: AttachmentMetadata;
}

interface OperationLogsResponse {
  items: Array<{
    action: string;
    changes: Record<string, unknown> | null;
  }>;
}

const STUDENT = {
  name: 'E2E 测试学生',
  email: 'e2e.student@example.com',
  phone: '13800138000',
};

const SECOND_HR = {
  email: 'e2e.hr.two@example.com',
  password: 'E2ePassword456!',
  name: 'E2E HR Two',
};

const ADMIN_HR = {
  email: 'e2e.admin@example.com',
  password: 'E2eAdminPassword123!',
  name: 'E2E Admin',
};

function getChinaTodayStartIso(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return new Date(
    `${getPart('year')}-${getPart('month')}-${getPart('day')}T00:00:00+08:00`,
  ).toISOString();
}

function parseBinaryResponse(
  response: NodeJS.ReadableStream,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const chunks: Buffer[] = [];

  response.on('data', (chunk: Buffer | string) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  response.on('end', () => callback(null, Buffer.concat(chunks)));
}

// Today's arrangement is valid and already effective for location history.
const ONBOARDING_START_AT = getChinaTodayStartIso();

describe('Intern onboarding API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  beforeEach(async () => {
    await resetE2eState(app);
    await seedHr(app);
  });

  afterAll(async () => {
    await resetE2eState(app);
    await app.close();
    await removeE2eUploadDirectory();
  });

  async function createStudentAndArrange(
    hrAgent: request.Agent,
  ): Promise<string> {
    const createResponse = await hrAgent
      .post('/api/hr/students')
      .send(STUDENT)
      .expect(201);
    const student = responseBody<StudentRecord>(createResponse);

    await hrAgent
      .patch(`/api/hr/students/${student.id}/arrangement`)
      .send({
        workLocation: '上海办公室 - 会德丰',
        onboardingStartAt: ONBOARDING_START_AT,
      })
      .expect(200);

    return student.id;
  }

  async function loginStudent(
    studentAgent: request.Agent,
  ): Promise<request.Response> {
    return studentAgent.post('/api/student/login').send({
      name: STUDENT.name,
      email: STUDENT.email,
    });
  }

  function validFormPayload() {
    return {
      phone: STUDENT.phone,
      basicInfo: {
        position: '研究助理实习生',
        applicationDirection: 'ai',
        formDate: '2026-07-20T00:00:00.000Z',
        gender: '女',
        birthDate: '2000-01-01T00:00:00.000Z',
        idNumber: 'E2E-ID-NUMBER',
        householdRegistration: '上海',
        currentSchool: 'E2E 测试大学',
        major: '计算机科学',
        degree: '硕士',
        politicalStatus: '群众',
        sourceChannel: '官网',
        homeAddress: 'E2E 测试地址',
      },
      educationExperiences: [
        {
          startYear: 2021,
          endYear: 2025,
          school: 'E2E 测试大学',
          major: '计算机科学',
        },
      ],
      familyMembers: [
        {
          relation: '母亲',
          name: 'E2E 家庭成员',
          employer: 'E2E 测试单位',
          phone: '13800138002',
        },
      ],
      internshipExperiences: [],
      emergencyContactName: 'E2E 联系人',
      emergencyContactPhone: '13800138001',
      emergencyContactRelation: '家人',
      hasIdCopyAndAgreement: true,
      agreementSignedAt: '2026-07-19T00:00:00.000Z',
      notes: 'E2E submission',
      applicantSignature: STUDENT.name,
      applicantSignedAt: '2026-07-20T00:00:00.000Z',
      onboardingEndAt: '2026-12-31T00:00:00.000Z',
    };
  }

  it('checks health, cookies, login eligibility, and actor isolation', async () => {
    const server = getE2eHttpServer(app);
    const anonymous = request(server);
    const hrAgent = request.agent(server);
    const studentAgent = request.agent(server);

    const healthResponse = await anonymous
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', service: 'intern-onboarding-api' });
    expect(healthResponse.headers['x-powered-by']).toBeUndefined();
    expect(healthResponse.headers['x-content-type-options']).toBe('nosniff');
    expect(healthResponse.headers['strict-transport-security']).toBeUndefined();

    const allowedPreflight = await anonymous
      .options('/api/hr/login')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    expect(allowedPreflight.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(allowedPreflight.headers['access-control-allow-credentials']).toBe(
      'true',
    );

    const deniedPreflight = await anonymous
      .options('/api/hr/login')
      .set('Origin', 'https://untrusted.example.com')
      .set('Access-Control-Request-Method', 'POST')
      .expect(404);
    expect(
      deniedPreflight.headers['access-control-allow-origin'],
    ).toBeUndefined();
    await anonymous.get('/api/hr/students').expect(401);

    await hrAgent
      .post('/api/hr/login')
      .send({ email: TEST_HR.email, password: 'wrong-password' })
      .expect(401);
    await loginHr(hrAgent).then((response) => {
      expect(response.status).toBe(200);
      expect(response.headers['set-cookie']).toBeDefined();
    });
    await hrAgent.get('/api/hr/me').expect(200);
    await hrAgent.get('/api/student/me').expect(401);

    const createResponse = await hrAgent
      .post('/api/hr/students')
      .send(STUDENT)
      .expect(201);
    const student = responseBody<StudentRecord>(createResponse);

    await loginStudent(studentAgent).then((response) => {
      expect(response.status).toBe(403);
    });

    await hrAgent
      .patch(`/api/hr/students/${student.id}/arrangement`)
      .send({
        workLocation: '上海办公室 - 会德丰',
        onboardingStartAt: ONBOARDING_START_AT,
      })
      .expect(200);

    await hrAgent
      .patch(`/api/hr/students/${student.id}/arrangement`)
      .send({ workLocation: '线上' })
      .expect(200);

    const listAfterOnlineChange = responseBody<{
      items: StudentRecord[];
    }>(await hrAgent.get('/api/hr/students').expect(200));
    expect(listAfterOnlineChange.items[0].onboardingStartAt).toBe(
      ONBOARDING_START_AT,
    );
    expect(listAfterOnlineChange.items[0].workLocation).toBe('线上');

    const studentLoginResponse = await loginStudent(studentAgent);
    expect(studentLoginResponse.status).toBe(200);
    expect(responseBody<StudentResponse>(studentLoginResponse).student.id).toBe(
      student.id,
    );
    await studentAgent.get('/api/student/me').expect(200);
    await studentAgent.get('/api/hr/me').expect(401);

    await studentAgent.post('/api/student/logout').expect(204);
    await studentAgent.get('/api/student/me').expect(401);
    await hrAgent.post('/api/hr/logout').expect(204);
    await hrAgent.get('/api/hr/me').expect(401);
  });

  it('protects the student check-in route and forwards validated requests', async () => {
    const server = getE2eHttpServer(app);
    const anonymous = request(server);
    const hrAgent = request.agent(server);
    const studentAgent = request.agent(server);
    expect((await loginHr(hrAgent)).status).toBe(200);
    const studentId = await createStudentAndArrange(hrAgent);

    await anonymous
      .post('/api/student/attendance/check-in')
      .send({
        checkInMode: CheckInMode.Online,
        deviceId: '550e8400-e29b-41d4-a716-446655440000',
      })
      .expect(401);

    expect((await loginStudent(studentAgent)).status).toBe(200);
    await studentAgent
      .post('/api/student/attendance/check-in')
      .send({
        checkInMode: CheckInMode.Online,
        deviceId: 'not-a-uuid',
      })
      .expect(400);

    const checkInAt = new Date('2026-08-06T01:30:00.000Z');
    const service = app.get(AttendanceCheckInService);
    const checkInSpy = jest.spyOn(service, 'checkIn').mockResolvedValueOnce({
      attendanceDate: '2026-08-06',
      status: AttendanceStatus.OnTime,
      lateLevel: null,
      message: '打卡成功',
      checkInAt,
      assignedWorkLocation: '上海办公室 - 会德丰',
      checkInMode: CheckInMode.Online,
      checkInLocation: '线上',
    });

    const response = await studentAgent
      .post('/api/student/attendance/check-in')
      .send({
        checkInMode: CheckInMode.Online,
        deviceId: '550e8400-e29b-41d4-a716-446655440000',
      })
      .expect(200);

    expect(responseBody<{ message: string }>(response).message).toBe(
      '打卡成功',
    );
    expect(checkInSpy).toHaveBeenCalledWith(
      studentId,
      {
        checkInMode: CheckInMode.Online,
        deviceId: '550e8400-e29b-41d4-a716-446655440000',
      },
      expect.any(String),
    );

    checkInSpy.mockRestore();
  });

  it('isolates regular HR students and lets an administrator view all owners', async () => {
    const server = getE2eHttpServer(app);
    const firstHrAgent = request.agent(server);
    const secondHrAgent = request.agent(server);
    const adminAgent = request.agent(server);
    await seedHr(app, SECOND_HR);
    await seedHr(app, ADMIN_HR, HrRole.Admin);
    expect((await loginHr(firstHrAgent)).status).toBe(200);
    expect((await loginHr(secondHrAgent, SECOND_HR)).status).toBe(200);
    expect((await loginHr(adminAgent, ADMIN_HR)).status).toBe(200);

    const firstCreateResponse = await firstHrAgent
      .post('/api/hr/students')
      .send(STUDENT)
      .expect(201);
    const firstStudent = responseBody<StudentRecord>(firstCreateResponse);
    const secondCreateResponse = await secondHrAgent
      .post('/api/hr/students')
      .send({
        name: 'E2E 第二名学生',
        email: 'e2e.student.two@example.com',
      })
      .expect(201);
    const secondStudent = responseBody<StudentRecord>(secondCreateResponse);

    const firstHrList = responseBody<{ items: StudentRecord[] }>(
      await firstHrAgent.get('/api/hr/students').expect(200),
    );
    expect(firstHrList.items.map((student) => student.id)).toEqual([
      firstStudent.id,
    ]);
    await firstHrAgent.get(`/api/hr/students/${secondStudent.id}`).expect(404);
    await firstHrAgent.get('/api/hr/users').expect(403);

    const adminList = responseBody<{ items: StudentRecord[] }>(
      await adminAgent.get('/api/hr/students').expect(200),
    );
    expect(adminList.items).toHaveLength(2);

    const hrUserModel = app.get<Model<HrUserDocument>>(
      getModelToken(HrUser.name),
    );
    const secondHr = await hrUserModel.findOne({ email: SECOND_HR.email });
    expect(secondHr).not.toBeNull();
    const secondHrId = secondHr!._id.toString();
    const filteredAdminList = responseBody<{ items: StudentRecord[] }>(
      await adminAgent
        .get('/api/hr/students')
        .query({ ownerHrId: secondHrId })
        .expect(200),
    );
    expect(filteredAdminList.items.map((student) => student.id)).toEqual([
      secondStudent.id,
    ]);
  });

  it('completes the HR creation, student submission, and HR correction flow', async () => {
    const server = getE2eHttpServer(app);
    const hrAgent = request.agent(server);
    const studentAgent = request.agent(server);
    expect((await loginHr(hrAgent)).status).toBe(200);
    const studentId = await createStudentAndArrange(hrAgent);
    expect((await loginStudent(studentAgent)).status).toBe(200);

    const initialFormResponse = await studentAgent
      .get('/api/student/form')
      .expect(200);
    const initialForm = responseBody<FormResponse>(initialFormResponse).form;
    expect(initialForm.canEdit).toBe(true);
    expect(initialForm.workLocation).toBe('上海办公室 - 会德丰');

    const resume = Buffer.from('%PDF-1.7 E2E original resume');
    const idCardFront = await sharp({
      create: {
        width: 800,
        height: 500,
        channels: 3,
        background: '#ffffff',
      },
    })
      .png()
      .toBuffer();
    const idCardBack = await sharp({
      create: {
        width: 800,
        height: 500,
        channels: 3,
        background: '#f2f2f2',
      },
    })
      .png()
      .toBuffer();

    await studentAgent
      .post('/api/student/attachments')
      .field('type', 'resume')
      .attach('file', resume, {
        filename: 'resume.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    await studentAgent
      .post('/api/student/attachments')
      .field('type', 'id_card_front')
      .attach('file', idCardFront, {
        filename: 'identity-front.png',
        contentType: 'image/png',
      })
      .expect(201);
    await studentAgent
      .post('/api/student/attachments')
      .field('type', 'id_card_back')
      .attach('file', idCardBack, {
        filename: 'identity-back.png',
        contentType: 'image/png',
      })
      .expect(201);

    const submitResponse = await studentAgent
      .post('/api/student/form/submit')
      .send(validFormPayload())
      .expect(200);
    expect(responseBody<StudentRecord>(submitResponse).hasSubmitted).toBe(true);

    await studentAgent
      .post('/api/student/form/submit')
      .send(validFormPayload())
      .expect(409);
    await studentAgent
      .post('/api/student/attachments')
      .field('type', 'id_card_back')
      .attach('file', idCardBack, {
        filename: 'identity-back-replacement.png',
        contentType: 'image/png',
      })
      .expect(409);

    const submittedFormResponse = await studentAgent
      .get('/api/student/form')
      .expect(200);
    const submittedForm = responseBody<FormResponse>(
      submittedFormResponse,
    ).form;
    expect(submittedForm.hasSubmitted).toBe(true);
    expect(submittedForm.canEdit).toBe(false);
    expect(submittedForm.submittedAt).toBeTruthy();

    // HR can still correct submitted or onboarded student data.
    const profileResponse = await hrAgent
      .patch(`/api/hr/students/${studentId}/profile`)
      .send({ notes: 'HR corrected this note' })
      .expect(200);
    expect(responseBody<{ notes: string }>(profileResponse).notes).toBe(
      'HR corrected this note',
    );

    const arrangementResponse = await hrAgent
      .patch(`/api/hr/students/${studentId}/arrangement`)
      .send({
        workLocation: '线上',
        onboardingEndAt: '2027-01-31T00:00:00.000Z',
      })
      .expect(200);
    expect(responseBody<StudentRecord>(arrangementResponse).workLocation).toBe(
      '线上',
    );

    const historyResponse = await hrAgent
      .get(`/api/hr/students/${studentId}/work-location-history`)
      .expect(200);
    const history = responseBody<{ items: Array<{ workLocation: string }> }>(
      historyResponse,
    );
    expect(history.items.map((item) => item.workLocation)).toEqual(
      expect.arrayContaining(['上海办公室 - 会德丰', '线上']),
    );

    const exportResponse = await hrAgent
      .get(`/api/hr/students/${studentId}/export`)
      .buffer(true)
      .parse(parseBinaryResponse)
      .expect(200)
      .expect(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    expect(exportResponse.headers['content-disposition']).toContain(
      "filename*=UTF-8''",
    );
    const exportBody: unknown = exportResponse.body;
    expect(Buffer.isBuffer(exportBody)).toBe(true);

    if (!Buffer.isBuffer(exportBody)) {
      throw new Error('Expected student export to return a Buffer');
    }

    // XLSX files are ZIP containers and start with the PK signature.
    expect(exportBody.subarray(0, 2).toString()).toBe('PK');

    const logsResponse = await hrAgent
      .get(`/api/hr/students/${studentId}/operation-logs`)
      .expect(200);
    const actions = responseBody<OperationLogsResponse>(logsResponse).items.map(
      (item) => item.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining([
        'student.created',
        'student.profile.updated',
        'student.arrangement.updated',
        'student.exported',
      ]),
    );
  });

  it('uploads, downloads, replaces, and deletes attachments safely', async () => {
    const server = getE2eHttpServer(app);
    const hrAgent = request.agent(server);
    const studentAgent = request.agent(server);
    expect((await loginHr(hrAgent)).status).toBe(200);
    const studentId = await createStudentAndArrange(hrAgent);
    expect((await loginStudent(studentAgent)).status).toBe(200);

    await studentAgent
      .post('/api/student/attachments')
      .field('type', 'resume')
      .attach('file', Buffer.from('not a real PDF'), {
        filename: 'fake.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    const originalResume = Buffer.from('%PDF-1.7 original resume bytes');
    const uploadResponse = await studentAgent
      .post('/api/student/attachments')
      .field('type', 'resume')
      .attach('file', originalResume, {
        filename: 'original-resume.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const originalAttachment =
      responseBody<AttachmentResponse>(uploadResponse).attachment;

    const downloadResponse = await hrAgent
      .get(`/api/hr/students/${studentId}/attachments/download`)
      .query({ storageKey: originalAttachment.storageKey })
      .expect(200)
      .expect('Content-Type', 'application/octet-stream');
    const downloadedBody: unknown = downloadResponse.body;
    expect(Buffer.isBuffer(downloadedBody)).toBe(true);

    if (!Buffer.isBuffer(downloadedBody)) {
      throw new Error('Expected attachment download to return a Buffer');
    }

    expect(downloadedBody.equals(originalResume)).toBe(true);

    const replacementResume = Buffer.from('%PDF-1.7 replacement resume');
    const replaceResponse = await hrAgent
      .put(`/api/hr/students/${studentId}/attachments/replace`)
      .field('type', 'resume')
      .field('oldStorageKey', originalAttachment.storageKey)
      .attach('file', replacementResume, {
        filename: 'replacement-resume.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);
    const replacementAttachment =
      responseBody<AttachmentResponse>(replaceResponse).attachment;
    expect(replacementAttachment.storageKey).not.toBe(
      originalAttachment.storageKey,
    );

    await hrAgent
      .get(`/api/hr/students/${studentId}/attachments/download`)
      .query({ storageKey: originalAttachment.storageKey })
      .expect(404);

    const replacementDownload = await hrAgent
      .get(`/api/hr/students/${studentId}/attachments/download`)
      .query({ storageKey: replacementAttachment.storageKey })
      .expect(200);
    const replacementBody: unknown = replacementDownload.body;
    expect(Buffer.isBuffer(replacementBody)).toBe(true);

    if (!Buffer.isBuffer(replacementBody)) {
      throw new Error('Expected replacement download to return a Buffer');
    }

    expect(replacementBody.equals(replacementResume)).toBe(true);

    await hrAgent
      .delete(`/api/hr/students/${studentId}/attachments`)
      .query({ storageKey: replacementAttachment.storageKey })
      .expect(200);
    await hrAgent
      .delete(`/api/hr/students/${studentId}/attachments`)
      .query({ storageKey: replacementAttachment.storageKey })
      .expect(404);
  });

  it('rejects invalid input and preserves audit logs after soft deletion', async () => {
    const server = getE2eHttpServer(app);
    const hrAgent = request.agent(server);
    const studentAgent = request.agent(server);
    expect((await loginHr(hrAgent)).status).toBe(200);

    await hrAgent
      .post('/api/hr/students')
      .send({ ...STUDENT, unexpectedField: 'not allowed' })
      .expect(400);

    const createResponse = await hrAgent
      .post('/api/hr/students')
      .send(STUDENT)
      .expect(201);
    const student = responseBody<StudentRecord>(createResponse);

    await hrAgent.post('/api/hr/students').send(STUDENT).expect(409);
    await hrAgent.get('/api/hr/students/not-a-mongo-id').expect(400);
    await hrAgent
      .patch(`/api/hr/students/${student.id}/arrangement`)
      .send({
        workLocation: '不存在的办公室',
        onboardingStartAt: ONBOARDING_START_AT,
      })
      .expect(400);

    await hrAgent
      .patch(`/api/hr/students/${student.id}/arrangement`)
      .send({
        workLocation: '北京办公室',
        onboardingStartAt: ONBOARDING_START_AT,
      })
      .expect(200);
    expect((await loginStudent(studentAgent)).status).toBe(200);

    await hrAgent
      .delete(`/api/hr/students/${student.id}`)
      .send({ reason: '  offer 发生变动  ' })
      .expect(200);

    // Soft deletion revokes the previously issued student session immediately.
    await studentAgent.get('/api/student/form').expect(401);
    const newStudentAgent = request.agent(server);
    expect((await loginStudent(newStudentAgent)).status).toBe(401);
    await hrAgent.get(`/api/hr/students/${student.id}`).expect(404);

    const logsResponse = await hrAgent
      .get(`/api/hr/students/${student.id}/operation-logs`)
      .expect(200);
    const logs = responseBody<OperationLogsResponse>(logsResponse).items;
    const deletionLog = logs.find(
      (item) => item.action === 'student.soft_deleted',
    );
    expect(deletionLog?.changes).toEqual(
      expect.objectContaining({ reason: 'offer 发生变动' }),
    );
  });
});
