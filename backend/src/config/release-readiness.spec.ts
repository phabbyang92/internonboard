import {
  assertProductionDatabaseName,
  assertRestoreValidationDatabaseName,
  getMongoDatabaseName,
  parseEnvironmentFile,
  validateFrontendReleaseEnvironment,
} from './release-readiness';

describe('release readiness helpers', () => {
  it('parses quoted frontend environment values', () => {
    expect(
      parseEnvironmentFile(`
        # comment
        NEXT_PUBLIC_API_URL="https://api.example.com"
        export NEXT_PUBLIC_TENCENT_DOC_TITLE='HR 在线文档'
      `),
    ).toEqual({
      NEXT_PUBLIC_API_URL: 'https://api.example.com',
      NEXT_PUBLIC_TENCENT_DOC_TITLE: 'HR 在线文档',
    });
  });

  it('validates HTTPS API and Tencent document URLs', () => {
    expect(
      validateFrontendReleaseEnvironment({
        NEXT_PUBLIC_API_URL: 'https://api.example.com',
        NEXT_PUBLIC_TENCENT_DOC_URL: 'https://docs.qq.com/sheet/example?tab=1',
        NEXT_PUBLIC_TENCENT_DOC_TITLE: 'HR 在线文档',
      }),
    ).toMatchObject({ apiOrigin: 'https://api.example.com' });
  });

  it('rejects a non-Tencent shared document URL', () => {
    expect(() =>
      validateFrontendReleaseEnvironment({
        NEXT_PUBLIC_API_URL: 'https://api.example.com',
        NEXT_PUBLIC_TENCENT_DOC_URL: 'https://example.com/document',
        NEXT_PUBLIC_TENCENT_DOC_TITLE: 'HR 在线文档',
      }),
    ).toThrow('必须使用 docs.qq.com');
  });

  it('extracts and validates MongoDB database names', () => {
    expect(
      getMongoDatabaseName('mongodb://127.0.0.1:27017/intern_onboarding'),
    ).toBe('intern_onboarding');
    expect(() => assertProductionDatabaseName('intern_onboarding_e2e')).toThrow(
      '不能使用测试标识',
    );
    expect(() =>
      assertRestoreValidationDatabaseName('intern_onboarding'),
    ).toThrow('_restore_verification');
    expect(() =>
      assertRestoreValidationDatabaseName(
        'intern_onboarding_restore_verification',
      ),
    ).not.toThrow();
  });
});
