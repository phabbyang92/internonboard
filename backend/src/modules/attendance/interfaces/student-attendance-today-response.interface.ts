import { AttendanceStatus } from '../enums/attendance-status.enum';
import { CheckInMode } from '../enums/check-in-mode.enum';

export type AttendanceTodayStatus =
  'pending' | 'not_required' | AttendanceStatus;

export interface StudentAttendanceTodayResponse {
  attendanceDate: string;
  isWorkday: boolean;
  assignedWorkLocation: string | null;
  allowedCheckInModes: CheckInMode[];
  officeNetworkRequiredFor: CheckInMode[];
  checkInWindow: 'open' | 'closed';
  status: AttendanceTodayStatus;
  checkInAt: Date | null;
}
