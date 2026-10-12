import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/i18n/messages/en.json";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { modelChoiceStore } from "@/lib/ai-models/model-choice-store";
import { reasoningOptionsOf } from "@/lib/ai-models/reasoning";
import { CHAT_MODEL_STORAGE } from "@/lib/ai-models/storage-keys";

const sheetSurfaces: string[] = [];
vi.mock("@/components/elevated-design/model-picker-sheet", () => ({
  ModelPickerSheet: ({ surface }: { surface?: { key: string } }) => {
    sheetSurfaces.push(surface?.key ?? "");
    return null;
  },
}));

import { ChatModelSelector } from "./chat-model-selector";

const pricing: ModelPricingInfo[] = [
  { id: "lab/thinker", name: "Thinker", promptPrice: 1, completionPrice: 2, capabilities: ["tools", "reasoning"], reasoning: { levels: ["low", "medium", "high"], default: "medium" } },
  { id: "lab/deep", name: "Deep", promptPrice: 1, completionPrice: 2, capabilities: ["tools", "reasoning"], reasoning: { levels: ["high", "max"], default: "high" } },
];

function Selector({ value }: { value: string }) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <ChatModelSelector label="Model" value={value} onValueChange={vi.fn()} models={pricing.map((p) => p.id)} modelPricing={pricing} />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  sheetSurfaces.length = 0;
});
afterEach(cleanup);

describe("ChatModelSelector", () => {
  it("opens the picker on the Elo surface", () => {
    render(<Selector value="lab/thinker" />);
    expect(sheetSurfaces.at(-1)).toBe("elo");
  });

  it("stores the level chosen beside the model", () => {
    render(<Selector value="lab/thinker" />);
    fireEvent.change(screen.getByRole("combobox", { name: "Reasoning level" }), { target: { value: "high" } });
    expect(modelChoiceStore(CHAT_MODEL_STORAGE).get().reasoning).toBe("high");
  });

  it("shows the reset when the next model does not offer the level", () => {
    const store = modelChoiceStore(CHAT_MODEL_STORAGE);
    const { rerender } = render(<Selector value="lab/thinker" />);
    fireEvent.change(screen.getByRole("combobox", { name: "Reasoning level" }), { target: { value: "low" } });
    act(() => store.chooseModel("lab/deep", reasoningOptionsOf(pricing, "lab/deep")));
    rerender(<Selector value="lab/deep" />);
    expect((screen.getByRole("combobox", { name: "Reasoning level" }) as HTMLSelectElement).value).toBe("high");
    expect(screen.getByRole("status").textContent).toContain("Set to High: the new model does not offer Low.");
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
