import { AttendanceStatus } from '../enums/attendance-status.enum';
import { CheckInMode } from '../enums/check-in-mode.enum';
import { LateLevel } from '../enums/late-level.enum';

export interface AttendanceCheckInResponse {
  attendanceDate: string;
  status: AttendanceStatus;
  lateLevel: LateLevel | null;
  message: string;
  checkInAt: Date;
  assignedWorkLocation: string;
  checkInMode: CheckInMode;
  checkInLocation: string;
}
