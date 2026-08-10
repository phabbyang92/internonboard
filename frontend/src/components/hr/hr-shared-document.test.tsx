import { HrSharedDocument } from "@/components/hr/hr-shared-document";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("HrSharedDocument", () => {
  it("embeds a configured document and always provides a new-tab fallback", () => {
    render(
      <HrSharedDocument
        documentUrl="https://docs.qq.com/doc/example"
        documentTitle="考勤共享文档"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "考勤共享文档" }),
    ).toBeInTheDocument();
    expect(screen.getByTitle("考勤共享文档")).toHaveAttribute(
      "src",
      "https://docs.qq.com/doc/example",
    );
    expect(
      screen.getByRole("link", { name: /在腾讯文档中打开/ }),
    ).toHaveAttribute("target", "_blank");
  });

  it("shows a clear configuration state without rendering an iframe", () => {
    render(<HrSharedDocument />);

    expect(screen.getByText("共享文档尚未配置")).toBeInTheDocument();
    expect(screen.queryByTitle("HR 在线文档")).not.toBeInTheDocument();
  });
});
