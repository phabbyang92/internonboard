import { HrAttendanceSummary } from "@/components/hr/hr-attendance-summary";
import { listHrUsers } from "@/lib/api/hr-auth";
import { listHrAttendanceSummary } from "@/lib/api/hr-attendance";
import { ApiError } from "@/lib/api/client";
import type { HrUser } from "@/types/hr";
import type { HrAttendanceSummaryResponse } from "@/types/hr-attendance";
import { render, screen, waitFor } from "@testing-library/react";
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
  return { ...actual, listHrAttendanceSummary: vi.fn() };
});

const mockedListHrUsers = vi.mocked(listHrUsers);
const mockedListSummary = vi.mocked(listHrAttendanceSummary);

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

function makeSummaryResponse(): HrAttendanceSummaryResponse {
  return {
    month: "2026-08",
    items: [
      {
        student: {
          id: "student-1",
          name: "月度测试学生",
          email: "monthly.student@example.com",
          ownerHr: { id: "hr-1", name: "HR 1" },
        },
        summary: {
          totalAttendanceDays: 12,
          late: { count: 2, dates: ["2026-08-03", "2026-08-06"] },
          leave: { count: 1, dates: ["2026-08-05"] },
          absent: { count: 1, dates: ["2026-08-04"] },
          onlineAttendanceDays: 7,
          offlineAttendanceDays: 5,
          latestCheckIn: {
            attendanceDate: "2026-08-07",
            checkInAt: "2026-08-07T01:02:00.000Z",
            assignedWorkLocation: "上海办公室 - 会德丰",
            checkInMode: "offline",
            checkInLocation: "上海办公室 - 会德丰",
          },
        },
      },
    ],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };
}

describe("HrAttendanceSummary", () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    mockedListHrUsers.mockReset();
    mockedListSummary.mockReset();
    mockedListHrUsers.mockResolvedValue({ items: [regularHr] });
  });

  it("loads and renders monthly attendance totals and dates", async () => {
    mockedListSummary.mockResolvedValue(makeSummaryResponse());

    render(<HrAttendanceSummary user={regularHr} />);

    expect(await screen.findByText("月度测试学生")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByLabelText("迟到2天")).toHaveTextContent("8/3、8/6");
    expect(screen.getByLabelText("请假1天")).toHaveTextContent("8/5");
    expect(screen.getByLabelText("缺勤1天")).toHaveTextContent("8/4");
    expect(screen.getByText("线上").parentElement).toHaveTextContent("7 天");
    expect(screen.getByText("线下").parentElement).toHaveTextContent("5 天");
    expect(screen.getByText("08/07 09:02")).toBeInTheDocument();
    expect(mockedListHrUsers).not.toHaveBeenCalled();
    expect(mockedListSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 20,
        sortBy: "student_name_asc",
      }),
    );
  });

  it("shows owner filters and owner data for an admin HR", async () => {
    mockedListSummary.mockResolvedValue(makeSummaryResponse());

    render(<HrAttendanceSummary user={adminHr} />);

    expect(await screen.findByText("月度测试学生")).toBeInTheDocument();
    expect(mockedListHrUsers).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("负责 HR")).toHaveLength(2);
    expect(screen.getByText("HR 1")).toBeInTheDocument();
    expect(screen.getByLabelText("筛选汇总负责 HR")).toBeInTheDocument();
  });

  it("redirects to HR login when the session has expired", async () => {
    mockedListSummary.mockRejectedValue(new ApiError("登录已过期", 401));

    render(<HrAttendanceSummary user={regularHr} />);

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/hr/login");
    });
  });
});
