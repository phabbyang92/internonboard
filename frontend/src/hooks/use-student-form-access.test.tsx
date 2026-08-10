import { useStudentFormAccess } from "@/hooks/use-student-form-access";
import { ApiError } from "@/lib/api/client";
import { getStudentPortal } from "@/lib/api/student-attendance";
import { getStudentForm } from "@/lib/api/student-form";
import { STUDENT_SESSION_EXPIRED_PATH } from "@/lib/student-session";
import type { StudentPortalResponse } from "@/types/attendance";
import type { StudentForm } from "@/types/student";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/lib/api/student-attendance", () => ({
  getStudentPortal: vi.fn(),
}));

vi.mock("@/lib/api/student-form", () => ({
  getStudentForm: vi.fn(),
}));

const mockedGetStudentPortal = vi.mocked(getStudentPortal);
const mockedGetStudentForm = vi.mocked(getStudentForm);

function makePortal(
  portalState: StudentPortalResponse["portalState"],
): StudentPortalResponse {
  return {
    portalState,
    student: {
      id: "student-id",
      name: "测试学生",
      onboardingStatus: "pending_onboarding",
    },
  };
}

function makeForm(hasSubmitted: boolean): StudentForm {
  return {
    id: "student-id",
    name: "测试学生",
    email: "student@example.com",
    phone: null,
    onboardingStatus: "pending_onboarding",
    basicInfo: null,
    educationExperiences: [],
    familyMembers: [],
    internshipExperiences: [],
    emergencyContactName: null,
    emergencyContactPhone: null,
    emergencyContactRelation: null,
    hasIdCopyAndAgreement: null,
    agreementSignedAt: null,
    notes: null,
    applicantSignature: null,
    applicantSignedAt: null,
    attachments: [],
    workLocation: "线上",
    onboardingStartAt: "2026-08-10T00:00:00.000Z",
    onboardingEndAt: null,
    submittedAt: hasSubmitted ? "2026-08-07T01:00:00.000Z" : null,
    hasSubmitted,
    canEdit: !hasSubmitted,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-07T01:00:00.000Z",
  };
}

describe("useStudentFormAccess", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    mockedGetStudentPortal.mockReset();
    mockedGetStudentForm.mockReset();
  });

  it.each([
    ["editable", "registration", false],
    ["submitted", "waiting", true],
  ] as const)(
    "loads the form for %s mode after the portal guard passes",
    async (mode, portalState, hasSubmitted) => {
      mockedGetStudentPortal.mockResolvedValue(makePortal(portalState));
      mockedGetStudentForm.mockResolvedValue({ form: makeForm(hasSubmitted) });

      const { result } = renderHook(() => useStudentFormAccess(mode));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.form?.hasSubmitted).toBe(hasSubmitted);
      expect(replaceMock).not.toHaveBeenCalled();
    },
  );

  it("redirects by portal state without reading a protected form", async () => {
    mockedGetStudentPortal.mockResolvedValue(makePortal("attendance"));

    const { result } = renderHook(() => useStudentFormAccess("editable"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(replaceMock).toHaveBeenCalledWith("/student/attendance");
    expect(mockedGetStudentForm).not.toHaveBeenCalled();
    expect(result.current.form).toBeNull();
  });

  it("restarts portal resolution when the form snapshot is inconsistent", async () => {
    mockedGetStudentPortal.mockResolvedValue(makePortal("registration"));
    mockedGetStudentForm.mockResolvedValue({ form: makeForm(true) });

    const { result } = renderHook(() => useStudentFormAccess("editable"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(replaceMock).toHaveBeenCalledWith("/student");
    expect(result.current.form).toBeNull();
  });

  it("redirects an expired session to login", async () => {
    mockedGetStudentPortal.mockRejectedValue(new ApiError("请先登录", 401));

    const { result } = renderHook(() => useStudentFormAccess("editable"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(replaceMock).toHaveBeenCalledWith(STUDENT_SESSION_EXPIRED_PATH);
    expect(result.current.errorMessage).toBe("");
  });
});
