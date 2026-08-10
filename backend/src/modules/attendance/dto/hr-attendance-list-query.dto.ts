import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TrimString } from '../../../common/transforms/trim-string.transform';
import { WorkLocation } from '../../student/enums/student.enums';
import { CheckInMode } from '../enums/check-in-mode.enum';

// 每日列表和月度汇总共享的筛选及分页契约。
export class HrAttendanceListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @IsOptional()
  @IsEnum(WorkLocation)
  workLocation?: WorkLocation;

  @IsOptional()
  @IsEnum(CheckInMode)
  checkInMode?: CheckInMode;

  // 只有 Admin HR 可以实际使用此筛选，权限判断由 6B 的 Service 完成。
  @IsOptional()
  @IsMongoId()
  ownerHrId?: string;
}
