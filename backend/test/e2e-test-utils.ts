import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import type { Model } from 'mongoose';
import { Connection } from 'mongoose';
import { mkdir, rm } from 'node:fs/promises';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureHttpSecurity } from '../src/common/security/http-security';
import { HrRole } from '../src/modules/auth/enums/hr-role.enum';
import {
  HrUser,
  HrUserDocument,
} from '../src/modules/auth/schemas/hr-user.schema';
import { assertE2eMongoUri, assertE2eUploadDirectory } from './e2e-environment';

export const TEST_HR = {
  email: 'e2e.hr@example.com',
  password: 'E2ePassword123!',
  name: 'E2E HR',
};

export interface TestHrAccount {
  email: string;
  password: string;
  name: string;
}

export async function createE2eApp(): Promise<INestApplication> {
  assertE2eMongoUri(process.env.MONGODB_URI ?? '');
  assertE2eUploadDirectory(process.env.UPLOAD_DIR ?? '');

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  configureHttpSecurity(app, app.get(ConfigService));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  assertE2eDatabase(app.get<Connection>(getConnectionToken()));

  return app;
}

export async function resetE2eState(app: INestApplication): Promise<void> {
  const connection = app.get<Connection>(getConnectionToken());
  assertE2eDatabase(connection);

  // deleteMany keeps indexes intact while isolating every test case.
  await Promise.all(
    Object.values(connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );

  const uploadDir = process.env.UPLOAD_DIR;

  if (uploadDir) {
    const safeUploadDir = assertE2eUploadDirectory(uploadDir);
    await rm(safeUploadDir, { recursive: true, force: true });
    await mkdir(safeUploadDir, { recursive: true });
  }
}

export async function removeE2eUploadDirectory(): Promise<void> {
  const uploadDir = assertE2eUploadDirectory(process.env.UPLOAD_DIR ?? '');
  await rm(uploadDir, { recursive: true, force: true });
}

export async function seedHr(
  app: INestApplication,
  account: TestHrAccount = TEST_HR,
  role: HrRole = HrRole.Hr,
): Promise<void> {
  const hrUserModel = app.get<Model<HrUserDocument>>(
    getModelToken(HrUser.name),
  );
  const passwordHash = await bcrypt.hash(account.password, 10);

  await hrUserModel.create({
    email: account.email,
    passwordHash,
    name: account.name,
    role,
  });
}

export async function loginHr(
  agent: request.Agent,
  account: TestHrAccount = TEST_HR,
): Promise<request.Response> {
  return agent.post('/api/hr/login').send({
    email: account.email,
    password: account.password,
  });
}

export function assertE2eDatabase(connection: Connection): void {
  const databaseName = connection.db?.databaseName;

  if (!databaseName) {
    throw new Error(
      'Refusing to clean MongoDB because the connected database is unknown',
    );
  }

  assertE2eMongoUri(`mongodb://e2e.invalid/${databaseName}`);
}

export function responseBody<T>(response: request.Response): T {
  const body: unknown = response.body;
  return body as T;
}

export function getE2eHttpServer(app: INestApplication): App {
  const server: unknown = app.getHttpServer();
  return server as App;
}
