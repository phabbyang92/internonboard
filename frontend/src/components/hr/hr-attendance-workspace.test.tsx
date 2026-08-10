import { HrAttendanceWorkspace } from "@/components/hr/hr-attendance-workspace";
import type { HrUser } from "@/types/hr";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const regularHr: HrUser = {
  id: "hr-1",
  email: "hr@example.com",
  name: "普通 HR",
  role: "hr",
};

const adminHr: HrUser = {
  ...regularHr,
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin HR",
  role: "admin",
};

describe("HrAttendanceWorkspace", () => {
  it("shows daily attendance as the active view", () => {
    render(<HrAttendanceWorkspace view="daily" user={regularHr} />);

    const dailyLink = screen.getByRole("link", { name: "每日出勤" });
    const summaryLink = screen.getByRole("link", { name: "出勤汇总" });
    const viewNavigation = screen.getByRole("navigation", {
      name: "出勤管理视图",
    });

    expect(viewNavigation).toHaveClass("grid", "grid-cols-2", "sm:flex");
    expect(dailyLink).toHaveAttribute("href", "/hr/attendance/daily");
    expect(dailyLink).toHaveAttribute("aria-current", "page");
    expect(summaryLink).toHaveAttribute("href", "/hr/attendance/summary");
    expect(summaryLink).not.toHaveAttribute("aria-current");
    expect(
      screen.getByRole("link", { name: "工作日历" }),
    ).toHaveAttribute("href", "/hr/attendance/calendar");
    expect(
      screen.queryByRole("link", { name: "地区权限" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "办公网络" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "每日出勤", level: 2 }),
    ).toBeInTheDocument();
  });

  it("renders summary content inside the shared frame", () => {
    render(
      <HrAttendanceWorkspace view="summary" user={regularHr}>
        <p>汇总内容</p>
      </HrAttendanceWorkspace>,
    );

    expect(screen.getByRole("link", { name: "出勤汇总" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("汇总内容")).toBeInTheDocument();
  });

  it("shows region permission management only to Admin HR", () => {
    render(<HrAttendanceWorkspace view="regions" user={adminHr} />);

    expect(screen.getByRole("link", { name: "地区权限" })).toHaveAttribute(
      "href",
      "/hr/attendance/regions",
    );
    expect(screen.getByRole("link", { name: "地区权限" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "办公网络" })).toHaveAttribute(
      "href",
      "/hr/attendance/networks",
    );
  });
});
