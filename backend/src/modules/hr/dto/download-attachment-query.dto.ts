import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../../common/transforms/trim-string.transform';

export class DownloadAttachmentQueryDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  storageKey!: string;
}
