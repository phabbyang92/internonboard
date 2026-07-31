import { BadRequestException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { AttachmentType } from '../../student/enums/student.enums';
import {
  MAX_ATTACHMENT_FILE_SIZE_BYTES,
  validateAttachmentFile,
} from './attachment-file.validator';

function createFile(
  buffer: Buffer,
  originalname = 'resume.pdf',
  mimetype = 'application/pdf',
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    destination: '',
    filename: '',
    path: '',
    buffer,
    stream: Readable.from(buffer),
  };
}

describe('validateAttachmentFile', () => {
  const validPdf = Buffer.from('%PDF-1.7 test file');
  const validPng = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('test image bytes'),
  ]);

  it('accepts a PDF with matching extension, MIME type, and signature', () => {
    expect(() =>
      validateAttachmentFile(AttachmentType.Resume, createFile(validPdf)),
    ).not.toThrow();
  });

  it('accepts a PNG identity image with matching metadata', () => {
    expect(() =>
      validateAttachmentFile(
        AttachmentType.IdCardFront,
        createFile(validPng, 'identity.png', 'image/png'),
      ),
    ).not.toThrow();
  });

  it('rejects PDF identity documents because they cannot be watermarked safely', () => {
    expect(() =>
      validateAttachmentFile(
        AttachmentType.IdCardBack,
        createFile(validPdf, 'identity.pdf', 'application/pdf'),
      ),
    ).toThrow('该附件类型不支持文件格式 .pdf');
  });

  it('rejects an empty file', () => {
    expect(() =>
      validateAttachmentFile(
        AttachmentType.Resume,
        createFile(Buffer.alloc(0)),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a file larger than 10 MB', () => {
    const oversized = Buffer.alloc(MAX_ATTACHMENT_FILE_SIZE_BYTES + 1);

    expect(() =>
      validateAttachmentFile(AttachmentType.Resume, createFile(oversized)),
    ).toThrow('单个附件不能超过 10 MB');
  });

  it('rejects an extension or MIME type that is not allowed', () => {
    expect(() =>
      validateAttachmentFile(
        AttachmentType.IdCardFront,
        createFile(validPdf, 'identity.exe', 'application/octet-stream'),
      ),
    ).toThrow('该附件类型不支持文件格式 .exe');
  });

  it('rejects disguised file content even when extension and MIME match', () => {
    expect(() =>
      validateAttachmentFile(
        AttachmentType.Resume,
        createFile(Buffer.from('not actually a pdf')),
      ),
    ).toThrow('附件内容与文件扩展名不匹配');
  });

  it('rejects an excessively long original filename', () => {
    expect(() =>
      validateAttachmentFile(
        AttachmentType.Resume,
        createFile(validPdf, `${'a'.repeat(252)}.pdf`),
      ),
    ).toThrow('附件原始文件名过长');
  });
});
