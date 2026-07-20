import { IsEnum } from 'class-validator';
import { AttachmentType } from '../../student/enums/student.enums';

export class UploadAttachmentDto {
  // multipart/form-data 中除了 file，还必须传附件业务类型。
  @IsEnum(AttachmentType)
  type!: AttachmentType;
}
