import type { AttendanceStatus } from '../enums/attendance-status.enum';
import type { CheckInMode } from '../enums/check-in-mode.enum';
import type { LateLevel } from '../enums/late-level.enum';

export interface AttendanceStatusSummary {
  count: number;
  dates: string[];
}

export interface StudentAttendanceRecordItem {
  attendanceDate: string;
  status: AttendanceStatus;
  lateLevel: LateLevel | null;
  checkInAt: Date | null;
  assignedWorkLocation: string;
  checkInMode: CheckInMode | null;
  checkInLocation: string | null;
}

export interface StudentAttendanceRecordsResponse {
  month: string;
  summary: {
    totalAttendanceDays: number;
    late: AttendanceStatusSummary;
    leave: AttendanceStatusSummary;
    absent: AttendanceStatusSummary;
    onlineAttendanceDays: number;
    offlineAttendanceDays: number;
  };
  items: StudentAttendanceRecordItem[];
}
