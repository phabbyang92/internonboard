import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertE2eMongoUri,
  assertE2eOwnCloudRemotePath,
  assertE2eUploadDirectory,
  configureE2eEnvironment,
} from './e2e-environment';

describe('E2E environment isolation', () => {
  it('creates isolated defaults without inheriting development storage', () => {
    const environment: Record<string, string | undefined> = {
      MONGODB_URI: 'mongodb://production.example.com/intern_onboarding',
      FILE_STORAGE_DRIVER: 'owncloud',
      UPLOAD_DIR: '/srv/production-uploads',
    };

    const result = configureE2eEnvironment(environment, 1234);

    expect(result.databaseName).toBe('intern_onboarding_e2e');
    expect(result.uploadDir).toBe(join(tmpdir(), 'intern-onboarding-e2e-1234'));
    expect(result.ownCloudRemotePath).toContain('e2e');
    expect(environment.NODE_ENV).toBe('test');
    expect(environment.FILE_STORAGE_DRIVER).toBe('local');
    expect(environment.MONGODB_URI).toBe(result.mongoUri);
  });

  it('rejects a database whose name is not explicitly marked for E2E', () => {
    expect(() =>
      assertE2eMongoUri(
        'mongodb://127.0.0.1:27017/intern_onboarding?retryWrites=true',
      ),
    ).toThrow('必须以 _e2e 结尾');
  });

  it('rejects cleanup outside a clearly named temporary E2E directory', () => {
    expect(() => assertE2eUploadDirectory('/srv/production-uploads')).toThrow(
      '拒绝清理非 E2E 附件目录',
    );
    expect(() => assertE2eUploadDirectory('/tmp/uploads')).toThrow(
      '拒绝清理非 E2E 附件目录',
    );
  });

  it('requires ownCloud tests to use a dedicated E2E subtree', () => {
    expect(() =>
      assertE2eOwnCloudRemotePath('student-onboarding-system'),
    ).toThrow('路径中包含 e2e');
    expect(assertE2eOwnCloudRemotePath('/system-e2e/manual')).toBe(
      'system-e2e/manual',
    );
  });
});
