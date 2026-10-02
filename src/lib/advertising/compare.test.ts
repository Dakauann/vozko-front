import { describe, expect, it } from "vitest";

import { deltaOf, percentChange } from "./compare";

describe("percentChange", () => {
  it("measures the change against the previous value", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
  });

  it("has no answer without a previous value to compare against", () => {
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(null, 10)).toBeNull();
    expect(percentChange(10, undefined)).toBeNull();
  });
});

describe("deltaOf", () => {
  it("calls a rise better when more is good", () => {
    expect(deltaOf(120, 100, "higher")).toEqual({ change: 20, tone: "better" });
    expect(deltaOf(80, 100, "higher")).toEqual({ change: -20, tone: "worse" });
  });

  it("calls a rise worse when less is good, like a cost", () => {
    expect(deltaOf(120, 100, "lower")).toEqual({ change: 20, tone: "worse" });
    expect(deltaOf(80, 100, "lower")).toEqual({ change: -20, tone: "better" });
  });

  it("keeps spend and unchanged values neutral", () => {
    expect(deltaOf(200, 100, "neutral")?.tone).toBe("neutral");
    expect(deltaOf(100, 100, "higher")?.tone).toBe("neutral");
  });

  it("returns nothing when the change is unknown", () => {
    expect(deltaOf(5, 0, "higher")).toBeNull();
  });
});
