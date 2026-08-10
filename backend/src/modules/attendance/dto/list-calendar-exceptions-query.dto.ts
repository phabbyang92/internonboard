import { IsEnum, IsOptional, Matches } from 'class-validator';
import { AttendanceCalendarScope } from '../enums/attendance-calendar-scope.enum';
import { RegionCode } from '../enums/region-code.enum';

export class ListCalendarExceptionsQueryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: '月份格式必须为 YYYY-MM',
  })
  month!: string;

  @IsOptional()
  @IsEnum(AttendanceCalendarScope)
  scope?: AttendanceCalendarScope;

  @IsOptional()
  @IsEnum(RegionCode)
  regionCode?: RegionCode;
}
