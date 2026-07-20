import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { TrimString } from '../../../common/transforms/trim-string.transform';

export class HrLoginDto {
  @TrimString()
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
