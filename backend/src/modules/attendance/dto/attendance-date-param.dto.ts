import { Matches } from 'class-validator';
import { ATTENDANCE_DATE_PATTERN } from '../attendance.constants';

export class AttendanceDateParamDto {
  @Matches(ATTENDANCE_DATE_PATTERN, {
    message: '考勤日期格式必须为 YYYY-MM-DD',
  })
  attendanceDate!: string;
}
