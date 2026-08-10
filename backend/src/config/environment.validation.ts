type Environment = Record<string, unknown>;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TRUE_VALUES = new Set(['true', '1', 'yes', 'on']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'off']);

function readString(config: Environment, name: string): string | undefined {
  const value = config[name];

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue || undefined;
}

function requireString(config: Environment, name: string): string {
  const value = readString(config, name);

  if (!value) {
    throw new Error(`环境变量 ${name} 不能为空`);
  }

  return value;
}

function parseInteger(
  config: Environment,
  name: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): string {
  const rawValue = readString(config, name) ?? String(defaultValue);
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `环境变量 ${name} 必须是 ${minimum} 至 ${maximum} 之间的整数`,
    );
  }

  return String(value);
}

function validateHttpUrl(
  config: Environment,
  name: string,
  options: { originOnly?: boolean; httpsRequired?: boolean } = {},
): string {
  const value = requireString(config, name);
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`环境变量 ${name} 必须是有效 URL`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`环境变量 ${name} 只允许使用 HTTP 或 HTTPS`);
  }

  if (options.httpsRequired && url.protocol !== 'https:') {
    throw new Error(`生产环境的 ${name} 必须使用 HTTPS`);
  }

  if (options.originOnly && (url.pathname !== '/' || url.search || url.hash)) {
    throw new Error(`环境变量 ${name} 只能填写站点 Origin，不能包含路径或参数`);
  }

  return options.originOnly ? url.origin : value;
}

function parseTime(value: string, name: string): number {
  const match = TIME_PATTERN.exec(value);

  if (!match) {
    throw new Error(`环境变量 ${name} 必须使用 HH:mm 格式`);
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function containsPlaceholder(value: string): boolean {
  return /(replace|change|your[-_ ]|example|placeholder)/i.test(value);
}

export function validateEnvironment(input: Environment): Environment {
  const config = { ...input };
  const nodeEnv = readString(config, 'NODE_ENV') ?? 'development';

  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('环境变量 NODE_ENV 只能是 development、test 或 production');
  }

  config.NODE_ENV = nodeEnv;
  config.PORT = parseInteger(config, 'PORT', 3001, 1, 65535);
  config.TRUST_PROXY_HOPS = parseInteger(config, 'TRUST_PROXY_HOPS', 0, 0, 16);
  if (nodeEnv === 'production' && config.TRUST_PROXY_HOPS === '0') {
    throw new Error(
      '生产环境的 TRUST_PROXY_HOPS 必须按实际反向代理层数设置，不能为 0',
    );
  }
  config.FRONTEND_ORIGIN = validateHttpUrl(config, 'FRONTEND_ORIGIN', {
    originOnly: true,
    httpsRequired: nodeEnv === 'production',
  });

  const mongoUri = requireString(config, 'MONGODB_URI');
  if (!/^mongodb(?:\+srv)?:\/\//i.test(mongoUri)) {
    throw new Error('环境变量 MONGODB_URI 必须是 MongoDB 连接地址');
  }

  const jwtSecret = requireString(config, 'JWT_SECRET');
  if (jwtSecret.length < 32) {
    throw new Error('环境变量 JWT_SECRET 至少需要 32 个字符');
  }
  if (nodeEnv === 'production' && containsPlaceholder(jwtSecret)) {
    throw new Error('生产环境的 JWT_SECRET 不能使用示例占位值');
  }

  const storageDriver = (
    readString(config, 'FILE_STORAGE_DRIVER') ?? 'local'
  ).toLowerCase();
  if (!['local', 'owncloud'].includes(storageDriver)) {
    throw new Error('环境变量 FILE_STORAGE_DRIVER 只能是 local 或 owncloud');
  }
  if (nodeEnv === 'production' && storageDriver !== 'owncloud') {
    throw new Error('生产环境必须使用 owncloud 文件存储');
  }
  config.FILE_STORAGE_DRIVER = storageDriver;

  if (storageDriver === 'local') {
    config.UPLOAD_DIR = readString(config, 'UPLOAD_DIR') ?? './uploads';
  } else {
    config.WEBDAV_URL = validateHttpUrl(config, 'WEBDAV_URL', {
      httpsRequired: nodeEnv === 'production',
    });
    config.WEBDAV_USERNAME = requireString(config, 'WEBDAV_USERNAME');

    const webDavPassword = requireString(config, 'WEBDAV_PASSWORD');
    if (nodeEnv === 'production' && containsPlaceholder(webDavPassword)) {
      throw new Error('生产环境的 WEBDAV_PASSWORD 不能使用示例占位值');
    }

    config.WEBDAV_REMOTE_PATH =
      readString(config, 'WEBDAV_REMOTE_PATH') ?? 'student-onboarding-system';
  }

  const timeZone = readString(config, 'ATTENDANCE_TIMEZONE') ?? 'Asia/Shanghai';
  if (timeZone !== 'Asia/Shanghai') {
    throw new Error('考勤系统的 ATTENDANCE_TIMEZONE 必须是 Asia/Shanghai');
  }
  config.ATTENDANCE_TIMEZONE = timeZone;

  const onTimeBefore =
    readString(config, 'ATTENDANCE_ON_TIME_BEFORE') ?? '10:01';
  const lateThrough = readString(config, 'ATTENDANCE_LATE_THROUGH') ?? '10:30';
  const closeAfter =
    readString(config, 'ATTENDANCE_CHECK_IN_CLOSE_AFTER') ?? '11:00';
  const onTimeBeforeMinutes = parseTime(
    onTimeBefore,
    'ATTENDANCE_ON_TIME_BEFORE',
  );
  const lateThroughMinutes = parseTime(lateThrough, 'ATTENDANCE_LATE_THROUGH');
  const closeAfterMinutes = parseTime(
    closeAfter,
    'ATTENDANCE_CHECK_IN_CLOSE_AFTER',
  );

  if (
    onTimeBeforeMinutes >= lateThroughMinutes ||
    lateThroughMinutes >= closeAfterMinutes
  ) {
    throw new Error(
      '考勤时间必须满足 ATTENDANCE_ON_TIME_BEFORE < ' +
        'ATTENDANCE_LATE_THROUGH < ATTENDANCE_CHECK_IN_CLOSE_AFTER',
    );
  }

  config.ATTENDANCE_ON_TIME_BEFORE = onTimeBefore;
  config.ATTENDANCE_LATE_THROUGH = lateThrough;
  config.ATTENDANCE_CHECK_IN_CLOSE_AFTER = closeAfter;

  const cronValue = (
    readString(config, 'ATTENDANCE_CRON_ENABLED') ?? 'false'
  ).toLowerCase();
  if (!TRUE_VALUES.has(cronValue) && !FALSE_VALUES.has(cronValue)) {
    throw new Error('环境变量 ATTENDANCE_CRON_ENABLED 必须是 true 或 false');
  }
  config.ATTENDANCE_CRON_ENABLED = TRUE_VALUES.has(cronValue)
    ? 'true'
    : 'false';

  return config;
}
