import { ApiError, apiRequest } from "@/lib/api/client";
import type {
  CorrectHrAttendanceRecordPayload,
  CorrectHrAttendanceRecordResponse,
  HrAttendanceListQuery,
  HrAttendanceRequestError,
  HrAttendanceSummaryQuery,
  HrAttendanceSummaryResponse,
  HrDailyAttendanceQuery,
  HrDailyAttendanceResponse,
  HrStudentAttendanceDetailResponse,
} from "@/types/hr-attendance";

function appendListQuery(
  searchParams: URLSearchParams,
  query: HrAttendanceListQuery,
) {
  if (query.page !== undefined) {
    searchParams.set("page", String(query.page));
  }

  if (query.limit !== undefined) {
    searchParams.set("limit", String(query.limit));
  }

  if (query.keyword?.trim()) {
    searchParams.set("keyword", query.keyword.trim());
  }

  if (query.workLocation) {
    searchParams.set("workLocation", query.workLocation);
  }

  if (query.checkInMode) {
    searchParams.set("checkInMode", query.checkInMode);
  }

  if (query.ownerHrId) {
    searchParams.set("ownerHrId", query.ownerHrId);
  }
}

export function listHrDailyAttendance(
  query: HrDailyAttendanceQuery,
): Promise<HrDailyAttendanceResponse> {
  const searchParams = new URLSearchParams({ date: query.date });

  appendListQuery(searchParams, query);

  if (query.status) {
    searchParams.set("status", query.status);
  }

  if (query.sortBy) {
    searchParams.set("sortBy", query.sortBy);
  }

  return apiRequest<HrDailyAttendanceResponse>(
    `/api/hr/attendance/daily?${searchParams.toString()}`,
    { method: "GET" },
  );
}

export function listHrAttendanceSummary(
  query: HrAttendanceSummaryQuery,
): Promise<HrAttendanceSummaryResponse> {
  const searchParams = new URLSearchParams({ month: query.month });

  appendListQuery(searchParams, query);

  if (query.sortBy) {
    searchParams.set("sortBy", query.sortBy);
  }

  return apiRequest<HrAttendanceSummaryResponse>(
    `/api/hr/attendance/summary?${searchParams.toString()}`,
    { method: "GET" },
  );
}

export function getHrStudentAttendance(
  studentId: string,
  month: string,
): Promise<HrStudentAttendanceDetailResponse> {
  const query = new URLSearchParams({ month });

  return apiRequest<HrStudentAttendanceDetailResponse>(
    `/api/hr/attendance/students/${encodeURIComponent(studentId)}?${query.toString()}`,
    { method: "GET" },
  );
}

export function correctHrAttendanceRecord(
  studentId: string,
  attendanceDate: string,
  payload: CorrectHrAttendanceRecordPayload,
): Promise<CorrectHrAttendanceRecordResponse> {
  return apiRequest<CorrectHrAttendanceRecordResponse>(
    `/api/hr/attendance/students/${encodeURIComponent(studentId)}/records/${encodeURIComponent(attendanceDate)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function normalizeHrAttendanceError(
  error: unknown,
  fallbackMessage = "考勤请求失败，请稍后重试",
): HrAttendanceRequestError {
  if (!(error instanceof ApiError)) {
    return {
      message: fallbackMessage,
      statusCode: null,
      requiresLogin: false,
    };
  }

  if (error.statusCode === 401) {
    return {
      message: "HR 登录已过期，请重新登录",
      statusCode: error.statusCode,
      requiresLogin: true,
    };
  }

  return {
    // 400/403/404 等错误直接采用后端已经校验过的业务提示。
    message: error.message || fallbackMessage,
    statusCode: error.statusCode,
    requiresLogin: false,
  };
}
