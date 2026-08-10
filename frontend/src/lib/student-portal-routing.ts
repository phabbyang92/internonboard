import type { StudentPortalState } from "@/types/attendance";

export const STUDENT_PORTAL_PATHS: Record<StudentPortalState, string> = {
  registration: "/student/form",
  waiting: "/student/submitted",
  attendance: "/student/attendance",
  ended: "/student/ended",
};

export function getStudentPortalPath(state: StudentPortalState): string {
  return STUDENT_PORTAL_PATHS[state];
}
