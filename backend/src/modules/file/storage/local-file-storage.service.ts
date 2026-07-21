import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createReadStream as createNodeReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, posix, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { AttachmentType } from '../../student/enums/student.enums';
import type { FileStorage, SaveFileInput } from './file-storage.interface';

// 数据库枚举和本地目录名称分开，避免业务值依赖文件系统格式。
const ATTACHMENT_DIRECTORIES: Record<AttachmentType, string> = {
  [AttachmentType.Resume]: 'resume',
  [AttachmentType.IdCardFront]: 'id-card-front',
  [AttachmentType.IdCardBack]: 'id-card-back',
};

@Injectable()
export class LocalFileStorageService implements FileStorage {
  private readonly uploadRoot: string;

  constructor(configService: ConfigService) {
    const configuredRoot =
      configService.get<string>('UPLOAD_DIR') ?? './uploads';

    // 转成绝对路径，后续统一在这个目录内读写。
    this.uploadRoot = resolve(configuredRoot);
  }

  async save(input: SaveFileInput): Promise<string> {
    const directory = ATTACHMENT_DIRECTORIES[input.type];
    const extension = extname(input.originalName).toLowerCase();

    // 不使用用户原始文件名作为磁盘文件名，避免重名和路径问题。
    const storedFileName = `${randomUUID()}${extension}`;

    // storageKey 始终使用正斜杠，未来可直接作为 OSS object key。
    const storageKey = posix.join(
      'students',
      input.studentId,
      directory,
      storedFileName,
    );

    const absolutePath = this.resolveStorageKey(storageKey);

    await mkdir(dirname(absolutePath), { recursive: true });

    // wx 表示仅在文件不存在时创建，避免意外覆盖已有文件。
    await writeFile(absolutePath, input.buffer, { flag: 'wx' });

    return storageKey;
  }

  async delete(storageKey: string): Promise<void> {
    const absolutePath = this.resolveStorageKey(storageKey);

    try {
      await unlink(absolutePath);
    } catch (error: unknown) {
      // 文件已经不存在时，也把删除操作视为成功。
      if (this.isFileSystemError(error) && error.code === 'ENOENT') {
        return;
      }

      throw error;
    }
  }

  async createReadStream(storageKey: string): Promise<Readable> {
    const absolutePath = this.resolveStorageKey(storageKey);

    try {
      const fileStat = await stat(absolutePath);

      if (!fileStat.isFile()) {
        throw new NotFoundException('附件文件不存在');
      }
    } catch (error: unknown) {
      if (this.isFileSystemError(error) && error.code === 'ENOENT') {
        throw new NotFoundException('附件文件不存在');
      }

      throw error;
    }

    return createNodeReadStream(absolutePath);
  }

  private resolveStorageKey(storageKey: string): string {
    const absolutePath = resolve(this.uploadRoot, storageKey);
    const allowedPrefix = `${this.uploadRoot}${sep}`;

    // 防止 ../../etc/passwd 一类路径逃离 uploads 目录。
    if (!absolutePath.startsWith(allowedPrefix)) {
      throw new BadRequestException('附件存储路径无效');
    }

    return absolutePath;
  }

  private isFileSystemError(error: unknown): error is NodeJS.ErrnoException {
    // Node 错误可能来自不同的 VM 上下文，不能只依赖 instanceof Error。
    return typeof error === 'object' && error !== null && 'code' in error;
  }
}
