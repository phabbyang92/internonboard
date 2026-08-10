import {
  STUDENT_PORTAL_PATHS,
  getStudentPortalPath,
} from "@/lib/student-portal-routing";
import { describe, expect, it } from "vitest";

describe("student portal routing", () => {
  it.each([
    ["registration", "/student/form"],
    ["waiting", "/student/submitted"],
    ["attendance", "/student/attendance"],
    ["ended", "/student/ended"],
  ] as const)("routes %s students to %s", (state, path) => {
    expect(getStudentPortalPath(state)).toBe(path);
    expect(STUDENT_PORTAL_PATHS[state]).toBe(path);
  });
});
