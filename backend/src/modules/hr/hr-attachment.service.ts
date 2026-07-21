import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../file/storage/file-storage.interface';
import { normalizeUploadedFileName } from '../file/filename/normalize-uploaded-file-name';
import { validateAttachmentFile } from '../file/validation/attachment-file.validator';
import {
  Student,
  type StudentDocument,
} from '../student/schemas/student.schema';
import { StudentService } from '../student/student.service';
import { ReplaceHrAttachmentDto } from './dto/replace-hr-attachment.dto';
import { UploadHrAttachmentDto } from './dto/upload-hr-attachment.dto';
import { OperationAction } from '../operation-log/enums/operation-action.enum';
import { OperationLogService } from '../operation-log/operation-log.service';

@Injectable()
export class HrAttachmentService {
  private readonly logger = new Logger(HrAttachmentService.name);

  constructor(
    private readonly studentService: StudentService,

    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,

    @Inject(FILE_STORAGE)
    private readonly fileStorage: FileStorage,
    private readonly operationLogService: OperationLogService,
  ) {}

  async upload(
    studentId: string,
    dto: UploadHrAttachmentDto,
    file: Express.Multer.File,
    hrUserId: string,
  ) {
    await this.studentService.findOneById(studentId);
    const originalName = normalizeUploadedFileName(file.originalname);
    validateAttachmentFile(dto.type, { ...file, originalname: originalName });

    const storageKey = await this.fileStorage.save({
      studentId,
      type: dto.type,
      originalName,
      buffer: file.buffer,
    });

    const attachment = {
      type: dto.type,
      originalName,
      storageKey,
    };

    try {
      await this.studentService.addAttachmentMetadataByHr(
        studentId,
        attachment,
      );
    } catch (error: unknown) {
      // 只有附件元数据保存失败时，才删除刚写入存储系统的文件。
      await this.cleanupStoredFile(storageKey);
      throw error;
    }

    this.logger.log(
      `HR ${hrUserId} uploaded attachment ${storageKey} for student ${studentId}`,
    );

    // 日志位于清理文件的 try/catch 外，避免日志失败时误删有效文件。
    await this.operationLogService.record({
      operatorHrId: hrUserId,
      studentId,
      action: OperationAction.AttachmentUploaded,
      changes: {
        attachment,
      },
    });

    return {
      message: 'HR 上传附件成功',
      attachment,
    };
  }

  async replace(
    studentId: string,
    dto: ReplaceHrAttachmentDto,
    file: Express.Multer.File,
    hrUserId: string,
  ) {
    const oldStorageKey = dto.oldStorageKey.trim();

    const student = await this.studentService.findOneById(studentId);
    const oldAttachment = student.attachments.find(
      (attachment) => attachment.storageKey === oldStorageKey,
    );

    if (!oldAttachment) {
      throw new NotFoundException('需要替换的附件不存在');
    }

    const originalName = normalizeUploadedFileName(file.originalname);
    validateAttachmentFile(dto.type, { ...file, originalname: originalName });

    const newStorageKey = await this.fileStorage.save({
      studentId,
      type: dto.type,
      originalName,
      buffer: file.buffer,
    });

    const newAttachment = {
      type: dto.type,
      originalName,
      storageKey: newStorageKey,
    };

    try {
      const updatedStudent = await this.studentModel
        .findOneAndUpdate(
          {
            _id: studentId,
            isDeleted: false,
            'attachments.storageKey': oldStorageKey,
          },
          {
            $set: {
              'attachments.$.type': newAttachment.type,
              'attachments.$.originalName': newAttachment.originalName,
              'attachments.$.storageKey': newAttachment.storageKey,
            },
          },
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )
        .exec();

      if (!updatedStudent) {
        throw new NotFoundException('附件不存在或已经被替换');
      }
    } catch (error: unknown) {
      // 数据库替换失败时，删除刚保存的新文件。
      await this.cleanupStoredFile(newStorageKey);
      throw error;
    }

    // MongoDB 已指向新文件后，再删除旧文件。
    await this.cleanupStoredFile(oldStorageKey);

    this.logger.log(
      `HR ${hrUserId} replaced attachment ${oldStorageKey} with ${newStorageKey} for student ${studentId}`,
    );

    await this.operationLogService.record({
      operatorHrId: hrUserId,
      studentId,
      action: OperationAction.AttachmentReplaced,
      changes: {
        before: {
          type: oldAttachment.type,
          originalName: oldAttachment.originalName,
          storageKey: oldAttachment.storageKey,
        },
        after: {
          type: newAttachment.type,
          originalName: newAttachment.originalName,
          storageKey: newAttachment.storageKey,
        },
      },
    });

    return {
      message: 'HR 替换附件成功',
      previousAttachment: oldAttachment,
      attachment: newAttachment,
    };
  }

  async remove(studentId: string, storageKey: string, hrUserId: string) {
    const normalizedStorageKey = storageKey.trim();

    const student = await this.studentService.findOneById(studentId);
    const attachment = student.attachments.find(
      (item) => item.storageKey === normalizedStorageKey,
    );

    if (!attachment) {
      throw new NotFoundException('附件不存在');
    }

    const updatedStudent = await this.studentModel
      .findOneAndUpdate(
        {
          _id: studentId,
          isDeleted: false,

          // 确保附件仍然属于该学生，防止并发删除。
          'attachments.storageKey': normalizedStorageKey,
        },
        {
          $pull: {
            attachments: {
              storageKey: normalizedStorageKey,
            },
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      )
      .exec();

    if (!updatedStudent) {
      throw new NotFoundException('附件不存在或已经被删除');
    }

    // 数据库不再引用该附件后，再删除物理文件。
    await this.cleanupStoredFile(normalizedStorageKey);

    this.logger.log(
      `HR ${hrUserId} deleted attachment ${normalizedStorageKey} for student ${studentId}`,
    );

    await this.operationLogService.record({
      operatorHrId: hrUserId,
      studentId,
      action: OperationAction.AttachmentDeleted,
      changes: {
        attachment: {
          type: attachment.type,
          originalName: attachment.originalName,
          storageKey: attachment.storageKey,
        },
      },
    });

    return {
      message: 'HR 删除附件成功',
      attachment,
    };
  }

  async createDownload(studentId: string, storageKey: string) {
    const normalizedStorageKey = storageKey.trim();

    const student = await this.studentService.findOneById(studentId);

    const attachment = student.attachments.find(
      (item) => item.storageKey === normalizedStorageKey,
    );

    if (!attachment) {
      throw new NotFoundException('附件不存在');
    }

    const stream = await this.fileStorage.createReadStream(
      attachment.storageKey,
    );

    return {
      stream,
      attachment: {
        type: attachment.type,
        originalName: normalizeUploadedFileName(attachment.originalName),
        storageKey: attachment.storageKey,
      },
    };
  }

  private async cleanupStoredFile(storageKey: string): Promise<void> {
    try {
      await this.fileStorage.delete(storageKey);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`Failed to clean up file ${storageKey}: ${message}`);
    }
  }
}
