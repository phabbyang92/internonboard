import { HrOfficeNetworks } from "@/components/hr/hr-office-networks";
import * as settingsApi from "@/lib/api/hr-attendance-settings";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/hr-attendance-settings");

describe("HrOfficeNetworks", () => {
  beforeEach(() => {
    vi.mocked(settingsApi.listHrOfficeNetworks).mockResolvedValue({
      items: [
        {
          id: "network-1",
          workLocation: "上海办公室 - 会德丰",
          cidrs: ["140.207.40.253/32"],
          enabled: true,
          description: "会德丰办公室出口 IP",
          updatedByHrId: "admin-1",
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-07T00:00:00.000Z",
        },
        {
          id: null,
          workLocation: "北京办公室",
          cidrs: [],
          enabled: false,
          description: null,
          updatedByHrId: null,
          createdAt: null,
          updatedAt: null,
        },
      ],
    });
  });

  it("shows office addresses, network ranges, and separate save controls", async () => {
    render(<HrOfficeNetworks />);

    expect(
      await screen.findByRole("heading", { name: "上海办公室 - 会德丰" }),
    ).toBeInTheDocument();
    expect(screen.getByText("会德丰国际广场")).toBeInTheDocument();
    expect(screen.getByText("国贸写字楼二座2401室")).toBeInTheDocument();
    expect(screen.getByText("140.207.40.253/32")).toBeInTheDocument();
    expect(
      screen.getByRole("switch", {
        name: "上海办公室 - 会德丰启用状态",
      }),
    ).toBeChecked();
    expect(
      screen.getAllByRole("button", { name: /保存配置/ }),
    ).toHaveLength(2);
  });
});
