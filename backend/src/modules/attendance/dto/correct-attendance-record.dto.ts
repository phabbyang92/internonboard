import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TrimString } from '../../../common/transforms/trim-string.transform';
import { AttendanceStatus } from '../enums/attendance-status.enum';
import { CheckInMode } from '../enums/check-in-mode.enum';
import { LateLevel } from '../enums/late-level.enum';

export class CorrectAttendanceRecordDto {
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @TrimString()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  reason!: string;

  // 更正为按时或迟到时可提供实际登记时间；后端仍负责业务一致性校验。
  @IsOptional()
  @IsDateString()
  checkInAt?: string;

  @IsOptional()
  @IsEnum(CheckInMode)
  checkInMode?: CheckInMode;

  @IsOptional()
  @IsEnum(LateLevel)
  lateLevel?: LateLevel;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(100)
  checkInLocation?: string;
}
