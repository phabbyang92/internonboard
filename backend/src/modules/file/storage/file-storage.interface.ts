import type { Readable } from 'node:stream';
import { AttachmentType } from '../../student/enums/student.enums';

// NestJS 使用这个 token 注入具体的存储实现。
export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface SaveFileInput {
  studentId: string;
  type: AttachmentType;
  originalName: string;

  // Multer 使用内存存储时，文件内容位于 buffer 中。
  buffer: Buffer;
}

export interface FileStorage {
  // 保存文件并返回数据库需要记录的相对 storageKey。
  save(input: SaveFileInput): Promise<string>;

  // 学生删除附件或 HR 删除学生时，需要同步删除文件。
  delete(storageKey: string): Promise<void>;

  // 下载时返回流，避免一次把整个文件读入内存。
  createReadStream(storageKey: string): Promise<Readable>;
}
