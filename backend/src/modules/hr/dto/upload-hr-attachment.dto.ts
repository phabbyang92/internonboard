import { IsEnum } from 'class-validator';
import { AttachmentType } from '../../student/enums/student.enums';

export class UploadHrAttachmentDto {
  // multipart/form-data 中必须说明附件属于哪种业务类型。
  @IsEnum(AttachmentType, {
    message: '附件类型只能是 resume、id_card 或 other',
  })
  type!: AttachmentType;
}
