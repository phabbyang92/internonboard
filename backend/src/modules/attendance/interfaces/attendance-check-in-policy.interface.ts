import { WorkLocation } from '../../student/enums/student.enums';
import { CheckInMode } from '../enums/check-in-mode.enum';

export interface AttendanceCheckInPolicy {
  assignedWorkLocation: WorkLocation;
  allowedCheckInModes: CheckInMode[];
  officeNetworkRequiredFor: CheckInMode[];
}
