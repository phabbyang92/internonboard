import type { OnboardingStatus } from "@/types/student";

export const STUDENT_PORTAL_STATES = [
  "registration",
  "waiting",
  "attendance",
  "ended",
] as const;

export type StudentPortalState = (typeof STUDENT_PORTAL_STATES)[number];

export const CHECK_IN_MODES = ["online", "offline"] as const;

export type CheckInMode = (typeof CHECK_IN_MODES)[number];

export const ATTENDANCE_STATUSES = [
  "on_time",
  "late",
  "leave",
  "absent",
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type AttendanceTodayStatus =
  | "pending"
  | "not_required"
  | AttendanceStatus;

export type LateLevel = "normal" | "severe";

export const LEAVE_DATE_OPTION_REASONS = [
  "available",
  "arrangement_missing",
  "before_internship",
  "after_internship",
  "student_not_onboarded",
  "work_location_missing",
  "weekend",
  "public_holiday",
  "temporary_holiday",
  "attendance_already_recorded",
  "leave_already_registered",
  "absence_already_recorded",
] as const;

export type LeaveDateOptionReason =
  (typeof LEAVE_DATE_OPTION_REASONS)[number];

export const ATTENDANCE_ERROR_CODES = [
  "INVALID_DEVICE_ID",
  "ATTENDANCE_NOT_REQUIRED",
  "CHECK_IN_MODE_NOT_ALLOWED",
  "STUDENT_NOT_ONBOARDED",
  "OFFICE_NETWORK_REQUIRED",
  "STUDENT_ALREADY_CHECKED_IN",
  "DEVICE_ALREADY_USED",
  "INVALID_LEAVE_DATE",
  "LEAVE_DATE_OUT_OF_RANGE",
  "LEAVE_ALREADY_REGISTERED",
  "ATTENDANCE_ALREADY_RECORDED",
  "LEAVE_CANCELLATION_DATE_NOT_FUTURE",
  "LEAVE_RECORD_NOT_FOUND",
  "LEAVE_NOT_CANCELLABLE",
  "CHECK_IN_WINDOW_CLOSED",
] as const;

export type AttendanceErrorCode = (typeof ATTENDANCE_ERROR_CODES)[number];

export interface StudentPortalResponse {
  portalState: StudentPortalState;
  student: {
    id: string;
    name: string;
    onboardingStatus: OnboardingStatus;
  };
}

export interface StudentAttendanceTodayResponse {
  attendanceDate: string;
  isWorkday: boolean;
  assignedWorkLocation: string | null;
  allowedCheckInModes: CheckInMode[];
  officeNetworkRequiredFor: CheckInMode[];
  checkInWindow: "open" | "closed";
  status: AttendanceTodayStatus;
  checkInAt: string | null;
}

export interface AttendanceCheckInPayload {
  checkInMode: CheckInMode;
  deviceId: string;
}

export interface AttendanceCheckInResponse {
  attendanceDate: string;
  status: AttendanceStatus;
  lateLevel: LateLevel | null;
  message: string;
  checkInAt: string;
  assignedWorkLocation: string;
  checkInMode: CheckInMode;
  checkInLocation: string;
}

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

export interface RegisterLeavePayload {
  dates: string[];
}

export interface LeaveRegistrationResponse {
  leaveBatchId: string;
  dates: string[];
  registeredAt: string;
}

export interface LeaveCancellationResponse {
  attendanceDate: string;
  leaveBatchId: string | null;
  cancelledAt: string;
}

export interface AttendanceStatusSummary {
  count: number;
  dates: string[];
}

export interface StudentAttendanceRecordItem {
  attendanceDate: string;
  status: AttendanceStatus;
  lateLevel: LateLevel | null;
  checkInAt: string | null;
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
