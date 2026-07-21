import { BadRequestException } from '@nestjs/common';
import { extname } from 'node:path';
import { AttachmentType } from '../../student/enums/student.enums';

export const MAX_ATTACHMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

interface AllowedFileRule {
  extensions: string[];
  mimeTypes: string[];
}

const ALLOWED_FILE_RULES: Record<AttachmentType, AllowedFileRule> = {
  [AttachmentType.Resume]: {
    extensions: ['.pdf', '.doc', '.docx'],
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  [AttachmentType.IdCardFront]: {
    extensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  [AttachmentType.IdCardBack]: {
    extensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
};

const FILE_SIGNATURES: Record<string, readonly number[]> = {
  '.pdf': [0x25, 0x50, 0x44, 0x46, 0x2d],
  '.jpg': [0xff, 0xd8, 0xff],
  '.jpeg': [0xff, 0xd8, 0xff],
  '.png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  '.doc': [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
  '.docx': [0x50, 0x4b, 0x03, 0x04],
};

export function validateAttachmentFile(
  type: AttachmentType,
  file: Express.Multer.File,
): void {
  if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new BadRequestException('上传文件不能为空');
  }

  if (file.buffer.length > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
    throw new BadRequestException('单个附件不能超过 10 MB');
  }

  if (Buffer.byteLength(file.originalname, 'utf8') > 255) {
    throw new BadRequestException('附件原始文件名过长');
  }

  const extension = extname(file.originalname).toLowerCase();
  const rule = ALLOWED_FILE_RULES[type];

  if (
    !rule.extensions.includes(extension) ||
    !rule.mimeTypes.includes(file.mimetype)
  ) {
    throw new BadRequestException(
      `该附件类型不支持文件格式 ${extension || '无扩展名'}`,
    );
  }

  // 扩展名和 MIME 通过后，再检查文件真实开头。
  const expectedSignature = FILE_SIGNATURES[extension];

  if (!expectedSignature) {
    throw new BadRequestException('无法识别附件文件格式');
  }

  const signatureMatches = expectedSignature.every(
    (expectedByte, index) => file.buffer[index] === expectedByte,
  );

  if (!signatureMatches) {
    throw new BadRequestException('附件内容与文件扩展名不匹配');
  }
}
