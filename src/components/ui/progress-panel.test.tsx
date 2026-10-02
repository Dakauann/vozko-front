import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgressPanel } from "./progress-panel";

describe("ProgressPanel", () => {
  it("creeps without a number while the progress is unknown", () => {
    render(<ProgressPanel label="Carregando" style={{ height: 120 }} />);
    const bar = screen.getByRole("progressbar", { name: "Carregando" });
    expect(bar).not.toHaveAttribute("aria-valuenow");
    expect((bar.firstElementChild as HTMLElement).className).toContain("animate-progress-creep");
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("shows an estimated percentage when one is given", () => {
    render(<ProgressPanel label="Gerando" progress={42} />);
    const bar = screen.getByRole("progressbar", { name: "Gerando" });
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect((bar.firstElementChild as HTMLElement).style.transform).toBe("scaleX(0.42)");
    expect(screen.getByText("42%")).toBeTruthy();
  });
});
