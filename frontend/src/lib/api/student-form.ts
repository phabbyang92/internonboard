import { apiRequest } from "@/lib/api/client";
import type {
  AttachmentMutationResponse,
  AttachmentType,
  StudentFormResponse,
  SubmitStudentFormPayload,
  SubmitStudentFormResponse,
} from "@/types/student";

export function getStudentForm(): Promise<StudentFormResponse> {
  return apiRequest<StudentFormResponse>("/api/student/form", {
    method: "GET",
  });
}

export function uploadStudentAttachment(
  type: AttachmentType,
  file: File,
): Promise<AttachmentMutationResponse> {
  const body = new FormData();
  body.append("type", type);
  body.append("file", file);

  return apiRequest<AttachmentMutationResponse>("/api/student/attachments", {
    method: "POST",
    body,
  });
}

export function deleteStudentAttachment(
  storageKey: string,
): Promise<AttachmentMutationResponse> {
  const query = new URLSearchParams({ storageKey });

  return apiRequest<AttachmentMutationResponse>(
    `/api/student/attachments?${query.toString()}`,
    { method: "DELETE" },
  );
}

export function submitStudentForm(
  payload: SubmitStudentFormPayload,
): Promise<SubmitStudentFormResponse> {
  return apiRequest<SubmitStudentFormResponse>("/api/student/form/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
