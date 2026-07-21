import { IsEnum, IsISO8601, IsOptional } from 'class-validator';
import { WorkLocation } from '../enums/student.enums';

export class UpdateStudentArrangementDto {
  @IsOptional()
  @IsEnum(WorkLocation, {
    message: '请选择有效的工作地点',
  })
  workLocation?: WorkLocation;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: '入职开始日期格式错误' })
  onboardingStartAt?: string;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: '实习结束日期格式错误' })
  onboardingEndAt?: string;
}
