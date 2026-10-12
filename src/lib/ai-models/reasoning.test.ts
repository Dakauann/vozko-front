import { describe, expect, it } from "vitest";

import type { ModelPricingInfo } from "@/lib/agents/types";

import { displayedReasoning, reasoningAfterModelChange, reasoningOptionsOf, resolveReasoning } from "./reasoning";

const pricing: ModelPricingInfo[] = [
  { id: "lab/thinker", name: "Thinker", promptPrice: 1, completionPrice: 2, reasoning: { levels: ["low", "medium", "high"], default: "medium" } },
  { id: "lab/deep", name: "Deep", promptPrice: 1, completionPrice: 2, reasoning: { levels: ["high", "max"], default: "high" } },
  { id: "lab/plain", name: "Plain", promptPrice: 1, completionPrice: 2 },
  { id: "lab/odd", name: "Odd", promptPrice: 1, completionPrice: 2, reasoning: { levels: ["ultra", "low"], default: "ultra" } },
];

describe("reasoning levels", () => {
  it("reads the levels the API offers for a model", () => {
    expect(reasoningOptionsOf(pricing, "lab/thinker")).toEqual({ levels: ["low", "medium", "high"], default: "medium" });
    expect(reasoningOptionsOf(pricing, "lab/plain")).toBeUndefined();
    expect(reasoningOptionsOf(pricing, "lab/missing")).toBeUndefined();
  });

  it("offers nothing when the default is not a level the app knows", () => {
    expect(reasoningOptionsOf(pricing, "lab/odd")).toBeUndefined();
  });

  it("sends a stored level only when the model offers it", () => {
    const thinker = reasoningOptionsOf(pricing, "lab/thinker");
    expect(resolveReasoning(thinker, "high")).toBe("high");
    expect(resolveReasoning(thinker, "max")).toBe("");
    expect(resolveReasoning(undefined, "high")).toBe("");
    expect(resolveReasoning(thinker, "")).toBe("");
  });

  it("shows the model default when nothing valid is chosen", () => {
    const thinker = reasoningOptionsOf(pricing, "lab/thinker");
    expect(displayedReasoning(thinker, "")).toBe("medium");
    expect(displayedReasoning(thinker, "max")).toBe("medium");
    expect(displayedReasoning(thinker, "low")).toBe("low");
    expect(displayedReasoning(undefined, "low")).toBeNull();
  });

  it("keeps a level the next model also offers", () => {
    expect(reasoningAfterModelChange("high", reasoningOptionsOf(pricing, "lab/deep"))).toEqual({ level: "high", adjusted: null });
  });

  it("resets a level the next model does not offer to its default, and says so", () => {
    expect(reasoningAfterModelChange("low", reasoningOptionsOf(pricing, "lab/deep"))).toEqual({ level: "", adjusted: { from: "low", to: "high" } });
    expect(reasoningAfterModelChange("low", undefined)).toEqual({ level: "", adjusted: { from: "low", to: null } });
  });

  it("has nothing to adjust when no level was chosen", () => {
    expect(reasoningAfterModelChange("", reasoningOptionsOf(pricing, "lab/deep"))).toEqual({ level: "", adjusted: null });
  });
});
