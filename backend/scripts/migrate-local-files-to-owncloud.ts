import { ConfigService } from '@nestjs/config';
import { readFile, readdir } from 'node:fs/promises';
import { join, posix, relative, resolve, sep } from 'node:path';
import type { WebDAVClient } from 'webdav';

interface MigrationSummary {
  uploaded: number;
  skipped: number;
  failed: number;
}

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectFiles(absolutePath);
      }

      return entry.isFile() ? [absolutePath] : [];
    }),
  );

  return nestedFiles.flat();
}

function normalizeRemoteRoot(value: string): string {
  const segments = value
    .replaceAll('\\', '/')
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..');

  if (segments.length === 0) {
    throw new Error('WEBDAV_REMOTE_PATH 不能为空');
  }

  return `/${segments.join('/')}`;
}

async function migrateFile(
  client: WebDAVClient,
  uploadRoot: string,
  remoteRoot: string,
  absolutePath: string,
): Promise<'uploaded' | 'skipped'> {
  const storageKey = relative(uploadRoot, absolutePath).split(sep).join('/');
  const remotePath = posix.join(remoteRoot, storageKey);

  if (await client.exists(remotePath)) {
    console.log(`跳过已存在文件：${storageKey}`);
    return 'skipped';
  }

  await client.createDirectory(posix.dirname(remotePath), { recursive: true });
  await client.putFileContents(remotePath, await readFile(absolutePath), {
    overwrite: false,
  });
  console.log(`已复制：${storageKey}`);
  return 'uploaded';
}

async function main(): Promise<void> {
  const config = new ConfigService();
  const uploadRoot = resolve(config.get<string>('UPLOAD_DIR') ?? './uploads');
  const remoteRoot = normalizeRemoteRoot(
    config.get<string>('WEBDAV_REMOTE_PATH') ?? 'student-onboarding-system',
  );
  const { createClient } = await import('webdav');
  const client = createClient(config.getOrThrow<string>('WEBDAV_URL'), {
    username: config.getOrThrow<string>('WEBDAV_USERNAME'),
    password: config.getOrThrow<string>('WEBDAV_PASSWORD'),
  });
  const files = await collectFiles(uploadRoot);
  const summary: MigrationSummary = { uploaded: 0, skipped: 0, failed: 0 };

  for (const absolutePath of files) {
    try {
      const result = await migrateFile(
        client,
        uploadRoot,
        remoteRoot,
        absolutePath,
      );
      summary[result] += 1;
    } catch (error: unknown) {
      summary.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`复制失败：${absolutePath}：${message}`);
    }
  }

  console.log(
    `迁移完成：上传 ${summary.uploaded}，跳过 ${summary.skipped}，失败 ${summary.failed}`,
  );

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`本地附件迁移失败：${message}`);
  process.exitCode = 1;
});
