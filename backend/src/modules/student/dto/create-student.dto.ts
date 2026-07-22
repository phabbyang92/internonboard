import {
  IsEmail,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { TrimString } from '../../../common/transforms/trim-string.transform';
import { WorkLocation } from '../enums/student.enums';

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

  @ValidateIf(
    (dto: CreateStudentDto) =>
      dto.workLocation !== undefined || dto.onboardingStartAt !== undefined,
  )
  @IsEnum(WorkLocation, { message: '工作地点不在允许范围内' })
  workLocation?: WorkLocation;

  @ValidateIf(
    (dto: CreateStudentDto) =>
      dto.workLocation !== undefined || dto.onboardingStartAt !== undefined,
  )
  @IsISO8601({ strict: true }, { message: '入职开始日期格式错误' })
  onboardingStartAt?: string;
}
