import { useStudentPortalAccess } from "@/hooks/use-student-portal-access";
import { ApiError } from "@/lib/api/client";
import { getStudentPortal } from "@/lib/api/student-attendance";
import { STUDENT_SESSION_EXPIRED_PATH } from "@/lib/student-session";
import type { StudentPortalResponse } from "@/types/attendance";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/lib/api/student-attendance", () => ({
  getStudentPortal: vi.fn(),
}));

const mockedGetStudentPortal = vi.mocked(getStudentPortal);

function makePortal(
  portalState: StudentPortalResponse["portalState"],
): StudentPortalResponse {
  return {
    portalState,
    student: {
      id: "student-id",
      name: "测试学生",
      onboardingStatus:
        portalState === "attendance" ? "onboarded" : "pending_onboarding",
    },
  };
}

describe("useStudentPortalAccess", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    mockedGetStudentPortal.mockReset();
  });

  it("exposes the portal only when it matches the protected page", async () => {
    mockedGetStudentPortal.mockResolvedValue(makePortal("attendance"));

    const { result } = renderHook(() =>
      useStudentPortalAccess("attendance"),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.portal?.portalState).toBe("attendance");
    expect(result.current.errorMessage).toBe("");
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects a student whose current portal state does not match", async () => {
    mockedGetStudentPortal.mockResolvedValue(makePortal("ended"));

    const { result } = renderHook(() =>
      useStudentPortalAccess("attendance"),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(replaceMock).toHaveBeenCalledWith("/student/ended");
    expect(result.current.portal).toBeNull();
  });

  it("redirects an expired session to login", async () => {
    mockedGetStudentPortal.mockRejectedValue(new ApiError("请先登录", 401));

    const { result } = renderHook(() =>
      useStudentPortalAccess("attendance"),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(replaceMock).toHaveBeenCalledWith(STUDENT_SESSION_EXPIRED_PATH);
    expect(result.current.errorMessage).toBe("");
  });

  it("keeps a backend business error on the current page", async () => {
    mockedGetStudentPortal.mockRejectedValue(new ApiError("读取失败", 503));

    const { result } = renderHook(() =>
      useStudentPortalAccess("attendance"),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.errorMessage).toBe("读取失败");
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
