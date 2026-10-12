import { describe, expect, it } from "vitest";

import { LottieGaps } from "./lottie-gaps";
import { easeOf, readBezier, readValue, valueAtFrame } from "./lottie-values";

describe("Lottie animated values", () => {
  it("reads a still value and a single number as one dimension", () => {
    const gaps = new LottieGaps();
    expect(readValue({ a: 0, k: [10, 20] }, gaps, "L")).toEqual({ keyed: false, value: [10, 20] });
    expect(readValue({ a: 0, k: 45 }, gaps, "L")).toEqual({ keyed: false, value: [45] });
    expect(gaps.list).toEqual([]);
  });

  it("reads keys with per dimension easing, holds and the old end values", () => {
    const gaps = new LottieGaps();
    const read = readValue(
      {
        a: 1,
        k: [
          { t: 0, s: [0, 0], e: [10, 20], o: { x: [0.2, 0.5], y: [0, 0.1] }, i: { x: [0.8, 0.5], y: [1, 0.9] } },
          { t: 10, s: [10, 20], e: [10, 20], h: 1 },
          { t: 20 },
        ],
      },
      gaps,
      "L",
    );
    if (!read.keyed) throw new Error("expected keys");
    expect(read.keys.map((key) => key.frame)).toEqual([0, 10, 20]);
    expect(read.keys[0].ease).toEqual(["cubic-bezier(0.2,0,0.8,1)", "cubic-bezier(0.5,0.1,0.5,0.9)"]);
    expect(read.keys[1].ease).toEqual(["hold", "hold"]);
    expect(read.keys[2].value).toEqual([10, 20]);
  });

  it("turns equal tangents into a plain linear ease and clamps tangents into the shared range", () => {
    expect(easeOf({ x: 0.17, y: 0.17 }, { x: 0.83, y: 0.83 }, 0)).toBe("linear");
    expect(easeOf({ x: 0.3, y: -2 }, { x: 1.4, y: 3 }, 0)).toBe("cubic-bezier(0.3,-1,1,2)");
    expect(easeOf(undefined, undefined, 0)).toBe("linear");
  });

  it("refuses expressions and broken keys", () => {
    const gaps = new LottieGaps();
    readValue({ a: 0, k: 1, x: "time * 10" }, gaps, "Camada");
    readValue({ a: 1, k: [{ t: 0 }, { t: 5, s: [1] }] }, gaps, "Outra");
    expect(gaps.list).toEqual([
      { code: "expression", where: "Camada" },
      { code: "invalid", where: "Outra" },
    ]);
  });

  it("evaluates a value between keys with the shared easing", () => {
    const gaps = new LottieGaps();
    const read = readValue({ a: 1, k: [{ t: 0, s: [0], o: { x: 0, y: 0 }, i: { x: 1, y: 1 } }, { t: 10, s: [100] }] }, gaps, "L");
    expect(valueAtFrame(read, 5)[0]).toBeCloseTo(50, 5);
    expect(valueAtFrame(read, -3)[0]).toBe(0);
    expect(valueAtFrame(read, 30)[0]).toBe(100);
  });

  it("reads a still path and keyed paths into absolute control points", () => {
    const gaps = new LottieGaps();
    const still = readBezier({ a: 0, k: { c: true, v: [[0, 0], [10, 0]], i: [[0, 0], [-2, 1]], o: [[3, 0], [0, 0]] } }, gaps, "L");
    if (still.keyed) throw new Error("expected a still path");
    expect(still.value).toEqual({ closed: true, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], ins: [{ x: 0, y: 0 }, { x: 8, y: 1 }], outs: [{ x: 3, y: 0 }, { x: 10, y: 0 }] });
    const keyed = readBezier({ a: 1, k: [{ t: 0, s: [{ c: false, v: [[0, 0]], i: [[0, 0]], o: [[0, 0]] }] }, { t: 4, s: [{ c: false, v: [[5, 5]], i: [[0, 0]], o: [[0, 0]] }] }] }, gaps, "L");
    if (!keyed.keyed) throw new Error("expected keys");
    expect(keyed.keys[1].value.points).toEqual([{ x: 5, y: 5 }]);
    expect(gaps.list).toEqual([]);
  });
});
