import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { extname, posix } from 'node:path';
import type { Readable } from 'node:stream';
import type {
  WebDAVClient,
  WebDAVClientError,
  WebDAVClientOptions,
} from 'webdav';
import { AttachmentType } from '../../student/enums/student.enums';
import type { FileStorage, SaveFileInput } from './file-storage.interface';

const ATTACHMENT_DIRECTORIES: Record<AttachmentType, string> = {
  [AttachmentType.Resume]: 'resume',
  [AttachmentType.IdCardFront]: 'id-card-front',
  [AttachmentType.IdCardBack]: 'id-card-back',
};

export type OwnCloudClientFactory = (
  url: string,
  options: WebDAVClientOptions,
) => Promise<WebDAVClient>;

async function createOwnCloudClient(
  url: string,
  options: WebDAVClientOptions,
): Promise<WebDAVClient> {
  // webdav v5 is ESM. Dynamic import keeps it compatible with this NestJS build.
  const { createClient } = await import('webdav');
  return createClient(url, options);
}

@Injectable()
export class OwnCloudFileStorageService implements FileStorage {
  private readonly logger = new Logger(OwnCloudFileStorageService.name);
  private readonly remoteRoot: string;
  private readonly clientPromise: Promise<WebDAVClient>;

  constructor(
    configService: ConfigService,
    clientFactory: OwnCloudClientFactory = createOwnCloudClient,
  ) {
    const url = configService.getOrThrow<string>('WEBDAV_URL');
    const username = configService.getOrThrow<string>('WEBDAV_USERNAME');
    const password = configService.getOrThrow<string>('WEBDAV_PASSWORD');
    const configuredRoot =
      configService.get<string>('WEBDAV_REMOTE_PATH') ??
      'student-onboarding-system';

    this.remoteRoot = this.normalizeRemoteRoot(configuredRoot);
    this.clientPromise = clientFactory(url, { username, password });
  }

  async save(input: SaveFileInput): Promise<string> {
    this.assertSafeStudentId(input.studentId);

    const directory = ATTACHMENT_DIRECTORIES[input.type];
    const extension = extname(input.originalName).toLowerCase();
    const storedFileName = `${randomUUID()}${extension}`;
    const storageKey = posix.join(
      'students',
      input.studentId,
      directory,
      storedFileName,
    );
    const remotePath = this.resolveRemotePath(storageKey);

    try {
      const client = await this.clientPromise;
      await client.createDirectory(posix.dirname(remotePath), {
        recursive: true,
      });

      // UUID 文件名不会重名；禁止覆盖可额外保护已有附件。
      const uploaded = await client.putFileContents(remotePath, input.buffer, {
        overwrite: false,
      });

      if (!uploaded) {
        throw new Error('ownCloud did not confirm the upload');
      }

      return storageKey;
    } catch (error: unknown) {
      this.throwStorageUnavailable('上传', error);
    }
  }

  async delete(storageKey: string): Promise<void> {
    const remotePath = this.resolveRemotePath(storageKey);

    try {
      const client = await this.clientPromise;
      await client.deleteFile(remotePath);
    } catch (error: unknown) {
      // 清理逻辑保持幂等：远程文件已经不存在也视为删除成功。
      if (this.getStatusCode(error) === 404) {
        return;
      }

      this.throwStorageUnavailable('删除', error);
    }
  }

  async createReadStream(storageKey: string): Promise<Readable> {
    const remotePath = this.resolveRemotePath(storageKey);

    try {
      const client = await this.clientPromise;

      // 先检查文件存在性，让 HTTP 下载接口能返回明确的 404。
      if (!(await client.exists(remotePath))) {
        throw new NotFoundException('附件文件不存在');
      }

      return client.createReadStream(remotePath);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      if (this.getStatusCode(error) === 404) {
        throw new NotFoundException('附件文件不存在');
      }

      this.throwStorageUnavailable('下载', error);
    }
  }

  private normalizeRemoteRoot(value: string): string {
    const segments = value
      .replaceAll('\\', '/')
      .split('/')
      .filter((segment) => segment && segment !== '.' && segment !== '..');

    if (segments.length === 0) {
      throw new Error('WEBDAV_REMOTE_PATH 不能为空');
    }

    return `/${segments.join('/')}`;
  }

  private assertSafeStudentId(studentId: string): void {
    if (!/^[a-zA-Z0-9_-]+$/.test(studentId)) {
      throw new BadRequestException('学生 ID 格式错误');
    }
  }

  private resolveRemotePath(storageKey: string): string {
    const forwardSlashPath = storageKey.replaceAll('\\', '/');
    const normalizedPath = posix.normalize(forwardSlashPath);

    if (
      !forwardSlashPath ||
      forwardSlashPath.startsWith('/') ||
      normalizedPath === '..' ||
      normalizedPath.startsWith('../') ||
      normalizedPath.includes('\0')
    ) {
      throw new BadRequestException('附件存储路径无效');
    }

    return posix.join(this.remoteRoot, normalizedPath);
  }

  private getStatusCode(error: unknown): number | undefined {
    const webDavError = error as Partial<WebDAVClientError>;
    return webDavError.status ?? webDavError.response?.status;
  }

  private throwStorageUnavailable(action: string, error: unknown): never {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`ownCloud ${action}附件失败: ${message}`);

    throw new ServiceUnavailableException(
      `附件存储服务暂时不可用，${action}失败`,
    );
  }
}
