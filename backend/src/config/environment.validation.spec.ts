import { validateEnvironment } from './environment.validation';

function createEnvironment(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    NODE_ENV: 'development',
    PORT: '3001',
    FRONTEND_ORIGIN: 'http://localhost:3000',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/intern_onboarding',
    JWT_SECRET: 'development-secret-that-is-longer-than-32-characters',
    FILE_STORAGE_DRIVER: 'local',
    UPLOAD_DIR: './uploads',
    ATTENDANCE_TIMEZONE: 'Asia/Shanghai',
    ATTENDANCE_ON_TIME_BEFORE: '10:01',
    ATTENDANCE_LATE_THROUGH: '10:30',
    ATTENDANCE_CHECK_IN_CLOSE_AFTER: '11:00',
    ATTENDANCE_CRON_ENABLED: 'false',
    TRUST_PROXY_HOPS: '0',
    ...overrides,
  };
}

describe('validateEnvironment', () => {
  it('normalizes safe defaults and supported boolean values', () => {
    const result = validateEnvironment(
      createEnvironment({
        PORT: undefined,
        TRUST_PROXY_HOPS: undefined,
        ATTENDANCE_CRON_ENABLED: 'YES',
      }),
    );

    expect(result.PORT).toBe('3001');
    expect(result.TRUST_PROXY_HOPS).toBe('0');
    expect(result.ATTENDANCE_CRON_ENABLED).toBe('true');
  });

  it('requires the core database, origin and JWT settings', () => {
    expect(() =>
      validateEnvironment(createEnvironment({ MONGODB_URI: '' })),
    ).toThrow('MONGODB_URI');
    expect(() =>
      validateEnvironment(createEnvironment({ FRONTEND_ORIGIN: '' })),
    ).toThrow('FRONTEND_ORIGIN');
    expect(() =>
      validateEnvironment(createEnvironment({ JWT_SECRET: 'too-short' })),
    ).toThrow('至少需要 32 个字符');
  });

  it('rejects invalid proxy, Cron and attendance time settings', () => {
    expect(() =>
      validateEnvironment(createEnvironment({ TRUST_PROXY_HOPS: '-1' })),
    ).toThrow('TRUST_PROXY_HOPS');
    expect(() =>
      validateEnvironment(
        createEnvironment({ ATTENDANCE_CRON_ENABLED: 'sometimes' }),
      ),
    ).toThrow('ATTENDANCE_CRON_ENABLED');
    expect(() =>
      validateEnvironment(
        createEnvironment({ ATTENDANCE_LATE_THROUGH: '09:59' }),
      ),
    ).toThrow('考勤时间必须满足');
  });

  it('requires the unified China business timezone', () => {
    expect(() =>
      validateEnvironment(
        createEnvironment({ ATTENDANCE_TIMEZONE: 'America/New_York' }),
      ),
    ).toThrow('Asia/Shanghai');
  });

  it('requires WebDAV credentials only for ownCloud storage', () => {
    expect(() =>
      validateEnvironment(
        createEnvironment({ FILE_STORAGE_DRIVER: 'owncloud' }),
      ),
    ).toThrow('WEBDAV_URL');

    expect(
      validateEnvironment(
        createEnvironment({
          FILE_STORAGE_DRIVER: 'owncloud',
          WEBDAV_URL: 'http://localhost:8080/remote.php/dav/files/admin/',
          WEBDAV_USERNAME: 'admin',
          WEBDAV_PASSWORD: 'local-app-passcode',
          WEBDAV_REMOTE_PATH: 'student-onboarding-system',
        }),
      ).FILE_STORAGE_DRIVER,
    ).toBe('owncloud');
  });

  it('enforces HTTPS, ownCloud and non-placeholder secrets in production', () => {
    const productionEnvironment = createEnvironment({
      NODE_ENV: 'production',
      FRONTEND_ORIGIN: 'https://onboarding.example.com',
      FILE_STORAGE_DRIVER: 'owncloud',
      WEBDAV_URL: 'https://cloud.example.com/remote.php/dav/files/service/',
      WEBDAV_USERNAME: 'service-account',
      WEBDAV_PASSWORD: 'production-app-passcode-value',
      WEBDAV_REMOTE_PATH: 'student-onboarding-system',
      JWT_SECRET: 'production-random-secret-value-with-enough-entropy',
      TRUST_PROXY_HOPS: '1',
    });

    expect(validateEnvironment(productionEnvironment).NODE_ENV).toBe(
      'production',
    );
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        FRONTEND_ORIGIN: 'http://onboarding.example.com',
      }),
    ).toThrow('FRONTEND_ORIGIN 必须使用 HTTPS');
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        FILE_STORAGE_DRIVER: 'local',
      }),
    ).toThrow('生产环境必须使用 owncloud');
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        JWT_SECRET: 'replace-with-a-production-random-secret',
      }),
    ).toThrow('JWT_SECRET 不能使用示例占位值');
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        TRUST_PROXY_HOPS: '0',
      }),
    ).toThrow('TRUST_PROXY_HOPS');
  });
});
