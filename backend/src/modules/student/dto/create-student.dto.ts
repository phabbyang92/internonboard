import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TrimString } from '../../../common/transforms/trim-string.transform';

export class CreateStudentDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @TrimString()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
