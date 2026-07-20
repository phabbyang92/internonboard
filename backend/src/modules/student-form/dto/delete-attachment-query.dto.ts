import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../../common/transforms/trim-string.transform';

export class DeleteAttachmentQueryDto {
  // 附件没有单独的 attachmentId，因此使用唯一 storageKey 定位。
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  storageKey!: string;
}
