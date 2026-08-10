export const STUDENT_SESSION_EXPIRED_PATH =
  "/student/login?reason=session-expired";

export function isStudentSessionExpiredReason(value: string | null): boolean {
  return value === "session-expired";
}
