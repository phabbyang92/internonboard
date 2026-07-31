import { Readable } from 'node:stream';
import type { IdCardWatermarkService } from '../file/processing/id-card-watermark.service';
import { AttachmentType } from '../student/enums/student.enums';
import { StudentService } from '../student/student.service';
import { StudentAttachmentService } from './student-attachment.service';

function createPdfFile(originalname = 'resume.pdf'): Express.Multer.File {
  const buffer = Buffer.from('%PDF-1.7 test file');

  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: buffer.length,
    destination: '',
    filename: '',
    path: '',
    buffer,
    stream: Readable.from(buffer),
  };
}

function createPngFile(originalname = 'identity.png'): Express.Multer.File {
  const buffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('test image bytes'),
  ]);

  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype: 'image/png',
    size: buffer.length,
    destination: '',
    filename: '',
    path: '',
    buffer,
    stream: Readable.from(buffer),
  };
}

describe('StudentAttachmentService', () => {
  function createDependencies() {
    const studentService = {
      ensureFormIsEditable: jest.fn().mockResolvedValue({
        name: '测试学生',
      }),
      addAttachmentMetadata: jest.fn(),
      removeAttachmentMetadata: jest.fn(),
    };
    const fileStorage = {
      save: jest.fn(),
      delete: jest.fn(),
      createReadStream: jest.fn(),
    };
    const idCardWatermarkService = {
      process: jest
        .fn()
        .mockImplementation(({ buffer }: { buffer: Buffer }) =>
          Promise.resolve(buffer),
        ),
    };

    return {
      studentService,
      fileStorage,
      idCardWatermarkService,
      service: new StudentAttachmentService(
        studentService as unknown as StudentService,
        fileStorage,
        idCardWatermarkService as unknown as IdCardWatermarkService,
      ),
    };
  }

  it('deletes the newly stored file if MongoDB metadata saving fails', async () => {
    const { service, studentService, fileStorage } = createDependencies();
    const databaseError = new Error('database unavailable');
    fileStorage.save.mockResolvedValue('students/id/resume/new.pdf');
    studentService.addAttachmentMetadata.mockRejectedValue(databaseError);
    fileStorage.delete.mockResolvedValue(undefined);

    await expect(
      service.upload(
        'student-id',
        { type: AttachmentType.Resume },
        createPdfFile(),
      ),
    ).rejects.toBe(databaseError);
    expect(fileStorage.delete).toHaveBeenCalledWith(
      'students/id/resume/new.pdf',
    );
  });

  it('normalizes a Chinese filename before storing metadata', async () => {
    const { service, studentService, fileStorage } = createDependencies();
    const originalName = '中文简历.pdf';
    const mojibake = Buffer.from(originalName, 'utf8').toString('latin1');
    const attachment = {
      type: AttachmentType.Resume,
      originalName,
      storageKey: 'students/id/resume/new.pdf',
    };
    fileStorage.save.mockResolvedValue(attachment.storageKey);
    studentService.addAttachmentMetadata.mockResolvedValue(attachment);

    await service.upload(
      'student-id',
      { type: AttachmentType.Resume },
      createPdfFile(mojibake),
    );

    expect(fileStorage.save).toHaveBeenCalledWith(
      expect.objectContaining({ originalName }),
    );
    expect(studentService.addAttachmentMetadata).toHaveBeenCalledWith(
      'student-id',
      expect.objectContaining({ originalName }),
    );
  });

  it('stores the watermarked identity image instead of the original', async () => {
    const { service, studentService, fileStorage, idCardWatermarkService } =
      createDependencies();
    const file = createPngFile();
    const watermarkedBuffer = Buffer.from('watermarked image bytes');
    const attachment = {
      type: AttachmentType.IdCardFront,
      originalName: file.originalname,
      storageKey: 'students/id/id_card_front/new.png',
    };
    idCardWatermarkService.process.mockResolvedValue(watermarkedBuffer);
    fileStorage.save.mockResolvedValue(attachment.storageKey);
    studentService.addAttachmentMetadata.mockResolvedValue(attachment);

    await service.upload(
      'student-id',
      { type: AttachmentType.IdCardFront },
      file,
    );

    expect(idCardWatermarkService.process).toHaveBeenCalledWith({
      type: AttachmentType.IdCardFront,
      originalName: file.originalname,
      studentName: '测试学生',
      buffer: file.buffer,
    });
    expect(fileStorage.save).toHaveBeenCalledWith(
      expect.objectContaining({ buffer: watermarkedBuffer }),
    );
  });

  it('does not turn a completed metadata removal into a failed response', async () => {
    const { service, studentService, fileStorage } = createDependencies();
    const attachment = {
      type: AttachmentType.Resume,
      originalName: 'resume.pdf',
      storageKey: 'students/id/resume/old.pdf',
    };
    studentService.removeAttachmentMetadata.mockResolvedValue(attachment);
    fileStorage.delete.mockRejectedValue(new Error('disk unavailable'));

    await expect(
      service.remove('student-id', attachment.storageKey),
    ).resolves.toEqual({
      message: '附件删除成功',
      attachment,
    });
  });
});
