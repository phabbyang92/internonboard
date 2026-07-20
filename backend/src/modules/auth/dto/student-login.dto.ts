import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../../common/transforms/trim-string.transform';

export class StudentLoginDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @TrimString()
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
