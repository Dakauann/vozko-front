import { describe, expect, it } from "vitest";

import {
  animatorFrameAt,
  channelOf,
  easedSelection,
  offsetLook,
  randomRanks,
  rangeAmounts,
  rangeWindow,
  selectorAmounts,
  shapeAt,
  unitSpan,
  wigglyAmount,
  type RangeSelector,
  type TextUnitAnimator,
} from "./text-selectors";

const range = (patch: Partial<RangeSelector> = {}): RangeSelector => ({ kind: "range", units: "percent", start: 0, end: 100, offset: 0, order: "forward", shape: "square", easeHigh: 0, easeLow: 0, amount: 100, seed: 7, ...patch });

const wiggly = { kind: "wiggly" as const, rate: 2, loopMs: 2000, correlation: 0, amount: 100, seed: 3, timeMs: 0 };

describe("range selector shapes", () => {
  it("covers each unit by the share of it inside a square range", () => {
    expect(rangeAmounts(range({ start: 0, end: 50 }), 4)).toEqual([1, 1, 0, 0]);
    expect(rangeAmounts(range({ start: 0, end: 30 }), 4).map((v) => Math.round(v * 100) / 100)).toEqual([1, 0.2, 0, 0]);
  });

  it("moves the range with the offset and reads index units as unit counts", () => {
    expect(rangeAmounts(range({ start: 0, end: 25, offset: 50 }), 4)).toEqual([0, 0, 1, 0]);
    expect(rangeAmounts(range({ units: "index", start: 1, end: 3 }), 4)).toEqual([0, 1, 1, 0]);
    expect(rangeWindow(range({ units: "index", start: 3, end: 1, offset: 1 }), 4)).toEqual([0.5, 1]);
  });

  it("keeps units past a ramp up fully selected and units before it free", () => {
    const amounts = rangeAmounts(range({ shape: "rampUp", start: 25, end: 75 }), 8);
    expect(amounts[0]).toBe(0);
    expect(amounts[7]).toBe(1);
    expect(amounts[3]).toBeGreaterThan(amounts[2]);
    const down = rangeAmounts(range({ shape: "rampDown", start: 25, end: 75 }), 8);
    expect(down[0]).toBe(1);
    expect(down[7]).toBe(0);
  });

  it("peaks triangle, round and smooth shapes in the middle of the range and is zero outside", () => {
    for (const shape of ["triangle", "round", "smooth"] as const) {
      expect(shapeAt(shape, 0.5)).toBeCloseTo(1);
      expect(shapeAt(shape, -0.1)).toBe(0);
      expect(shapeAt(shape, 1.1)).toBe(0);
      expect(shapeAt(shape, 0.25)).toBeLessThan(1);
    }
    expect(shapeAt("round", 0.25)).toBeGreaterThan(shapeAt("triangle", 0.25));
    expect(shapeAt("smooth", 0.25)).toBeCloseTo(0.5);
  });

  it("scales by the amount, negative included", () => {
    expect(rangeAmounts(range({ amount: -50 }), 2)).toEqual([-0.5, -0.5]);
  });

  it("flattens the top with ease high and the bottom with ease low", () => {
    expect(easedSelection(0.5, 0, 0)).toBeCloseTo(0.5);
    expect(easedSelection(0, 100, 100)).toBe(0);
    expect(easedSelection(1, 100, 100)).toBe(1);
    expect(easedSelection(0.9, 100, 0)).toBeGreaterThan(0.9);
    expect(easedSelection(0.1, 0, 100)).toBeLessThan(0.1);
  });
});

