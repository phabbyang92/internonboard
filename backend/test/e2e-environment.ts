import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';

type MutableEnvironment = Record<string, string | undefined>;

const DEFAULT_E2E_MONGODB_URI =
  'mongodb://127.0.0.1:27017/intern_onboarding_e2e';
const TEST_UPLOAD_PREFIX = 'intern-onboarding-e2e-';

export interface E2eEnvironmentConfig {
  mongoUri: string;
  databaseName: string;
  uploadDir: string;
  ownCloudRemotePath: string;
}

export function assertE2eMongoUri(uri: string): string {
  let parsedUri: URL;

  try {
    parsedUri = new URL(uri);
  } catch {
    throw new Error('E2E_MONGODB_URI 必须是有效的 MongoDB 连接地址');
  }

  if (!['mongodb:', 'mongodb+srv:'].includes(parsedUri.protocol)) {
    throw new Error('E2E_MONGODB_URI 必须使用 mongodb:// 或 mongodb+srv://');
  }

  const databaseName = decodeURIComponent(parsedUri.pathname.slice(1));

  if (
    !databaseName ||
    databaseName.includes('/') ||
    !databaseName.endsWith('_e2e')
  ) {
    throw new Error(
      `拒绝使用非 E2E MongoDB 数据库：${databaseName || 'unknown'}。` +
        '数据库名称必须以 _e2e 结尾',
    );
  }

  return databaseName;
}

export function assertE2eUploadDirectory(directory: string): string {
  const absoluteDirectory = resolve(directory);
  const allowedRoots = [tmpdir(), '/tmp', '/private/tmp'].map((path) =>
    resolve(path),
  );
  const isInsideTemporaryRoot = allowedRoots.some((root) => {
    const relativePath = relative(root, absoluteDirectory);

    return (
      relativePath !== '' &&
      !relativePath.startsWith('..') &&
      !isAbsolute(relativePath)
    );
  });

  if (
    !isInsideTemporaryRoot ||
    !basename(absoluteDirectory).startsWith(TEST_UPLOAD_PREFIX)
  ) {
    throw new Error(
      '拒绝清理非 E2E 附件目录。目录必须位于系统临时目录中，' +
        `且名称以 ${TEST_UPLOAD_PREFIX} 开头`,
    );
  }

  return absoluteDirectory;
}

export function assertE2eOwnCloudRemotePath(remotePath: string): string {
  const segments = remotePath.replaceAll('\\', '/').split('/').filter(Boolean);

  if (
    segments.length === 0 ||
    segments.some((segment) => segment === '.' || segment === '..') ||
    !segments.some((segment) => segment.toLowerCase().includes('e2e'))
  ) {
    throw new Error(
      'E2E_WEBDAV_REMOTE_PATH 必须是独立的 E2E 子目录，且路径中包含 e2e',
    );
  }

  return segments.join('/');
}

export function configureE2eEnvironment(
  environment: MutableEnvironment = process.env,
  processId = process.pid,
): E2eEnvironmentConfig {
  const mongoUri =
    environment.E2E_MONGODB_URI?.trim() || DEFAULT_E2E_MONGODB_URI;
  const databaseName = assertE2eMongoUri(mongoUri);
  const uploadDir = assertE2eUploadDirectory(
    environment.E2E_UPLOAD_DIR?.trim() ||
      join(tmpdir(), `${TEST_UPLOAD_PREFIX}${processId}`),
  );
  const ownCloudRemotePath = assertE2eOwnCloudRemotePath(
    environment.E2E_WEBDAV_REMOTE_PATH?.trim() ||
      `student-onboarding-system-e2e/jest-${processId}`,
  );

  // E2E tests always override values inherited from backend/.env.
  environment.NODE_ENV = 'test';
  environment.FRONTEND_ORIGIN = 'http://localhost:3000';
  environment.MONGODB_URI = mongoUri;
  environment.JWT_SECRET = 'e2e-only-jwt-secret-with-sufficient-length';
  environment.FILE_STORAGE_DRIVER = 'local';
  environment.UPLOAD_DIR = uploadDir;
  environment.WEBDAV_REMOTE_PATH = ownCloudRemotePath;
  environment.ATTENDANCE_CRON_ENABLED = 'false';
  environment.TRUST_PROXY_HOPS = '0';

  return {
    mongoUri,
    databaseName,
    uploadDir,
    ownCloudRemotePath,
  };
}
