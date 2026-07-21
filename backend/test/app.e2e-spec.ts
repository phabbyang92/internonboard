import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createE2eApp,
  getE2eHttpServer,
  loginHr,
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
        workLocation: '上海办公室',
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
        maritalStatus: '未婚',
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
      familyMembers: [],
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

    await anonymous
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', service: 'intern-onboarding-api' });
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
        workLocation: '上海办公室',
        onboardingStartAt: ONBOARDING_START_AT,
      })
      .expect(200);

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
    expect(initialForm.workLocation).toBe('上海办公室');

    const resume = Buffer.from('%PDF-1.7 E2E original resume');
    const idCardFront = Buffer.from('%PDF-1.7 E2E identity document front');
    const idCardBack = Buffer.from('%PDF-1.7 E2E identity document back');

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
        filename: 'identity-front.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    await studentAgent
      .post('/api/student/attachments')
      .field('type', 'id_card_back')
      .attach('file', idCardBack, {
        filename: 'identity-back.pdf',
        contentType: 'application/pdf',
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
      .attach('file', resume, {
        filename: 'identity-back-replacement.pdf',
        contentType: 'application/pdf',
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
      expect.arrayContaining(['上海办公室', '线上']),
    );

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

    await studentAgent.get('/api/student/form').expect(404);
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