describe("range selector order", () => {
  it("walks forward, backward, from the center and from the edges", () => {
    expect(unitSpan("forward", 0, 4)).toEqual([0, 0.25]);
    expect(unitSpan("backward", 0, 4)).toEqual([0.75, 1]);
    expect(unitSpan("centerOut", 1, 4)).toEqual([0, 0.5]);
    expect(unitSpan("centerOut", 0, 4)).toEqual([0.5, 1]);
    expect(unitSpan("edgesIn", 0, 4)).toEqual([0, 0.5]);
    expect(unitSpan("centerOut", 2, 5)[0]).toBe(0);
  });

  it("selects the middle units first from the center and the outer ones first from the edges", () => {
    const middle = rangeAmounts(range({ order: "centerOut", end: 40 }), 5);
    expect(middle[2]).toBe(1);
    expect(middle[0]).toBe(0);
    expect(middle[1]).toBeCloseTo(middle[3]);
    const edges = rangeAmounts(range({ order: "edgesIn", end: 40 }), 5);
    expect(edges[0]).toBe(1);
    expect(edges[4]).toBe(1);
    expect(edges[2]).toBe(0);
  });

  it("shuffles every unit once with a seed and repeats the same shuffle for the same seed", () => {
    const ranks = randomRanks(12, 42);
    expect([...ranks].sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i));
    expect(randomRanks(12, 42)).toEqual(ranks);
    expect(randomRanks(12, 43)).not.toEqual(ranks);
    const amounts = rangeAmounts(range({ order: "random", end: 50 }), 12);
    expect(amounts.filter((v) => v === 1)).toHaveLength(6);
  });
});

describe("wiggly selector", () => {
  it("loops exactly after its loop length and stays within the amount", () => {
    for (const index of [0, 3]) {
      const at = (timeMs: number) => wigglyAmount({ ...wiggly, timeMs }, index, 0);
      expect(at(250)).toBeCloseTo(at(2250), 9);
      for (let t = 0; t < 2000; t += 50) expect(Math.abs(at(t))).toBeLessThanOrEqual(1);
    }
    expect(Math.abs(wigglyAmount({ ...wiggly, amount: 30, timeMs: 500 }, 1, 0))).toBeLessThanOrEqual(0.3);
  });

  it("moves every unit together at full correlation and apart without it", () => {
    const together = { ...wiggly, correlation: 100, timeMs: 700 };
    expect(wigglyAmount(together, 0, 1)).toBeCloseTo(wigglyAmount(together, 5, 1), 12);
    const apart = { ...wiggly, timeMs: 700 };
    expect(wigglyAmount(apart, 0, 1)).not.toBeCloseTo(wigglyAmount(apart, 5, 1), 3);
  });

  it("wiggles each property on its own channel", () => {
    const amounts = selectorAmounts({ ...wiggly, timeMs: 400 }, 3);
    expect(amounts(channelOf("x"), 1)).not.toBeCloseTo(amounts(channelOf("y"), 1), 3);
  });
});

describe("offsets", () => {
  it("moves, turns and tracks by the selection and blends scale and opacity from rest", () => {
    const look = offsetLook({ x: 10, y: -20, rotation: 30, scale: 0, opacity: 0, blur: 8, tracking: 4 }, () => 0.5);
    expect(look).toMatchObject({ dx: 5, dy: -10, rotation: 15, scale: 0.5, opacity: 0.5, blurPx: 4, tracking: 2, tint: 0 });
  });

  it("clamps opacity, scale and blur and tints only with a color", () => {
    expect(offsetLook({ opacity: 0, blur: 8 }, () => -1)).toMatchObject({ opacity: 1, blurPx: 0 });
    expect(offsetLook({ scale: 0 }, () => 2).scale).toBe(0);
    expect(offsetLook({ fill: "#ff0000" }, () => 1.5).tint).toBe(1);
    expect(offsetLook({ stroke: "#ff0000" }, () => -1).tint).toBe(0);
  });
});

describe("animator frames", () => {
  it("reads keyed selector values at the moment and carries the wiggle clock past a split", () => {
    const animator: TextUnitAnimator = {
      id: "a",
      unit: "char",
      properties: { opacity: 0 },
      selector: range(),
      keyframes: { offset: [{ atMs: 0, value: -100, easing: "linear" }, { atMs: 1000, value: 100, easing: "linear" }] },
    };
    const frame = animatorFrameAt(animator, 500);
    expect(frame.selector).toMatchObject({ kind: "range", offset: 0, start: 0, end: 100 });
    const shaken = animatorFrameAt({ ...animator, selector: { kind: "wiggly", rate: 2, loopMs: 2000, correlation: 0, amount: 100, seed: 1, offsetMs: 300 }, keyframes: undefined }, 200);
    expect(shaken.selector).toMatchObject({ kind: "wiggly", timeMs: 500 });
    expect(shaken.selector).not.toHaveProperty("offsetMs");
  });
});
