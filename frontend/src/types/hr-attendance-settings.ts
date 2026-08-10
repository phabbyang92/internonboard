import type { HrRole } from "@/types/hr";
import type { WorkLocation } from "@/types/student";

export const ATTENDANCE_REGION_CODES = [
  "beijing",
  "hong_kong",
  "shenzhen",
  "shanghai",
  "nanjing",
  "online",
] as const;

export type AttendanceRegionCode = (typeof ATTENDANCE_REGION_CODES)[number];
export type AttendanceCalendarScope = "global" | "region";
export type AttendanceCalendarExceptionType =
  | "public_holiday"
  | "temporary_holiday";

export const ATTENDANCE_REGION_LABELS: Record<
  AttendanceRegionCode,
  string
> = {
  beijing: "北京",
  hong_kong: "香港",
  shenzhen: "深圳",
  shanghai: "上海",
  nanjing: "南京",
  online: "线上",
};

export interface HrCalendarAccessResponse {
  role: HrRole;
  managedRegionCodes: AttendanceRegionCode[];
  canManageGlobal: boolean;
}

export interface HrCalendarException {
  id: string;
  date: string;
  name: string;
  type: AttendanceCalendarExceptionType;
  scope: AttendanceCalendarScope;
  regionCode: AttendanceRegionCode | null;
  reason: string | null;
  createdByHrId: string;
  updatedByHrId: string;
  createdAt: string;
  updatedAt: string;
}

export interface HrCalendarListResponse {
  month: string;
  items: HrCalendarException[];
}

export interface CreateHrCalendarPayload {
  startDate: string;
  endDate: string;
  name: string;
  scope: AttendanceCalendarScope;
  regionCode?: AttendanceRegionCode | null;
  reason?: string;
}

export interface CreateHrCalendarResponse {
  createdCount: number;
  items: HrCalendarException[];
}

export interface UpdateHrCalendarPayload {
  date?: string;
  name?: string;
  scope?: AttendanceCalendarScope;
  regionCode?: AttendanceRegionCode | null;
  reason?: string;
}

export interface HrRegionPermissionUser {
  id: string;
  email: string;
  name: string;
  role: "hr";
  managedRegionCodes: AttendanceRegionCode[];
}

export interface HrRegionPermissionListResponse {
  items: HrRegionPermissionUser[];
}

export interface UpdateHrRegionPermissionResponse {
  message: string;
  user: HrRegionPermissionUser;
}

export interface HrOfficeNetwork {
  id: string | null;
  workLocation: Exclude<WorkLocation, "线上">;
  cidrs: string[];
  enabled: boolean;
  description: string | null;
  updatedByHrId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface HrOfficeNetworkListResponse {
  items: HrOfficeNetwork[];
}

export interface UpdateHrOfficeNetworkPayload {
  cidrs: string[];
  enabled: boolean;
  description?: string | null;
}

export interface UpdateHrOfficeNetworkResponse {
  message: string;
  item: HrOfficeNetwork;
}
