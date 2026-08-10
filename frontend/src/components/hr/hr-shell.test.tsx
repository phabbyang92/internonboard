import { HrShell } from "@/components/hr/hr-shell";
import type { HrUser } from "@/types/hr";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  pathname: "/hr/students",
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({
    replace: navigation.replace,
    refresh: navigation.refresh,
  }),
}));

vi.mock("@/lib/api/hr-auth", () => ({
  logoutHr: vi.fn(),
}));

const hrUser: HrUser = {
  id: "hr-1",
  email: "hr@example.com",
  name: "测试 HR",
  role: "hr",
};

describe("HrShell", () => {
  beforeEach(() => {
    navigation.pathname = "/hr/students";
  });

  it("links to HR modules and marks student management as active", () => {
    render(
      <HrShell user={hrUser}>
        <p>学生页面</p>
      </HrShell>,
    );

    const studentLink = screen.getByRole("link", { name: "学生管理" });
    const attendanceLink = screen.getByRole("link", { name: "出勤管理" });
    const documentLink = screen.getByRole("link", { name: "共享文档" });
    const navigationElement = screen.getByRole("navigation", {
      name: "HR 后台导航",
    });

    expect(navigationElement).toHaveClass("overflow-x-auto");
    expect(studentLink).toHaveAttribute("href", "/hr/students");
    expect(studentLink).toHaveClass("shrink-0");
    expect(studentLink).toHaveAttribute("aria-current", "page");
    expect(attendanceLink).toHaveAttribute(
      "href",
      "/hr/attendance/daily",
    );
    expect(attendanceLink).not.toHaveAttribute("aria-current");
    expect(documentLink).toHaveAttribute("href", "/hr/shared-document");
    expect(documentLink).not.toHaveAttribute("aria-current");
  });

  it("keeps attendance navigation active for nested attendance routes", () => {
    navigation.pathname = "/hr/attendance/students/student-1";

    render(
      <HrShell user={hrUser}>
        <p>考勤详情</p>
      </HrShell>,
    );

    expect(screen.getByRole("link", { name: "出勤管理" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "学生管理" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("marks the shared document module as active", () => {
    navigation.pathname = "/hr/shared-document";

    render(
      <HrShell user={hrUser}>
        <p>共享文档页面</p>
      </HrShell>,
    );

    expect(screen.getByRole("link", { name: "共享文档" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
