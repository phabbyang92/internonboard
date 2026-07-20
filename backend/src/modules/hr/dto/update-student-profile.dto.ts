import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { TrimString } from '../../../common/transforms/trim-string.transform';
import { SubmitStudentFormDto } from '../../student/dto/submit-student-form.dto';
import { UpdateBasicInfoDto } from './update-basic-info.dto';

export class UpdateStudentProfileDto extends PartialType(
  // 入职结束时间属于 HR 入职安排接口，在 10B 中单独处理。
  // basicInfo 需要换成内部字段也可选的 UpdateBasicInfoDto。
  OmitType(SubmitStudentFormDto, ['basicInfo', 'onboardingEndAt'] as const),
) {
  // 姓名和邮箱不是学生提交 DTO 的字段，但 HR 可以修正预录入错误。
  @IsOptional()
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @TrimString()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateBasicInfoDto)
  basicInfo?: UpdateBasicInfoDto;
}
