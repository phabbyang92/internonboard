import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { HrAuthGuard } from '../auth/guards/hr-auth.guard';
import type { AuthenticatedHrRequest } from '../auth/interfaces/authenticated-hr-request.interface';
import { MAX_ATTACHMENT_FILE_SIZE_BYTES } from '../file/validation/attachment-file.validator';
import { DownloadAttachmentQueryDto } from './dto/download-attachment-query.dto';
import { ReplaceHrAttachmentDto } from './dto/replace-hr-attachment.dto';
import { UploadHrAttachmentDto } from './dto/upload-hr-attachment.dto';
import { HrAttachmentService } from './hr-attachment.service';

@Controller('hr/students/:studentId/attachments')
@UseGuards(HrAuthGuard)
export class HrAttachmentController {
  constructor(private readonly hrAttachmentService: HrAttachmentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fileSize: MAX_ATTACHMENT_FILE_SIZE_BYTES,
      },
    }),
  )
  upload(
    @Param('studentId') studentId: string,
    @Req() request: AuthenticatedHrRequest,
    @Body() dto: UploadHrAttachmentDto,
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
    return this.hrAttachmentService.upload(
      studentId,
      dto,
      file,
      request.hrUser.sub,
    );
  }

  @Put('replace')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fileSize: MAX_ATTACHMENT_FILE_SIZE_BYTES,
      },
    }),
  )
  replace(
    @Param('studentId') studentId: string,
    @Req() request: AuthenticatedHrRequest,
    @Body() dto: ReplaceHrAttachmentDto,
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
    return this.hrAttachmentService.replace(
      studentId,
      dto,
      file,
      request.hrUser.sub,
    );
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('studentId') studentId: string,
    @Query() query: DownloadAttachmentQueryDto,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.hrAttachmentService.remove(
      studentId,
      query.storageKey,
      request.hrUser.sub,
    );
  }

  @Get('download')
  async download(
    @Param('studentId') studentId: string,
    @Query() query: DownloadAttachmentQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { stream, attachment } =
      await this.hrAttachmentService.createDownload(
        studentId,
        query.storageKey,
      );

    const encodedFileName = this.encodeFileName(attachment.originalName);

    response.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });

    return new StreamableFile(stream);
  }

  private encodeFileName(fileName: string): string {
    return encodeURIComponent(fileName).replace(
      /[!'()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  }
}
