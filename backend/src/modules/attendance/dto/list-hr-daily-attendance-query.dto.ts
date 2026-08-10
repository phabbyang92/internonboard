import { IsEnum, IsOptional, Matches } from 'class-validator';
import { ATTENDANCE_DATE_PATTERN } from '../attendance.constants';
import { AttendanceStatus } from '../enums/attendance-status.enum';
import { HrDailyAttendanceSort } from '../enums/hr-attendance-sort.enum';
import { HrAttendanceListQueryDto } from './hr-attendance-list-query.dto';

export class ListHrDailyAttendanceQueryDto extends HrAttendanceListQueryDto {
  @Matches(ATTENDANCE_DATE_PATTERN, {
    message: '查询日期格式必须为 YYYY-MM-DD',
  })
  date!: string;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @IsEnum(HrDailyAttendanceSort)
  sortBy: HrDailyAttendanceSort = HrDailyAttendanceSort.StudentNameAsc;
}
