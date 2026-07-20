import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { TrimString } from '../../../common/transforms/trim-string.transform';
import { BasicInfoDto } from './basic-info.dto';
import { EducationExperienceDto } from './education-experience.dto';
import { FamilyMemberDto } from './family-member.dto';
import { InternshipExperienceDto } from './internship-experience.dto';

export class SubmitStudentFormDto {
  // 姓名和邮箱来自 HR 预录入记录，学生只补充联系电话。
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone!: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => BasicInfoDto)
  basicInfo!: BasicInfoDto;

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => EducationExperienceDto)
  educationExperiences!: EducationExperienceDto[];

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => FamilyMemberDto)
  familyMembers!: FamilyMemberDto[];

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => InternshipExperienceDto)
  internshipExperiences!: InternshipExperienceDto[];

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  emergencyContactName!: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  emergencyContactPhone!: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  emergencyContactRelation!: string;

  @IsBoolean()
  hasIdCopyAndAgreement!: boolean;

  @IsOptional()
  @IsISO8601({ strict: true })
  agreementSignedAt?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  applicantSignature!: string;

  @IsISO8601({ strict: true })
  applicantSignedAt!: string;

  // 入职结束时间由学生填写；开始时间和地点仍由 HR 控制。
  @IsISO8601({ strict: true })
  onboardingEndAt!: string;
}
