import { NotFoundException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { Readable } from 'node:stream';
import { HrRole } from '../auth/enums/hr-role.enum';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { OperationAction } from '../operation-log/enums/operation-action.enum';
import { OperationLogService } from '../operation-log/operation-log.service';
import { AttachmentType } from '../student/enums/student.enums';
import type { StudentDocument } from '../student/schemas/student.schema';
import { StudentService } from '../student/student.service';
import { HrAttachmentService } from './hr-attachment.service';

const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const HR_ID = '6a574ec45bd0f7b2a8b65b99';
const HR_ACCESS: HrAccessContext = { hrUserId: HR_ID, role: HrRole.Hr };
const OLD_KEY = 'students/id/resume/old.pdf';
const NEW_KEY = 'students/id/resume/new.pdf';

function createPdfFile(): Express.Multer.File {
  const buffer = Buffer.from('%PDF-1.7 test file');

  return {
    fieldname: 'file',
    originalname: 'new-resume.pdf',
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

describe('HrAttachmentService', () => {
  function createDependencies() {
    const oldAttachment = {
      type: AttachmentType.Resume,
      originalName: 'old-resume.pdf',
      storageKey: OLD_KEY,
    };
    const studentService = {
      findOneByIdForHr: jest.fn().mockResolvedValue({
        attachments: [oldAttachment],
      }),
      addAttachmentMetadataByHr: jest.fn(),
      getHrAccessFilter: jest.fn().mockReturnValue({
        ownerHrId: HR_ID,
      }),
    };
    const studentModel = {
      findOneAndUpdate: jest.fn(),
    };
    const fileStorage = {
      save: jest.fn().mockResolvedValue(NEW_KEY),
      delete: jest.fn().mockResolvedValue(undefined),
      createReadStream: jest.fn(),
    };
    const operationLogService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    return {
      oldAttachment,
      studentService,
      studentModel,
      fileStorage,
      operationLogService,
      service: new HrAttachmentService(
        studentService as unknown as StudentService,
        studentModel as unknown as Model<StudentDocument>,
        fileStorage,
        operationLogService as unknown as OperationLogService,
      ),
    };
  }

  it('cleans up a newly stored upload when metadata saving fails', async () => {
    const { service, studentService, fileStorage } = createDependencies();
    const databaseError = new Error('database unavailable');
    studentService.addAttachmentMetadataByHr.mockRejectedValue(databaseError);

    await expect(
      service.upload(
        STUDENT_ID,
        { type: AttachmentType.Resume },
        createPdfFile(),
        HR_ACCESS,
      ),
    ).rejects.toBe(databaseError);
    expect(fileStorage.delete).toHaveBeenCalledWith(NEW_KEY);
  });

  it('keeps the old file and removes the new file when replacement fails', async () => {
    const { service, studentModel, fileStorage } = createDependencies();
    studentModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.replace(
        STUDENT_ID,
        { type: AttachmentType.Resume, oldStorageKey: OLD_KEY },
        createPdfFile(),
        HR_ACCESS,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(fileStorage.delete).toHaveBeenCalledTimes(1);
    expect(fileStorage.delete).toHaveBeenCalledWith(NEW_KEY);
    expect(fileStorage.delete).not.toHaveBeenCalledWith(OLD_KEY);
  });

  it('removes the physical file and records an audit log after DB deletion', async () => {
    const {
      service,
      oldAttachment,
      studentModel,
      fileStorage,
      operationLogService,
    } = createDependencies();
    studentModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: STUDENT_ID }),
    });

    const result = await service.remove(STUDENT_ID, ` ${OLD_KEY} `, HR_ACCESS);

    expect(fileStorage.delete).toHaveBeenCalledWith(OLD_KEY);
    expect(operationLogService.record).toHaveBeenCalledWith({
      operatorHrId: HR_ID,
      studentId: STUDENT_ID,
      action: OperationAction.AttachmentDeleted,
      changes: { attachment: oldAttachment },
    });
    expect(result.message).toBe('HR 删除附件成功');
  });

  it('does not open a file when the HR cannot access the student', async () => {
    const { service, studentService, fileStorage } = createDependencies();
    studentService.findOneByIdForHr.mockRejectedValue(
      new NotFoundException('学生不存在'),
    );

    await expect(
      service.createDownload(STUDENT_ID, OLD_KEY, HR_ACCESS),
    ).rejects.toThrow(NotFoundException);
    expect(fileStorage.createReadStream).not.toHaveBeenCalled();
  });
});
