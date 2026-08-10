import { HrAttendanceCorrectionModal } from "@/components/hr/hr-attendance-correction-modal";
import { correctHrAttendanceRecord } from "@/lib/api/hr-attendance";
import { ApiError } from "@/lib/api/client";
import type { HrAttendanceRecordItem } from "@/types/hr-attendance";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

vi.mock("@/lib/api/hr-attendance", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/hr-attendance")>();
  return { ...actual, correctHrAttendanceRecord: vi.fn() };
});

const mockedCorrectAttendance = vi.mocked(correctHrAttendanceRecord);

function makeRecord(
  overrides: Partial<HrAttendanceRecordItem> = {},
): HrAttendanceRecordItem {
  return {
    id: "attendance-1",
    attendanceDate: "2026-08-07",
    status: "absent",
    lateLevel: "severe",
    source: "hr_correction",
    checkInAt: "2026-08-07T02:42:00.000Z",
    assignedWorkLocation: "上海办公室 - 会德丰",
    checkInMode: "offline",
    checkInLocation: "上海办公室 - 会德丰",
    correction: null,
    ...overrides,
  };
}

describe("HrAttendanceCorrectionModal", () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    mockedCorrectAttendance.mockReset();
  });

  it("requires a correction reason before showing confirmation", async () => {
    const user = userEvent.setup();

    render(
      <HrAttendanceCorrectionModal
        isOpen
        studentId="student-1"
        studentName="考勤学生"
        record={makeRecord()}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "核对更正" }));

    expect(screen.getByRole("alert")).toHaveTextContent("请填写更正原因");
    expect(mockedCorrectAttendance).not.toHaveBeenCalled();
  });

  it("clears check-in fields for leave and saves only after second confirmation", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const savedRecord = makeRecord({
      status: "leave",
      lateLevel: null,
      checkInAt: null,
      checkInMode: null,
      checkInLocation: null,
    });
    mockedCorrectAttendance.mockResolvedValue({
      message: "考勤记录更正成功",
      record: savedRecord,
    });

    render(
      <HrAttendanceCorrectionModal
        isOpen
        studentId="student-1"
        studentName="考勤学生"
        record={makeRecord()}
        onClose={onClose}
        onSaved={onSaved}
      />,
    );

    await user.click(screen.getByLabelText("选择更正后考勤状态"));
    await user.click(await screen.findByRole("option", { name: "请假" }));
    await user.type(
      screen.getByPlaceholderText("例如：学生已提前请假，HR 补录请假状态"),
      "学生已提前完成请假沟通",
    );
    await user.click(screen.getByRole("button", { name: "核对更正" }));

    expect(mockedCorrectAttendance).not.toHaveBeenCalled();
    expect(screen.getByText("请再次确认。保存后会立即更新该学生的考勤统计，并记录操作 HR、更正时间和原因。")).toBeInTheDocument();
    expect(screen.getByText("学生已提前完成请假沟通")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "确认更正" }));

    await waitFor(() => {
      expect(mockedCorrectAttendance).toHaveBeenCalledWith(
        "student-1",
        "2026-08-07",
        {
          status: "leave",
          reason: "学生已提前完成请假沟通",
        },
      );
    });
    expect(onSaved).toHaveBeenCalledWith("考勤记录更正成功");
    expect(onClose).toHaveBeenCalled();
  });

  it("redirects to HR login when correction is submitted with an expired session", async () => {
    const user = userEvent.setup();
    mockedCorrectAttendance.mockRejectedValue(
      new ApiError("登录已过期", 401),
    );

    render(
      <HrAttendanceCorrectionModal
        isOpen
        studentId="student-1"
        studentName="考勤学生"
        record={makeRecord({
          status: "leave",
          lateLevel: null,
          checkInAt: null,
          checkInMode: null,
          checkInLocation: null,
        })}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.type(
      screen.getByPlaceholderText("例如：学生已提前请假，HR 补录请假状态"),
      "修正请假状态",
    );
    await user.click(screen.getByRole("button", { name: "核对更正" }));
    await user.click(screen.getByRole("button", { name: "确认更正" }));

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/hr/login");
    });
  });
});
