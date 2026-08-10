import type { AttendanceSource } from '../enums/attendance-source.enum';
import type { AttendanceStatus } from '../enums/attendance-status.enum';
import type { CheckInMode } from '../enums/check-in-mode.enum';
import type { LateLevel } from '../enums/late-level.enum';

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
  correctedAt: Date;
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
  checkInAt: Date | null;
  assignedWorkLocation: string;
  checkInMode: CheckInMode | null;
  checkInLocation: string | null;
  correction: HrAttendanceCorrectionMetadata | null;
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

export interface HrStudentAttendanceSummary {
  totalAttendanceDays: number;
  late: HrAttendanceStatusDates;
  leave: HrAttendanceStatusDates;
  absent: HrAttendanceStatusDates;
  onlineAttendanceDays: number;
  offlineAttendanceDays: number;
  latestCheckIn: {
    attendanceDate: string;
    checkInAt: Date;
    assignedWorkLocation: string;
    checkInMode: CheckInMode;
    checkInLocation: string | null;
  } | null;
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
    onboardingStartAt: Date | null;
    onboardingEndAt: Date | null;
    currentWorkLocation: string | null;
  };
  summary: HrStudentAttendanceSummary;
  items: HrAttendanceRecordItem[];
}

export interface CorrectAttendanceRecordResponse {
  message: string;
  record: HrAttendanceRecordItem;
}
