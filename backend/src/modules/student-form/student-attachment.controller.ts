import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Delete,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudentAuthGuard } from '../auth/guards/student-auth.guard';
import type { AuthenticatedStudentRequest } from '../auth/interfaces/authenticated-student-request.interface';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { StudentAttachmentService } from './student-attachment.service';
import { DeleteAttachmentQueryDto } from './dto/delete-attachment-query.dto';
import { MAX_ATTACHMENT_FILE_SIZE_BYTES } from '../file/validation/attachment-file.validator';

@Controller('student/attachments')
@UseGuards(StudentAuthGuard)
export class StudentAttachmentController {
  constructor(
    private readonly studentAttachmentService: StudentAttachmentService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fileSize: MAX_ATTACHMENT_FILE_SIZE_BYTES,
      },

      // 未设置 dest 时 Multer 使用内存存储，文件内容位于 file.buffer。
    }),
  )
  uploadAttachment(
    @Req() request: AuthenticatedStudentRequest,
    @Body() dto: UploadAttachmentDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({
          maxSize: MAX_ATTACHMENT_FILE_SIZE_BYTES,
        })
        .build({
          fileIsRequired: true,
          errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        }),
    )
    file: Express.Multer.File,
  ) {
    // 学生 ID 来自 JWT，不能由请求正文指定。
    return this.studentAttachmentService.upload(
      request.studentUser.sub,
      dto,
      file,
    );
  }
  @Delete()
  removeAttachment(
    @Req() request: AuthenticatedStudentRequest,
    @Query() query: DeleteAttachmentQueryDto,
  ) {
    return this.studentAttachmentService.remove(
      request.studentUser.sub,
      query.storageKey,
    );
  }
}
