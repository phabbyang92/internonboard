import { StudentAttendanceDashboard } from "@/components/student/student-attendance-dashboard";
import { useStudentAttendanceToday } from "@/hooks/use-student-attendance-today";
import type { StudentAttendanceTodayResponse } from "@/types/attendance";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/hooks/use-student-attendance-today", () => ({
  useStudentAttendanceToday: vi.fn(),
}));

const mockedUseToday = vi.mocked(useStudentAttendanceToday);
const refresh = vi.fn().mockResolvedValue(undefined);

function makeToday(
  overrides: Partial<StudentAttendanceTodayResponse> = {},
): StudentAttendanceTodayResponse {
  return {
    attendanceDate: "2026-08-07",
    isWorkday: true,
    assignedWorkLocation: "线上",
    allowedCheckInModes: ["online"],
    officeNetworkRequiredFor: [],
    checkInWindow: "open",
    status: "pending",
    checkInAt: null,
    ...overrides,
  };
}

function showToday(today: StudentAttendanceTodayResponse) {
  mockedUseToday.mockReturnValue({
    today,
    isLoading: false,
    isRefreshing: false,
    errorMessage: "",
    refresh,
  });
}

describe("StudentAttendanceDashboard", () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  it("shows the regular pending check-in state", () => {
    showToday(makeToday());

    render(<StudentAttendanceDashboard />);

    expect(screen.getByText("待登记")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /线上签到/ })).toBeEnabled();
    expect(screen.getByText("需要出勤")).toBeInTheDocument();
  });

  it("distinguishes a non-workday from a missing arrangement", () => {
    showToday(
      makeToday({
        isWorkday: false,
        allowedCheckInModes: [],
        status: "not_required",
      }),
    );

    const { rerender } = render(<StudentAttendanceDashboard />);

    expect(screen.getByText("今日休息")).toBeInTheDocument();
    expect(
      screen.getByText("今天是非工作日，无需进行出勤登记。"),
    ).toBeInTheDocument();

    showToday(
      makeToday({
        assignedWorkLocation: null,
        allowedCheckInModes: [],
        status: "not_required",
      }),
    );
    rerender(<StudentAttendanceDashboard />);

    expect(screen.getByText("待安排")).toBeInTheDocument();
    expect(screen.getByText("等待地点安排")).toBeInTheDocument();
    expect(
      screen.getByText("今天尚未安排有效工作地点，请联系 HR 确认安排。"),
    ).toBeInTheDocument();
  });

  it("renders the retry state when today data cannot be loaded", () => {
    mockedUseToday.mockReturnValue({
      today: null,
      isLoading: false,
      isRefreshing: false,
      errorMessage: "读取今日考勤失败",
      refresh,
    });

    render(<StudentAttendanceDashboard />);

    expect(screen.getByRole("alert")).toHaveTextContent("读取今日考勤失败");
    expect(
      screen.getByRole("button", { name: "重新加载" }),
    ).toBeInTheDocument();
  });
});
