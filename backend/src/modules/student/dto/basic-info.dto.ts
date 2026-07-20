import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApplicationDirection } from '../enums/student.enums';

export class BasicInfoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  position!: string;

  @IsEnum(ApplicationDirection, {})
  applicationDirection!: ApplicationDirection;

  @IsOptional()
  @IsISO8601({ strict: true })
  formDate?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  gender!: string;

  // HTTP JSON 中的日期先使用 ISO 字符串，保存时再转换成 Date。
  @IsISO8601({ strict: true })
  birthDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  idNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  householdRegistration!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  maritalStatus?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  currentSchool!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  major!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  degree!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  politicalStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceChannel?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  homeAddress!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  homePhone?: string;
}
