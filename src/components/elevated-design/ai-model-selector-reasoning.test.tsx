import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./model-picker-sheet", () => ({ ModelPickerSheet: () => null }));

import en from "@/i18n/messages/en.json";
import type { ModelPricingInfo } from "@/lib/agents/types";
import type { ReasoningAdjustment } from "@/lib/ai-models/reasoning";

import { AIModelSelector } from "./ai-model-selector";

const pricing: ModelPricingInfo[] = [
  { id: "lab/thinker", name: "Thinker", promptPrice: 1, completionPrice: 2, reasoning: { levels: ["low", "medium", "high"], default: "medium" } },
  { id: "lab/plain", name: "Plain", promptPrice: 1, completionPrice: 2 },
];

function Selector({ value, reasoning = "", onReasoningChange = vi.fn(), adjusted = null, variant = "toolbar" }: { value: string; reasoning?: string; onReasoningChange?: (level: string) => void; adjusted?: ReasoningAdjustment | null; variant?: "toolbar" | "field" }) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <AIModelSelector variant={variant} label="Model" value={value} models={pricing.map((p) => p.id)} modelPricing={pricing} reasoning={reasoning} onReasoningChange={onReasoningChange} reasoningAdjusted={adjusted} />
    </NextIntlClientProvider>
  );
}

afterEach(cleanup);

describe("AIModelSelector reasoning level", () => {
  it("offers the model's own levels with its default marked", () => {
    render(<Selector value="lab/thinker" />);
    const select = screen.getByRole("combobox", { name: "Reasoning level" }) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(["Low", "Medium (default)", "High"]);
    expect(select.value).toBe("medium");
  });

  it("reports the chosen level", () => {
    const onReasoningChange = vi.fn();
    render(<Selector value="lab/thinker" onReasoningChange={onReasoningChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Reasoning level" }), { target: { value: "high" } });
    expect(onReasoningChange).toHaveBeenCalledWith("high");
  });

  it("shows a stored level the model offers", () => {
    render(<Selector value="lab/thinker" reasoning="low" />);
    expect((screen.getByRole("combobox", { name: "Reasoning level" }) as HTMLSelectElement).value).toBe("low");
  });

  it("has no level control for a model that offers no levels", () => {
    render(<Selector value="lab/plain" reasoning="high" />);
    expect(screen.queryByRole("combobox", { name: "Reasoning level" })).toBeNull();
  });

  it("says visibly when a model change reset the level", () => {
    render(<Selector value="lab/thinker" adjusted={{ from: "max", to: "medium" }} />);
    expect(screen.getByRole("status").textContent).toContain("Set to Medium: the new model does not offer Maximum.");
  });

  it("says visibly when the new model offers no levels at all", () => {
    render(<Selector value="lab/plain" adjusted={{ from: "high", to: null }} variant="field" />);
    expect(screen.getByRole("status").textContent).toContain("The new model offers no reasoning levels; High was removed.");
  });

  it("keeps the selector free of a level control when the surface takes no level", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <AIModelSelector label="Model" value="lab/thinker" models={["lab/thinker"]} modelPricing={pricing} />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole("combobox", { name: "Reasoning level" })).toBeNull();
  });
});
