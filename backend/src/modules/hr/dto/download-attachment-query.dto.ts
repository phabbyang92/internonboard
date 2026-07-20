import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DownloadAttachmentQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  storageKey!: string;
}
