import { OnboardingStatus } from '../../student/enums/student.enums';
import { AttendanceEligibilityReason } from '../enums/attendance-eligibility-reason.enum';
import type { AttendanceLocationResult } from './attendance-location-result.interface';
import type { WorkdayResult } from './workday-result.interface';

export interface AttendanceEligibilityStudentSnapshot {
  id: string;
  ownerHrId: string | null;
  onboardingStatus: OnboardingStatus;
  onboardingStartAt: Date | null;
  onboardingEndAt: Date | null;
}

export interface AttendanceEligibilityResult {
  eligible: boolean;
  reason: AttendanceEligibilityReason;
  attendanceDate: string;
  student: AttendanceEligibilityStudentSnapshot;
  location: AttendanceLocationResult | null;
  workday: WorkdayResult | null;
}
