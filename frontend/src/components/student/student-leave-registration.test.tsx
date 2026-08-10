import { StudentLeaveRegistration } from "@/components/student/student-leave-registration";
import { useStudentLeaveOptions } from "@/hooks/use-student-leave-options";
import type { LeaveDateOption } from "@/types/attendance";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/hooks/use-student-leave-options", () => ({
  useStudentLeaveOptions: vi.fn(),
}));

vi.mock("@/lib/api/student-attendance", () => ({
  registerStudentLeave: vi.fn(),
  cancelStudentLeave: vi.fn(),
}));

const mockedUseLeaveOptions = vi.mocked(useStudentLeaveOptions);

function makeOption(
  attendanceDate: string,
  overrides: Partial<LeaveDateOption> = {},
): LeaveDateOption {
  return {
    attendanceDate,
    selectable: true,
    reason: "available",
    message: "可登记请假",
    workLocation: "线上",
    holidayName: null,
    existingStatus: null,
    ...overrides,
  };
}

describe("StudentLeaveRegistration", () => {
  it("allows multiple valid dates and keeps disabled dates unavailable", async () => {
    const user = userEvent.setup();
    mockedUseLeaveOptions.mockReturnValue({
      options: {
        startDate: "2026-08-07",
        endDate: "2026-08-21",
        maxDaysAhead: 14,
        items: [
          makeOption("2026-08-10"),
          makeOption("2026-08-11"),
          makeOption("2026-08-12", {
            selectable: false,
            reason: "public_holiday",
            message: "系统假期无需出勤",
          }),
        ],
      },
      isLoading: false,
      isRefreshing: false,
      errorMessage: "",
      reload: vi.fn().mockResolvedValue(undefined),
    });

    render(<StudentLeaveRegistration />);

    const submitButton = screen.getByRole("button", { name: "提交请假" });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText("系统假期无需出勤")).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: /8月12日/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /8月10日/ }));
    await user.click(screen.getByRole("checkbox", { name: /8月11日/ }));

    expect(screen.getByText("已选择 2 天")).toBeInTheDocument();
    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    expect(await screen.findByText("确认提交请假")).toBeInTheDocument();
    expect(screen.getByText("将登记以下 2 个请假日期：")).toBeInTheDocument();
  });
});
