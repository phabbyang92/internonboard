import { IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../../common/transforms/trim-string.transform';

export class UpdateHrMemoDto {
  @TrimString()
  @IsString()
  @MaxLength(100)
  memo!: string;
}
