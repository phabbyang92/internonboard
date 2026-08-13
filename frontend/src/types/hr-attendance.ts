import type {
  AttendanceStatus,
  CheckInMode,
  LateLevel,
} from "@/types/attendance";
import type { WorkLocation } from "@/types/student";

export const HR_DAILY_ATTENDANCE_SORTS = [
  "student_name_asc",
  "check_in_at_asc",
  "check_in_at_desc",
] as const;

export type HrDailyAttendanceSort =
  (typeof HR_DAILY_ATTENDANCE_SORTS)[number];

export type HrDailyAttendanceStatusFilter =
  | AttendanceStatus
  | "checked_in";

export const HR_ATTENDANCE_SUMMARY_SORTS = [
  "student_name_asc",
  "total_attendance_days_desc",
  "latest_check_in_at_desc",
] as const;

export type HrAttendanceSummarySort =
  (typeof HR_ATTENDANCE_SUMMARY_SORTS)[number];

export type AttendanceSource =
  | "check_in"
  | "leave_registration"
  | "absence_scheduler"
  | "hr_correction";

export interface HrAttendancePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface HrAttendanceOwnerReference {
  id: string;
  name: string;
}

export interface HrAttendanceStudentReference {
  id: string;
  name: string;
  email: string;
  ownerHr: HrAttendanceOwnerReference;
}

export interface HrAttendanceCorrectionMetadata {
  correctedByHrId: string;
  correctedAt: string;
  reason: string;
  originalStatus: AttendanceStatus | null;
  count: number;
}

export interface HrAttendanceRecordItem {
  id: string;
  attendanceDate: string;
  status: AttendanceStatus;
  lateLevel: LateLevel | null;
  source: AttendanceSource;
  checkInAt: string | null;
  assignedWorkLocation: string;
  checkInMode: CheckInMode | null;
  checkInLocation: string | null;
  correction: HrAttendanceCorrectionMetadata | null;
}

export interface HrAttendanceListQuery {
  page?: number;
  limit?: number;
  keyword?: string;
  workLocation?: WorkLocation;
  checkInMode?: CheckInMode;
  ownerHrId?: string;
}

export interface HrDailyAttendanceQuery extends HrAttendanceListQuery {
  date: string;
  status?: HrDailyAttendanceStatusFilter;
  sortBy?: HrDailyAttendanceSort;
}

export interface HrDailyAttendanceItem extends HrAttendanceRecordItem {
  student: HrAttendanceStudentReference;
}

export interface HrDailyAttendanceResponse {
  attendanceDate: string;
  summary: {
    totalStudents: number;
    checkedIn: number;
    onTime: number;
    late: number;
    leave: number;
    absent: number;
  };
  items: HrDailyAttendanceItem[];
  pagination: HrAttendancePagination;
}

export interface HrAttendanceStatusDates {
  count: number;
  dates: string[];
}

export interface HrAttendanceLatestCheckIn {
  attendanceDate: string;
  checkInAt: string;
  assignedWorkLocation: string;
  checkInMode: CheckInMode;
  checkInLocation: string | null;
}

export interface HrStudentAttendanceSummary {
  totalAttendanceDays: number;
  late: HrAttendanceStatusDates;
  leave: HrAttendanceStatusDates;
  absent: HrAttendanceStatusDates;
  onlineAttendanceDays: number;
  offlineAttendanceDays: number;
  latestCheckIn: HrAttendanceLatestCheckIn | null;
}

export interface HrAttendanceSummaryQuery extends HrAttendanceListQuery {
  month: string;
  sortBy?: HrAttendanceSummarySort;
}

export interface HrAttendanceSummaryItem {
  student: HrAttendanceStudentReference;
  summary: HrStudentAttendanceSummary;
}

export interface HrAttendanceSummaryResponse {
  month: string;
  items: HrAttendanceSummaryItem[];
  pagination: HrAttendancePagination;
}

export interface HrStudentAttendanceDetailResponse {
  month: string;
  student: HrAttendanceStudentReference & {
    phone: string | null;
    onboardingStartAt: string | null;
    onboardingEndAt: string | null;
    currentWorkLocation: string | null;
  };
  summary: HrStudentAttendanceSummary;
  items: HrAttendanceRecordItem[];
}

export interface CorrectHrAttendanceRecordPayload {
  status: AttendanceStatus;
  reason: string;
  checkInAt?: string;
  checkInMode?: CheckInMode;
  lateLevel?: LateLevel;
  checkInLocation?: string;
}

export interface CorrectHrAttendanceRecordResponse {
  message: string;
  record: HrAttendanceRecordItem;
}

export interface HrAttendanceRequestError {
  message: string;
  statusCode: number | null;
  requiresLogin: boolean;
}
