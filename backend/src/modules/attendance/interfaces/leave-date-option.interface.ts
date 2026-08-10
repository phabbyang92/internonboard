import { AttendanceStatus } from '../enums/attendance-status.enum';
import { LeaveDateOptionReason } from '../enums/leave-date-option-reason.enum';

export interface LeaveDateOption {
  attendanceDate: string;
  selectable: boolean;
  reason: LeaveDateOptionReason;
  message: string;
  workLocation: string | null;
  holidayName: string | null;
  existingStatus: AttendanceStatus | null;
}

export interface LeaveDateOptionsResponse {
  startDate: string;
  endDate: string;
  maxDaysAhead: number;
  items: LeaveDateOption[];
}
