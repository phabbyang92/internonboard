import { HrDailyAttendance } from "@/components/hr/hr-daily-attendance";
import { listHrUsers } from "@/lib/api/hr-auth";
import { listHrDailyAttendance } from "@/lib/api/hr-attendance";
import { ApiError } from "@/lib/api/client";
import type { HrUser } from "@/types/hr";
import type { HrDailyAttendanceResponse } from "@/types/hr-attendance";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

vi.mock("@/lib/api/hr-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hr-auth")>();
  return { ...actual, listHrUsers: vi.fn() };
});

vi.mock("@/lib/api/hr-attendance", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/hr-attendance")>();
  return { ...actual, listHrDailyAttendance: vi.fn() };
});

const mockedListHrUsers = vi.mocked(listHrUsers);
const mockedListDaily = vi.mocked(listHrDailyAttendance);

const regularHr: HrUser = {
  id: "hr-1",
  email: "hr1@example.com",
  name: "HR 1",
  role: "hr",
};

const adminHr: HrUser = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin HR",
  role: "admin",
};

function makeDailyResponse(): HrDailyAttendanceResponse {
  return {
    attendanceDate: "2026-08-07",
    summary: {
      totalStudents: 5,
      checkedIn: 2,
      onTime: 1,
      late: 1,
      leave: 1,
      absent: 2,
    },
    items: [
      {
        id: "record-1",
        attendanceDate: "2026-08-07",
        status: "on_time",
        lateLevel: null,
        source: "check_in",
        checkInAt: "2026-08-07T01:02:03.000Z",
        assignedWorkLocation: "上海办公室 - 会德丰",
        checkInMode: "offline",
        checkInLocation: "上海办公室 - 会德丰",
        correction: null,
        student: {
          id: "student-1",
          name: "测试学生",
          email: "student@example.com",
          ownerHr: { id: "hr-1", name: "HR 1" },
        },
      },
    ],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };
}

describe("HrDailyAttendance", () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    mockedListHrUsers.mockReset();
    mockedListDaily.mockReset();
    mockedListHrUsers.mockResolvedValue({ items: [regularHr] });
  });

  it("loads and renders the daily records for a regular HR", async () => {
    mockedListDaily.mockResolvedValue(makeDailyResponse());

    render(<HrDailyAttendance user={regularHr} />);

    expect(await screen.findByText("测试学生")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "测试学生" })).toHaveAttribute(
      "href",
      "/hr/attendance/students/student-1?month=2026-08",
    );
    expect(screen.getByText("09:02:03")).toBeInTheDocument();
    expect(screen.getByText("线下签到")).toBeInTheDocument();
    expect(screen.getByText("学生签到")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更正" })).toBeInTheDocument();

    const summary = screen.getByLabelText("每日出勤统计");
    expect(within(summary).getByText("全部学生")).toBeInTheDocument();
    expect(within(summary).getByText("5")).toBeInTheDocument();
    expect(within(summary).getAllByText("2")).toHaveLength(2);

    expect(mockedListHrUsers).not.toHaveBeenCalled();
    expect(mockedListDaily).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 20,
        sortBy: "student_name_asc",
      }),
    );
  });

  it("shows owner controls and corrected severe lateness for an admin", async () => {
    const response = makeDailyResponse();
    response.items[0] = {
      ...response.items[0],
      status: "absent",
      lateLevel: "severe",
      source: "hr_correction",
      correction: {
        correctedByHrId: "admin-1",
        correctedAt: "2026-08-07T04:00:00.000Z",
        reason: "HR 核实后更正",
        originalStatus: "late",
        count: 1,
      },
    };
    mockedListDaily.mockResolvedValue(response);

    render(<HrDailyAttendance user={adminHr} />);

    expect(await screen.findByText("测试学生")).toBeInTheDocument();
    expect(mockedListHrUsers).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("负责 HR")).toHaveLength(2);
    expect(screen.getByText("严重迟到（缺勤）")).toBeInTheDocument();
    expect(screen.getByText("HR 已更正")).toBeInTheDocument();
  });

  it("uses the summary cards as synchronized attendance filters", async () => {
    const user = userEvent.setup();
    mockedListDaily.mockResolvedValue(makeDailyResponse());

    render(<HrDailyAttendance user={regularHr} />);

    const checkedInCard = await screen.findByRole("button", {
      name: /已打卡/,
    });
    await user.click(checkedInCard);

    await waitFor(() => {
      expect(mockedListDaily).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "checked_in", page: 1 }),
      );
    });
    expect(checkedInCard).toHaveAttribute("aria-pressed", "true");

    const leaveCard = screen.getByRole("button", { name: /请假/ });
    await user.click(leaveCard);

    await waitFor(() => {
      expect(mockedListDaily).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "leave", page: 1 }),
      );
    });
    expect(leaveCard).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: /全部学生/ }));
    await waitFor(() => {
      expect(mockedListDaily).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: undefined, page: 1 }),
      );
    });
  });

  it("redirects to HR login when the session has expired", async () => {
    mockedListDaily.mockRejectedValue(new ApiError("登录已过期", 401));

    render(<HrDailyAttendance user={regularHr} />);

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/hr/login");
    });
  });
});
