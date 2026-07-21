import { apiRequest } from "@/lib/api/client";
import type {
  HrLoginPayload,
  HrLoginResponse,
  HrMeResponse,
} from "@/types/hr";

export function loginHr(payload: HrLoginPayload): Promise<HrLoginResponse> {
  return apiRequest<HrLoginResponse>("/api/hr/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCurrentHr(): Promise<HrMeResponse> {
  return apiRequest<HrMeResponse>("/api/hr/me", { method: "GET" });
}

export function logoutHr(): Promise<void> {
  return apiRequest<void>("/api/hr/logout", { method: "POST" });
}
