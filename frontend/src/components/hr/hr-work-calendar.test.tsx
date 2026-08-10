import { HrWorkCalendar } from "@/components/hr/hr-work-calendar";
import {
  getHrCalendarAccess,
  listHrCalendarExceptions,
} from "@/lib/api/hr-attendance-settings";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/lib/api/hr-attendance-settings", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/hr-attendance-settings")>();
  return {
    ...actual,
    getHrCalendarAccess: vi.fn(),
    listHrCalendarExceptions: vi.fn(),
  };
});

const mockedGetAccess = vi.mocked(getHrCalendarAccess);
const mockedList = vi.mocked(listHrCalendarExceptions);

describe("HrWorkCalendar", () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    mockedGetAccess.mockReset();
    mockedList.mockReset();
    mockedGetAccess.mockResolvedValue({
      role: "hr",
      managedRegionCodes: ["shanghai"],
      canManageGlobal: false,
    });
    mockedList.mockResolvedValue({
      month: "2026-08",
      items: [
        {
          id: "global-1",
          date: "2026-08-01",
          name: "全国法定假期",
          type: "public_holiday",
          scope: "global",
          regionCode: null,
          reason: null,
          createdByHrId: "admin-1",
          updatedByHrId: "admin-1",
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
        {
          id: "region-1",
          date: "2026-08-08",
          name: "上海临时休息日",
          type: "temporary_holiday",
          scope: "region",
          regionCode: "shanghai",
          reason: "公司临时安排",
          createdByHrId: "hr-1",
          updatedByHrId: "hr-1",
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("renders global holidays read-only and allows an assigned region to be edited", async () => {
    render(<HrWorkCalendar />);

    expect(await screen.findByText("全国法定假期")).toBeInTheDocument();
    expect(screen.getByText("上海临时休息日")).toBeInTheDocument();
    expect(screen.getByText("只读")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "修改 上海临时休息日" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "修改 全国法定假期" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加休息日" })).toBeEnabled();
    expect(screen.getByText(/可维护地区：上海/)).toBeInTheDocument();
  });
});
