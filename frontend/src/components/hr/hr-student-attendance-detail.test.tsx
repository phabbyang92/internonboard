import { HrStudentAttendanceDetail } from "@/components/hr/hr-student-attendance-detail";
import { getHrStudentAttendance } from "@/lib/api/hr-attendance";
import { ApiError } from "@/lib/api/client";
import type { HrUser } from "@/types/hr";
import type { HrStudentAttendanceDetailResponse } from "@/types/hr-attendance";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

vi.mock("@/lib/api/hr-attendance", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/hr-attendance")>();
  return { ...actual, getHrStudentAttendance: vi.fn() };
});

const mockedGetStudentAttendance = vi.mocked(getHrStudentAttendance);

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

function makeDetailResponse(): HrStudentAttendanceDetailResponse {
  return {
    month: "2026-08",
    student: {
      id: "student-1",
      name: "考勤详情学生",
      email: "attendance.detail@example.com",
      phone: "13800000001",
      ownerHr: { id: "hr-1", name: "HR 1" },
      onboardingStartAt: "2026-08-01T00:00:00.000Z",
      onboardingEndAt: "2026-10-31T00:00:00.000Z",
      currentWorkLocation: "上海办公室 - 会德丰",
    },
    summary: {
      totalAttendanceDays: 8,
      late: { count: 1, dates: ["2026-08-03"] },
      leave: { count: 1, dates: ["2026-08-05"] },
      absent: { count: 1, dates: ["2026-08-04"] },
      onlineAttendanceDays: 5,
      offlineAttendanceDays: 3,
      latestCheckIn: {
        attendanceDate: "2026-08-07",
        checkInAt: "2026-08-07T01:02:00.000Z",
        assignedWorkLocation: "上海办公室 - 会德丰",
        checkInMode: "offline",
        checkInLocation: "上海办公室 - 会德丰",
      },
    },
    items: [
      {
        id: "attendance-1",
        attendanceDate: "2026-08-03",
        status: "absent",
        lateLevel: "severe",
        source: "hr_correction",
        checkInAt: "2026-08-03T02:42:00.000Z",
        assignedWorkLocation: "上海办公室 - 会德丰",
        checkInMode: "offline",
        checkInLocation: "上海办公室 - 会德丰",
        correction: {
          correctedByHrId: "hr-1",
          correctedAt: "2026-08-03T04:00:00.000Z",
          reason: "补充严重迟到记录",
          originalStatus: "late",
          count: 2,
        },
      },
    ],
  };
}

describe("HrStudentAttendanceDetail", () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    mockedGetStudentAttendance.mockReset();
  });

  it("loads the selected month and renders the student summary and records", async () => {
    mockedGetStudentAttendance.mockResolvedValue(makeDetailResponse());

    render(
      <HrStudentAttendanceDetail
        studentId="student-1"
        initialMonth="2026-08"
        user={regularHr}
      />,
    );

    expect(await screen.findByText("考勤详情学生")).toBeInTheDocument();
    expect(mockedGetStudentAttendance).toHaveBeenCalledWith(
      "student-1",
      "2026-08",
    );
    expect(screen.getByText("attendance.detail@example.com · 13800000001"))
      .toBeInTheDocument();
    expect(screen.getByLabelText("迟到1天")).toHaveTextContent("2026/08/03");
    expect(screen.getByLabelText("请假1天")).toHaveTextContent("2026/08/05");
    expect(screen.getByLabelText("缺勤1天")).toHaveTextContent("2026/08/04");
    expect(screen.getByText("严重迟到（缺勤）")).toBeInTheDocument();
    expect(screen.getByText("补充严重迟到记录")).toBeInTheDocument();
    expect(screen.getByText(/共更正 2 次/)).toBeInTheDocument();
  });

  it("shows the owner context and an empty monthly record state for an admin", async () => {
    const response = makeDetailResponse();
    response.items = [];
    response.summary.latestCheckIn = null;
    mockedGetStudentAttendance.mockResolvedValue(response);

    render(
      <HrStudentAttendanceDetail
        studentId="student-1"
        initialMonth="2026-08"
        user={adminHr}
      />,
    );

    expect(await screen.findByText("考勤详情学生")).toBeInTheDocument();
    expect(screen.getByText("管理员可跨 HR 查看")).toBeInTheDocument();
    expect(screen.getByText("本月暂无签到记录。")).toBeInTheDocument();
    expect(screen.getByText("该月暂无考勤记录")).toBeInTheDocument();
  });

  it("redirects to HR login when the session has expired", async () => {
    mockedGetStudentAttendance.mockRejectedValue(
      new ApiError("登录已过期", 401),
    );

    render(
      <HrStudentAttendanceDetail
        studentId="student-1"
        initialMonth="2026-08"
        user={regularHr}
      />,
    );

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/hr/login");
    });
  });
});
