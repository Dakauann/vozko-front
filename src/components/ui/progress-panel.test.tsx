import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgressPanel, ProgressTrack } from "./progress-panel";

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

describe("ProgressTrack", () => {
  it("fills to the percent it is given and can sit inside a button", () => {
    render(
      <button type="button">
        <ProgressTrack label="Importando" percent={62} className="h-1" />
      </button>,
    );
    const bar = screen.getByRole("progressbar", { name: "Importando" });
    expect(bar.tagName).toBe("SPAN");
    expect(bar).toHaveAttribute("aria-valuenow", "62");
    expect(bar.className).toContain("h-1");
    expect(bar.className).not.toContain("h-1.5");
    expect((bar.firstElementChild as HTMLElement).style.transform).toBe("scaleX(0.62)");
  });

  it("clamps a percent outside the track", () => {
    render(<ProgressTrack label="Importando" percent={140} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });
});
