import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsISO8601,
  IsMongoId,
} from 'class-validator';
import { WorkLocation } from '../enums/student.enums';

export class BatchUpdateStudentArrangementDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsMongoId({ each: true })
  studentIds!: string[];

  // 批量安排仍然要求 HR 同时提供统一地点和开始时间。
  @IsEnum(WorkLocation, {
    message: '请选择有效的工作地点',
  })
  workLocation!: WorkLocation;

  @IsISO8601({ strict: true })
  onboardingStartAt!: string;
}
