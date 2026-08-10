import { apiRequest } from "@/lib/api/client";
import type {
  AttendanceCalendarScope,
  AttendanceRegionCode,
  CreateHrCalendarPayload,
  CreateHrCalendarResponse,
  HrCalendarAccessResponse,
  HrCalendarException,
  HrCalendarListResponse,
  HrRegionPermissionListResponse,
  HrOfficeNetworkListResponse,
  UpdateHrCalendarPayload,
  UpdateHrOfficeNetworkPayload,
  UpdateHrOfficeNetworkResponse,
  UpdateHrRegionPermissionResponse,
} from "@/types/hr-attendance-settings";

export function getHrCalendarAccess(): Promise<HrCalendarAccessResponse> {
  return apiRequest<HrCalendarAccessResponse>(
    "/api/hr/attendance/calendar/access",
    { method: "GET" },
  );
}

export function listHrCalendarExceptions(query: {
  month: string;
  scope?: AttendanceCalendarScope;
  regionCode?: AttendanceRegionCode;
}): Promise<HrCalendarListResponse> {
  const searchParams = new URLSearchParams({ month: query.month });

  if (query.scope) searchParams.set("scope", query.scope);
  if (query.regionCode) searchParams.set("regionCode", query.regionCode);

  return apiRequest<HrCalendarListResponse>(
    `/api/hr/attendance/calendar?${searchParams.toString()}`,
    { method: "GET" },
  );
}

export function createHrCalendarException(
  payload: CreateHrCalendarPayload,
): Promise<CreateHrCalendarResponse> {
  return apiRequest<CreateHrCalendarResponse>(
    "/api/hr/attendance/calendar",
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export function updateHrCalendarException(
  calendarId: string,
  payload: UpdateHrCalendarPayload,
): Promise<HrCalendarException> {
  return apiRequest<HrCalendarException>(
    `/api/hr/attendance/calendar/${encodeURIComponent(calendarId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
}

export function deleteHrCalendarException(
  calendarId: string,
): Promise<{ id: string; deletedAt: string }> {
  return apiRequest<{ id: string; deletedAt: string }>(
    `/api/hr/attendance/calendar/${encodeURIComponent(calendarId)}`,
    { method: "DELETE" },
  );
}

export function listHrRegionPermissions(): Promise<HrRegionPermissionListResponse> {
  return apiRequest<HrRegionPermissionListResponse>("/api/hr/admin/users", {
    method: "GET",
  });
}

export function updateHrRegionPermissions(
  hrUserId: string,
  managedRegionCodes: AttendanceRegionCode[],
): Promise<UpdateHrRegionPermissionResponse> {
  return apiRequest<UpdateHrRegionPermissionResponse>(
    `/api/hr/admin/users/${encodeURIComponent(hrUserId)}/regions`,
    {
      method: "PATCH",
      body: JSON.stringify({ managedRegionCodes }),
    },
  );
}

export function listHrOfficeNetworks(): Promise<HrOfficeNetworkListResponse> {
  return apiRequest<HrOfficeNetworkListResponse>(
    "/api/hr/attendance/office-networks",
    { method: "GET" },
  );
}

export function updateHrOfficeNetwork(
  workLocation: string,
  payload: UpdateHrOfficeNetworkPayload,
): Promise<UpdateHrOfficeNetworkResponse> {
  return apiRequest<UpdateHrOfficeNetworkResponse>(
    `/api/hr/attendance/office-networks/${encodeURIComponent(workLocation)}`,
    { method: "PUT", body: JSON.stringify(payload) },
  );
}
