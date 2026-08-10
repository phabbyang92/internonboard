import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import { TrimString } from '../../../common/transforms/trim-string.transform';
import { ATTENDANCE_DATE_PATTERN } from '../attendance.constants';
import { AttendanceCalendarScope } from '../enums/attendance-calendar-scope.enum';
import { RegionCode } from '../enums/region-code.enum';

export class CreateCalendarExceptionDto {
  @Matches(ATTENDANCE_DATE_PATTERN, {
    message: '开始日期格式必须为 YYYY-MM-DD',
  })
  startDate!: string;

  @Matches(ATTENDANCE_DATE_PATTERN, {
    message: '结束日期格式必须为 YYYY-MM-DD',
  })
  endDate!: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsEnum(AttendanceCalendarScope)
  scope!: AttendanceCalendarScope;

  @IsOptional()
  @IsEnum(RegionCode)
  regionCode?: RegionCode | null;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
