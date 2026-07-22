import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TrimString } from '../../../common/transforms/trim-string.transform';
import { ApplicationDirection } from '../enums/student.enums';

export class BasicInfoDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  position!: string;

  @IsEnum(ApplicationDirection, {})
  applicationDirection!: ApplicationDirection;

  @IsOptional()
  @IsISO8601({ strict: true })
  formDate?: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  gender!: string;

  // HTTP JSON 中的日期先使用 ISO 字符串，保存时再转换成 Date。
  @IsISO8601({ strict: true })
  birthDate!: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  idNumber!: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  householdRegistration!: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(30)
  maritalStatus?: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  currentSchool!: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  major!: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  degree!: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(50)
  politicalStatus?: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sourceChannel!: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  homeAddress!: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(30)
  homePhone?: string;
}
