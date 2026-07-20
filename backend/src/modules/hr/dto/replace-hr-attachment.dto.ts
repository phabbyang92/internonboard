import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../../common/transforms/trim-string.transform';
import { AttachmentType } from '../../student/enums/student.enums';

export class ReplaceHrAttachmentDto {
  // 用旧 storageKey 确定 HR 想替换哪个附件。
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  oldStorageKey!: string;

  @IsEnum(AttachmentType, {
    message: '附件类型只能是 resume、id_card 或 other',
  })
  type!: AttachmentType;
}
