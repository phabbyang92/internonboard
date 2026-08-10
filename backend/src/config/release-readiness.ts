import { readFile } from 'node:fs/promises';

type StringEnvironment = Record<string, string>;

function requireValue(environment: StringEnvironment, name: string): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`前端环境变量 ${name} 不能为空`);
  }

  return value;
}

function requireHttpsUrl(
  environment: StringEnvironment,
  name: string,
  options: { originOnly?: boolean; hostname?: string } = {},
): URL {
  const rawValue = requireValue(environment, name);
  let value: URL;

  try {
    value = new URL(rawValue);
  } catch {
    throw new Error(`前端环境变量 ${name} 必须是有效 URL`);
  }

  if (value.protocol !== 'https:') {
    throw new Error(`正式环境的 ${name} 必须使用 HTTPS`);
  }

  if (
    options.originOnly &&
    (value.pathname !== '/' || value.search || value.hash)
  ) {
    throw new Error(`前端环境变量 ${name} 只能填写站点 Origin`);
  }

  if (options.hostname && value.hostname !== options.hostname) {
    throw new Error(`前端环境变量 ${name} 必须使用 ${options.hostname}`);
  }

  return value;
}

export function parseEnvironmentFile(source: string): StringEnvironment {
  const environment: StringEnvironment = {};

  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separatorIndex = normalized.indexOf('=');

    if (separatorIndex <= 0) {
      throw new Error(`环境文件第 ${index + 1} 行格式错误`);
    }

    const name = normalized.slice(0, separatorIndex).trim();
    let value = normalized.slice(separatorIndex + 1).trim();

    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    environment[name] = value;
  }

  return environment;
}

export async function loadEnvironmentFile(
  path: string,
): Promise<StringEnvironment> {
  const source = await readFile(path, 'utf8').catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`无法读取环境文件 ${path}：${message}`);
  });

  return parseEnvironmentFile(source);
}

export function validateFrontendReleaseEnvironment(
  environment: StringEnvironment,
): { apiOrigin: string; documentUrl: string; documentTitle: string } {
  const apiUrl = requireHttpsUrl(environment, 'NEXT_PUBLIC_API_URL', {
    originOnly: true,
  });
  const documentUrl = requireHttpsUrl(
    environment,
    'NEXT_PUBLIC_TENCENT_DOC_URL',
    { hostname: 'docs.qq.com' },
  );
  const documentTitle = requireValue(
    environment,
    'NEXT_PUBLIC_TENCENT_DOC_TITLE',
  );

  return {
    apiOrigin: apiUrl.origin,
    documentUrl: documentUrl.toString(),
    documentTitle,
  };
}

export function getMongoDatabaseName(uri: string): string {
  let parsed: URL;

  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('MONGODB_URI 不是有效连接地址');
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));

  if (!databaseName) {
    throw new Error('MONGODB_URI 必须明确包含数据库名称');
  }

  if (!/^[A-Za-z0-9_-]+$/.test(databaseName)) {
    throw new Error('MongoDB 数据库名称只能包含字母、数字、下划线和连字符');
  }

  return databaseName;
}

export function assertProductionDatabaseName(databaseName: string): void {
  if (/(^|[_-])(test|e2e|restore)([_-]|$)/i.test(databaseName)) {
    throw new Error(`正式数据库名称不能使用测试标识：${databaseName}`);
  }
}

export function assertRestoreValidationDatabaseName(
  databaseName: string,
): void {
  if (!databaseName.endsWith('_restore_verification')) {
    throw new Error(
      '恢复验证数据库名称必须以 _restore_verification 结尾，防止覆盖业务数据库',
    );
  }
}
