import { Matches } from 'class-validator';
import { ATTENDANCE_MONTH_PATTERN } from '../attendance.constants';

export class GetHrStudentAttendanceQueryDto {
  @Matches(ATTENDANCE_MONTH_PATTERN, {
    message: '查询月份格式必须为 YYYY-MM',
  })
  month!: string;
}
