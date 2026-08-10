import { IsEnum, Matches } from 'class-validator';
import { ATTENDANCE_MONTH_PATTERN } from '../attendance.constants';
import { HrAttendanceSummarySort } from '../enums/hr-attendance-sort.enum';
import { HrAttendanceListQueryDto } from './hr-attendance-list-query.dto';

export class ListHrAttendanceSummaryQueryDto extends HrAttendanceListQueryDto {
  @Matches(ATTENDANCE_MONTH_PATTERN, {
    message: '查询月份格式必须为 YYYY-MM',
  })
  month!: string;

  @IsEnum(HrAttendanceSummarySort)
  sortBy: HrAttendanceSummarySort = HrAttendanceSummarySort.StudentNameAsc;
}
