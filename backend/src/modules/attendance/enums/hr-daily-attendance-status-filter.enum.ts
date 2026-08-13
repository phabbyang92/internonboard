import { AttendanceStatus } from './attendance-status.enum';

// 每日考勤页除了单一状态，还支持“已打卡”这个按时 + 迟到的组合筛选。
export enum HrDailyAttendanceStatusFilter {
  CheckedIn = 'checked_in',
  OnTime = AttendanceStatus.OnTime,
  Late = AttendanceStatus.Late,
  Leave = AttendanceStatus.Leave,
  Absent = AttendanceStatus.Absent,
}
