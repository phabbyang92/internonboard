import { IsEnum, IsISO8601, IsOptional } from 'class-validator';
import { WorkLocation } from '../enums/student.enums';

export class UpdateStudentArrangementDto {
  @IsOptional()
  @IsEnum(WorkLocation, {
    message: '请选择有效的工作地点',
  })
  workLocation?: WorkLocation;

  @IsOptional()
  @IsISO8601({ strict: true })
  onboardingStartAt?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  onboardingEndAt?: string;
}
