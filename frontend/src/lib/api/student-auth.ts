import { apiRequest } from "@/lib/api/client";
import type {
  StudentLoginPayload,
  StudentLoginResponse,
  StudentMeResponse,
} from "@/types/student";

export function loginStudent(
  payload: StudentLoginPayload,
): Promise<StudentLoginResponse> {
  return apiRequest<StudentLoginResponse>("/api/student/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCurrentStudent(): Promise<StudentMeResponse> {
  return apiRequest<StudentMeResponse>("/api/student/me", {
    method: "GET",
  });
}

export function logoutStudent(): Promise<void> {
  return apiRequest<void>("/api/student/logout", {
    method: "POST",
  });
}
