import { apiRequest } from "@/lib/api/client";
import type {
  AttendanceCheckInPayload,
  AttendanceCheckInResponse,
  LeaveCancellationResponse,
  LeaveDateOptionsResponse,
  LeaveRegistrationResponse,
  RegisterLeavePayload,
  StudentAttendanceRecordsResponse,
  StudentAttendanceTodayResponse,
  StudentPortalResponse,
} from "@/types/attendance";

export function getStudentPortal(): Promise<StudentPortalResponse> {
  return apiRequest<StudentPortalResponse>("/api/student/portal", {
    method: "GET",
  });
}

export function getTodayAttendance(): Promise<StudentAttendanceTodayResponse> {
  return apiRequest<StudentAttendanceTodayResponse>(
    "/api/student/attendance/today",
    { method: "GET" },
  );
}

export function checkInStudentAttendance(
  payload: AttendanceCheckInPayload,
): Promise<AttendanceCheckInResponse> {
  return apiRequest<AttendanceCheckInResponse>(
    "/api/student/attendance/check-in",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function getLeaveDateOptions(): Promise<LeaveDateOptionsResponse> {
  return apiRequest<LeaveDateOptionsResponse>(
    "/api/student/attendance/leave-options",
    { method: "GET" },
  );
}

export function registerStudentLeave(
  payload: RegisterLeavePayload,
): Promise<LeaveRegistrationResponse> {
  return apiRequest<LeaveRegistrationResponse>(
    "/api/student/attendance/leaves",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function cancelStudentLeave(
  attendanceDate: string,
): Promise<LeaveCancellationResponse> {
  return apiRequest<LeaveCancellationResponse>(
    `/api/student/attendance/leaves/${encodeURIComponent(attendanceDate)}`,
    { method: "DELETE" },
  );
}

export function getStudentAttendanceRecords(
  month: string,
): Promise<StudentAttendanceRecordsResponse> {
  const query = new URLSearchParams({ month });

  return apiRequest<StudentAttendanceRecordsResponse>(
    `/api/student/attendance/records?${query.toString()}`,
    { method: "GET" },
  );
}
