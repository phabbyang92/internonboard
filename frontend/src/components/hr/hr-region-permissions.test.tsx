import { HrRegionPermissions } from "@/components/hr/hr-region-permissions";
import { listHrRegionPermissions } from "@/lib/api/hr-attendance-settings";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/lib/api/hr-attendance-settings", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/hr-attendance-settings")>();
  return { ...actual, listHrRegionPermissions: vi.fn() };
});

const mockedList = vi.mocked(listHrRegionPermissions);

describe("HrRegionPermissions", () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    mockedList.mockReset();
    mockedList.mockResolvedValue({
      items: [
        {
          id: "hr-1",
          name: "上海 HR",
          email: "shanghai.hr@example.com",
          role: "hr",
          managedRegionCodes: ["shanghai", "nanjing"],
        },
      ],
    });
  });

  it("shows each ordinary HR and keeps save disabled before a change", async () => {
    render(<HrRegionPermissions />);

    expect(await screen.findByText("上海 HR")).toBeInTheDocument();
    expect(screen.getByText("shanghai.hr@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("上海 HR 负责地区")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存权限" })).toBeDisabled();
  });
});
