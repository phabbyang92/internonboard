import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../../common/transforms/trim-string.transform';

export class FamilyMemberDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  relation!: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(200)
  employer?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
