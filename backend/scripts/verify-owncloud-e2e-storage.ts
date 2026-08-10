import { randomUUID } from 'node:crypto';
import { posix } from 'node:path';
import type { WebDAVClientOptions } from 'webdav';
import { assertE2eOwnCloudRemotePath } from '../test/e2e-environment';

function requireEnvironment(
  primaryName: string,
  fallbackName?: string,
): string {
  const value =
    process.env[primaryName]?.trim() ||
    (fallbackName ? process.env[fallbackName]?.trim() : undefined);

  if (!value) {
    throw new Error(`缺少环境变量 ${primaryName}`);
  }

  return value;
}

async function verifyOwnCloudE2eStorage(): Promise<void> {
  const url = requireEnvironment('E2E_WEBDAV_URL', 'WEBDAV_URL');
  const username = requireEnvironment('E2E_WEBDAV_USERNAME', 'WEBDAV_USERNAME');
  const password = requireEnvironment('E2E_WEBDAV_PASSWORD', 'WEBDAV_PASSWORD');
  const remoteRoot = assertE2eOwnCloudRemotePath(
    requireEnvironment('E2E_WEBDAV_REMOTE_PATH'),
  );
  const runDirectory = posix.join(
    '/',
    remoteRoot,
    `verification-${randomUUID()}`,
  );
  const filePath = posix.join(runDirectory, 'round-trip.txt');
  const payload = Buffer.from(`ownCloud E2E verification ${Date.now()}`);
  const options: WebDAVClientOptions = { username, password };
  const { createClient } = await import('webdav');
  const client = createClient(url, options);

  try {
    await client.createDirectory(runDirectory, { recursive: true });
    const uploaded = await client.putFileContents(filePath, payload, {
      overwrite: false,
    });

    if (!uploaded) {
      throw new Error('ownCloud 没有确认测试文件上传成功');
    }

    const downloaded = await client.getFileContents(filePath, {
      format: 'binary',
    });

    if (!Buffer.isBuffer(downloaded) || !downloaded.equals(payload)) {
      throw new Error('ownCloud 测试文件下载内容与上传内容不一致');
    }

    console.log(`ownCloud E2E 隔离目录验证通过：${runDirectory}`);
  } finally {
    // The generated directory contains only this run's disposable test file.
    await client.deleteFile(runDirectory).catch(() => undefined);
  }
}

void verifyOwnCloudE2eStorage().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ownCloud E2E 隔离目录验证失败：${message}`);
  process.exitCode = 1;
});
