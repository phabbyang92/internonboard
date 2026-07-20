import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../file/storage/file-storage.interface';
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

    // Validate size, extension, MIME type, and file signature before saving.
    validateAttachmentFile(dto.type, file);

    const storageKey = await this.fileStorage.save({
      studentId,
      type: dto.type,
      originalName: file.originalname,
      buffer: file.buffer,
    });

    try {
      const attachment = await this.studentService.addAttachmentMetadata(
        studentId,
        {
          type: dto.type,
          originalName: file.originalname,
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

    // LocalFileStorageService also validates that the key stays under uploads/.
    await this.fileStorage.delete(attachment.storageKey);

    this.logger.log(`Deleted local file ${attachment.storageKey}`);

    return {
      message: '附件删除成功',
      attachment,
    };
  }
}
