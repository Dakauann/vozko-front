import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import ptMessages from "@/i18n/messages/pt.json";
import { EASINGS, type Easing } from "@/lib/studio/keyframes";

import { EasingPicker } from "./easing-picker";

const pt = ptMessages.studio.video.keyframes;

function setup(value: Easing | null) {
  const onPick = vi.fn();
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <TooltipProvider>
        <EasingPicker label="Suavização" value={value} disabled={false} onPick={onPick} />
      </TooltipProvider>
    </NextIntlClientProvider>,
  );
  return onPick;
}

describe("easing picker", () => {
  it("offers every named curve and a custom one", () => {
    const onPick = setup("easeInOut");
    for (const easing of EASINGS) expect(screen.getByRole("button", { name: pt.easings[easing] })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: pt.easings.spring }));
    expect(onPick).toHaveBeenLastCalledWith("spring");
    fireEvent.click(screen.getByRole("button", { name: pt.customCurve }));
    expect(onPick).toHaveBeenLastCalledWith("cubic-bezier(0.2,0,0,1)");
    expect(screen.queryByRole("textbox", { name: pt.curve.x1 })).toBeNull();
  });

  it("edits the handles of a custom curve", () => {
    const onPick = setup("cubic-bezier(0.05,0.7,0.1,1)");
    expect(screen.getByRole("button", { name: pt.customCurve }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(pt.customCurve, { selector: "span" })).toBeTruthy();
    const y2 = screen.getByRole("textbox", { name: pt.curve.y2 });
    fireEvent.change(y2, { target: { value: "1.5" } });
    fireEvent.blur(y2);
    expect(onPick).toHaveBeenLastCalledWith("cubic-bezier(0.05,0.7,0.1,1.5)");
    const x1 = screen.getByRole("textbox", { name: pt.curve.x1 });
    fireEvent.change(x1, { target: { value: "4" } });
    fireEvent.blur(x1);
    expect(onPick).toHaveBeenLastCalledWith("cubic-bezier(1,0.7,0.1,1)");
  });
});
