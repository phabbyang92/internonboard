import { HrPageState } from "@/components/hr/hr-page-state";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("HrPageState", () => {
  it("announces loading and empty states without interrupting the user", () => {
    render(<HrPageState message="正在加载" />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("announces request failures immediately", () => {
    render(<HrPageState message="加载失败" isError />);

    expect(screen.getByRole("alert")).toHaveAttribute(
      "aria-live",
      "assertive",
    );
  });
});
