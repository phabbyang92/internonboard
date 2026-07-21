import { API_BASE_URL, ApiError, apiRequest, getErrorMessage } from "@/lib/api/client";
import type {
  AttachmentMutationResult,
  BatchUpdateHrArrangementPayload,
  CreateHrStudentPayload,
  CreateHrStudentResponse,
  HrStudentDetail,
  HrStudentListQuery,
  HrStudentListResponse,
  OperationLogResponse,
  UpdateHrArrangementPayload,
  UpdateHrProfilePayload,
  WorkLocationHistoryResponse,
} from "@/types/hr";
import type { AttachmentType } from "@/types/student";

export function listHrStudents(
  query: HrStudentListQuery,
): Promise<HrStudentListResponse> {
  const searchParams = new URLSearchParams();

  searchParams.set("page", String(query.page ?? 1));
  searchParams.set("limit", String(query.limit ?? 20));

  if (query.keyword?.trim()) {
    searchParams.set("keyword", query.keyword.trim());
  }

  if (query.status) {
    searchParams.set("status", query.status);
  }

  return apiRequest<HrStudentListResponse>(
    `/api/hr/students?${searchParams.toString()}`,
    { method: "GET" },
  );
}

export function createHrStudent(
  payload: CreateHrStudentPayload,
): Promise<CreateHrStudentResponse> {
  return apiRequest<CreateHrStudentResponse>("/api/hr/students", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getHrStudent(id: string): Promise<HrStudentDetail> {
  return apiRequest<HrStudentDetail>(`/api/hr/students/${id}`);
}

export function updateHrStudentProfile(
  id: string,
  payload: UpdateHrProfilePayload,
): Promise<HrStudentDetail> {
  return apiRequest<HrStudentDetail>(`/api/hr/students/${id}/profile`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updateHrStudentArrangement(
  id: string,
  payload: UpdateHrArrangementPayload,
): Promise<unknown> {
  return apiRequest(`/api/hr/students/${id}/arrangement`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function batchUpdateHrStudentArrangement(
  payload: BatchUpdateHrArrangementPayload,
): Promise<unknown> {
  return apiRequest("/api/hr/students/batch-arrangement", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getWorkLocationHistory(
  id: string,
): Promise<WorkLocationHistoryResponse> {
  return apiRequest(`/api/hr/students/${id}/work-location-history`);
}

export function getOperationLogs(
  id: string,
  page = 1,
): Promise<OperationLogResponse> {
  return apiRequest(`/api/hr/students/${id}/operation-logs?page=${page}&limit=20`);
}

export function softDeleteHrStudent(id: string, reason?: string): Promise<unknown> {
  return apiRequest(`/api/hr/students/${id}`, {
    method: "DELETE",
    body: JSON.stringify(reason?.trim() ? { reason: reason.trim() } : {}),
  });
}

function attachmentFormData(
  type: AttachmentType,
  file: File,
  oldStorageKey?: string,
) {
  const body = new FormData();
  body.set("type", type);
  body.set("file", file);
  if (oldStorageKey) body.set("oldStorageKey", oldStorageKey);
  return body;
}

export function uploadHrAttachment(
  id: string,
  type: AttachmentType,
  file: File,
): Promise<AttachmentMutationResult> {
  return apiRequest(`/api/hr/students/${id}/attachments`, {
    method: "POST",
    body: attachmentFormData(type, file),
  });
}

export function replaceHrAttachment(
  id: string,
  oldStorageKey: string,
  type: AttachmentType,
  file: File,
): Promise<AttachmentMutationResult> {
  return apiRequest(`/api/hr/students/${id}/attachments/replace`, {
    method: "PUT",
    body: attachmentFormData(type, file, oldStorageKey),
  });
}

export function deleteHrAttachment(id: string, storageKey: string): Promise<unknown> {
  const query = new URLSearchParams({ storageKey });
  return apiRequest(`/api/hr/students/${id}/attachments?${query}`, {
    method: "DELETE",
  });
}

export async function downloadHrAttachment(id: string, storageKey: string) {
  const query = new URLSearchParams({ storageKey });
  const response = await fetch(
    `${API_BASE_URL}/api/hr/students/${id}/attachments/download?${query}`,
    { credentials: "include" },
  );

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    throw new ApiError(getErrorMessage(data), response.status);
  }

  return response.blob();
}
