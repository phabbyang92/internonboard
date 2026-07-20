import { Readable } from 'node:stream';
import { AttachmentType } from '../student/enums/student.enums';
import { StudentService } from '../student/student.service';
import { StudentAttachmentService } from './student-attachment.service';

function createPdfFile(): Express.Multer.File {
  const buffer = Buffer.from('%PDF-1.7 test file');

  return {
    fieldname: 'file',
    originalname: 'resume.pdf',
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

describe('StudentAttachmentService', () => {
  function createDependencies() {
    const studentService = {
      ensureFormIsEditable: jest.fn().mockResolvedValue(undefined),
      addAttachmentMetadata: jest.fn(),
      removeAttachmentMetadata: jest.fn(),
    };
    const fileStorage = {
      save: jest.fn(),
      delete: jest.fn(),
      createReadStream: jest.fn(),
    };

    return {
      studentService,
      fileStorage,
      service: new StudentAttachmentService(
        studentService as unknown as StudentService,
        fileStorage,
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
