import StudentAttendancePage from "@/app/student/attendance/page";
import { useStudentPortalAccess } from "@/hooks/use-student-portal-access";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-student-portal-access", () => ({
  useStudentPortalAccess: vi.fn(),
}));

vi.mock("@/components/student/student-page-header", () => ({
  StudentPageHeader: ({ studentName }: { studentName: string }) => (
    <div>{studentName}</div>
  ),
}));

vi.mock("@/components/student/student-attendance-dashboard", () => ({
  StudentAttendanceDashboard: () => <div>今日考勤内容</div>,
}));

vi.mock("@/components/student/student-leave-registration", () => ({
  StudentLeaveRegistration: () => <div>请假登记内容</div>,
}));

vi.mock("@/components/student/student-attendance-records", () => ({
  StudentAttendanceRecords: () => <div>出勤记录内容</div>,
}));

const mockedUsePortal = vi.mocked(useStudentPortalAccess);

describe("StudentAttendancePage", () => {
  it("switches among today, leave and record views", async () => {
    const user = userEvent.setup();
    mockedUsePortal.mockReturnValue({
      portal: {
        portalState: "attendance",
        student: {
          id: "student-id",
          name: "测试学生",
          onboardingStatus: "onboarded",
        },
      },
      isLoading: false,
      errorMessage: "",
    });

    render(<StudentAttendancePage />);

    expect(screen.getByText("今日考勤内容")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "请假登记" }));
    expect(screen.getByText("请假登记内容")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "出勤记录" }));
    expect(screen.getByText("出勤记录内容")).toBeInTheDocument();
  });
});
