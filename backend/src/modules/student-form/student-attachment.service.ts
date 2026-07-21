import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../file/storage/file-storage.interface';
import { normalizeUploadedFileName } from '../file/filename/normalize-uploaded-file-name';
import { validateAttachmentFile } from '../file/validation/attachment-file.validator';
import { StudentService } from '../student/student.service';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';

@Injectable()
export class StudentAttachmentService {
  private readonly logger = new Logger(StudentAttachmentService.name);

  constructor(
    private readonly studentService: StudentService,

    // Inject the storage abstraction so local storage can later be replaced by OSS.
    @Inject(FILE_STORAGE)
    private readonly fileStorage: FileStorage,
  ) {}

  async upload(
    studentId: string,
    dto: UploadAttachmentDto,
    file: Express.Multer.File,
  ) {
    // Submitted or deleted students cannot upload more attachments.
    await this.studentService.ensureFormIsEditable(studentId);

    const originalName = normalizeUploadedFileName(file.originalname);
    const normalizedFile = { ...file, originalname: originalName };

    // Validate size, extension, MIME type, and file signature before saving.
    validateAttachmentFile(dto.type, normalizedFile);

    const storageKey = await this.fileStorage.save({
      studentId,
      type: dto.type,
      originalName,
      buffer: file.buffer,
    });

    try {
      const attachment = await this.studentService.addAttachmentMetadata(
        studentId,
        {
          type: dto.type,
          originalName,
          storageKey,
        },
      );

      return {
        message: '附件上传成功',
        attachment,
      };
    } catch (error: unknown) {
      // Remove the physical file when the MongoDB update fails.
      try {
        await this.fileStorage.delete(storageKey);
      } catch (cleanupError: unknown) {
        const message =
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError);

        this.logger.error(`Failed to clean up file ${storageKey}: ${message}`);
      }

      throw error;
    }
  }

  async remove(studentId: string, storageKey: string) {
    // Remove metadata only when this attachment belongs to the current student.
    const attachment = await this.studentService.removeAttachmentMetadata(
      studentId,
      storageKey,
    );

    // MongoDB 元数据已经删除。物理文件清理失败时记录错误，避免把成功的
    // 数据库操作返回成失败响应并诱发重复删除请求。
    try {
      await this.fileStorage.delete(attachment.storageKey);
      this.logger.log(`Deleted local file ${attachment.storageKey}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to delete attachment file ${attachment.storageKey}: ${message}`,
      );
    }

    return {
      message: '附件删除成功',
      attachment,
    };
  }
}
