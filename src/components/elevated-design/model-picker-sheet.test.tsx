import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/i18n/messages/en.json";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { ELO_SURFACE, GENERAL_SURFACE, WORKFLOW_BUILDER_SURFACE, type ModelSurface } from "@/lib/ai-models/surfaces";

import { ModelPickerSheet } from "./model-picker-sheet";

const pricing: ModelPricingInfo[] = [
  { id: "lab/popular", name: "Popular", promptPrice: 1, completionPrice: 2, capabilities: ["tools", "reasoning"] },
  { id: "lab/seer", name: "Seer", promptPrice: 1, completionPrice: 2, capabilities: ["vision", "tools"] },
  { id: "lab/free-seer", name: "Free seer", promptPrice: 0, completionPrice: 0, capabilities: ["vision", "tools", "low_price", "free"] },
  { id: "lab/chatter", name: "Chatter", promptPrice: 1, completionPrice: 2, capabilities: ["vision"] },
];
const models = pricing.map((p) => p.id);

function Sheet({ surface = GENERAL_SURFACE, onValueChange = vi.fn() }: { surface?: ModelSurface; onValueChange?: (id: string) => void }) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <ModelPickerSheet open onOpenChange={vi.fn()} models={models} modelPricing={pricing} surface={surface} onValueChange={onValueChange} />
    </NextIntlClientProvider>
  );
}

function shownModels(): string[] {
  return screen.getAllByRole("option").map((row) => row.getAttribute("data-value") ?? "");
}

function chip(name: string) {
  return within(screen.getByRole("group", { name: "Filter by capability" })).getByRole("button", { name });
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(cleanup);

describe("ModelPickerSheet capability filters", () => {
  it("offers a chip for each capability some model has", () => {
    render(<Sheet />);
    const group = screen.getByRole("group", { name: "Filter by capability" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["Vision", "Tools", "Reasoning", "Low price", "Free"]);
  });

  it("combines chips and keeps the popularity order", () => {
    render(<Sheet />);
    expect(shownModels()).toEqual(models);
    fireEvent.click(chip("Vision"));
    expect(chip("Vision").getAttribute("aria-pressed")).toBe("true");
    expect(shownModels()).toEqual(["lab/seer", "lab/free-seer", "lab/chatter"]);
    fireEvent.click(chip("Free"));
    expect(shownModels()).toEqual(["lab/free-seer"]);
    expect(screen.getByText("1 of 4 models · sorted by popularity")).toBeTruthy();
  });

  it("remembers the chosen chips per surface", () => {
    const { unmount } = render(<Sheet surface={ELO_SURFACE} />);
    fireEvent.click(chip("Vision"));
    unmount();
    render(<Sheet surface={ELO_SURFACE} />);
    expect(chip("Vision").getAttribute("aria-pressed")).toBe("true");
    cleanup();
    render(<Sheet surface={GENERAL_SURFACE} />);
    expect(chip("Vision").getAttribute("aria-pressed")).toBe("false");
  });

  it("clears every chip at once", () => {
    render(<Sheet />);
    fireEvent.click(chip("Vision"));
    fireEvent.click(chip("Clear filters"));
    expect(shownModels()).toEqual(models);
  });

  it("shows capability icons with accessible names on each row", () => {
    render(<Sheet />);
    const row = screen.getAllByRole("option")[2];
    expect(within(row).getAllByRole("img").map((icon) => icon.getAttribute("aria-label"))).toEqual(["Vision", "Tools", "Low price", "Free"]);
  });

  it("leaves vision out of the workflow builder", () => {
    render(<Sheet surface={WORKFLOW_BUILDER_SURFACE} />);
    expect(within(screen.getByRole("group", { name: "Filter by capability" })).queryByRole("button", { name: "Vision" })).toBeNull();
    expect(screen.queryAllByRole("img", { name: "Vision" })).toEqual([]);
  });

  it("shows a model without what the surface needs as unavailable, with the reason", () => {
    const onValueChange = vi.fn();
    render(<Sheet surface={ELO_SURFACE} onValueChange={onValueChange} />);
    const row = screen.getAllByRole("option")[3];
    expect(row.getAttribute("aria-disabled")).toBe("true");
    expect(within(row).getByText("Not available here: missing Tools")).toBeTruthy();
    fireEvent.click(row);
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("option")[1]);
    expect(onValueChange).toHaveBeenCalledWith("lab/seer");
  });

  it("explains an empty result caused by the chips", () => {
    render(<Sheet />);
    fireEvent.click(chip("Reasoning"));
    fireEvent.click(chip("Vision"));
    expect(screen.getByText("No model has every chosen capability.")).toBeTruthy();
  });
});
