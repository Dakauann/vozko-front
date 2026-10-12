import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const options = {
  providers: [],
  messaging: ["lab/thinker", "lab/deep", "lab/plain"],
  defaults: { messagingModel: "lab/thinker" },
  modelPricing: [
    { id: "lab/thinker", name: "Thinker", promptPrice: 1, completionPrice: 2, reasoning: { levels: ["low", "medium", "high"], default: "medium" } },
    { id: "lab/deep", name: "Deep", promptPrice: 1, completionPrice: 2, reasoning: { levels: ["high", "max"], default: "high" } },
    { id: "lab/plain", name: "Plain", promptPrice: 1, completionPrice: 2 },
  ],
};

vi.mock("@/app/actions/agents", () => ({ getAgentOptionsAction: () => Promise.resolve({ options, error: null }) }));

import { useModelChoice } from "./use-model-choice";

let key = 0;
function freshKey(): string {
  key += 1;
  return `test-choice-${key}`;
}

beforeEach(() => {
  localStorage.clear();
});

describe("useModelChoice", () => {
  it("falls back to the default model until the person chooses one", async () => {
    const storageKey = freshKey();
    const { result } = renderHook(() => useModelChoice(storageKey));
    await waitFor(() => expect(result.current.model).toBe("lab/thinker"));
    expect(result.current.reasoning).toBe("");
  });

  it("sends a chosen level only while the model offers it", async () => {
    const storageKey = freshKey();
    const { result } = renderHook(() => useModelChoice(storageKey));
    await waitFor(() => expect(result.current.pricing.length).toBe(3));
    act(() => result.current.changeReasoning("high"));
    expect(result.current.reasoning).toBe("high");
    act(() => result.current.changeModel("lab/deep"));
    expect(result.current.reasoning).toBe("high");
    expect(result.current.adjusted).toBeNull();
  });

  it("resets the level to the new model default and says so", async () => {
    const storageKey = freshKey();
    const { result } = renderHook(() => useModelChoice(storageKey));
    await waitFor(() => expect(result.current.pricing.length).toBe(3));
    act(() => result.current.changeReasoning("low"));
    act(() => result.current.changeModel("lab/deep"));
    expect(result.current.reasoning).toBe("");
    expect(result.current.adjusted).toEqual({ from: "low", to: "high" });
    expect(localStorage.getItem(`${storageKey}:reasoning`)).toBe("");
    act(() => result.current.acknowledgeAdjustment());
    expect(result.current.adjusted).toBeNull();
  });

  it("drops the level for a model without levels", async () => {
    const storageKey = freshKey();
    const { result } = renderHook(() => useModelChoice(storageKey));
    await waitFor(() => expect(result.current.pricing.length).toBe(3));
    act(() => result.current.changeReasoning("medium"));
    act(() => result.current.changeModel("lab/plain"));
    expect(result.current.reasoning).toBe("");
    expect(result.current.adjusted).toEqual({ from: "medium", to: null });
  });
});
