import { describe, expect, it } from "vitest";

import { curvePoints, keyAtPoint, keyLaneTop, keyLanesHeight, keysInBox, keyTimeAt, keyX, removeKeys, shiftedKeys, toggledKeys } from "./focus-lanes";

const keyframes = {
  x: [
    { atMs: 0, value: 0.2, easing: "linear" as const },
    { atMs: 2000, value: 0.8, easing: "linear" as const },
  ],
  opacity: [{ atMs: 1000, value: 0.5, easing: "linear" as const }],
};

describe("focus lanes", () => {
  it("stacks one lane per property", () => {
    expect(keyLaneTop("x", 20)).toBe(0);
    expect(keyLaneTop("opacity", 20)).toBe(80);
    expect(keyLanesHeight(20)).toBe(100);
  });

  it("maps key times to pixels and back", () => {
    expect(keyX(1000, 4000, 400)).toBe(100);
    expect(keyTimeAt(100, 4000, 400)).toBe(1000);
  });

  it("hits the closest key within reach", () => {
    expect(keyAtPoint(keyframes, "x", 198, 2000, 200)).toEqual({ property: "x", atMs: 2000 });
    expect(keyAtPoint(keyframes, "x", 100, 2000, 200)).toBeNull();
    expect(keyAtPoint(keyframes, "y", 0, 2000, 200)).toBeNull();
  });

  it("selects keys inside a marquee", () => {
    expect(keysInBox(keyframes, { left: -5, right: 150, top: 0, bottom: 200 }, 2000, 200, 20)).toEqual([
      { property: "x", atMs: 0 },
      { property: "opacity", atMs: 1000 },
    ]);
    expect(keysInBox(keyframes, { left: -5, right: 250, top: 0, bottom: 15 }, 2000, 200, 20)).toEqual([
      { property: "x", atMs: 0 },
      { property: "x", atMs: 2000 },
    ]);
  });

  it("toggles keys in the selection", () => {
    const a = { property: "x" as const, atMs: 0 };
    const b = { property: "x" as const, atMs: 2000 };
    expect(toggledKeys([a], b, false)).toEqual([b]);
    expect(toggledKeys([a], b, true)).toEqual([a, b]);
    expect(toggledKeys([a, b], a, true)).toEqual([b]);
  });

  it("draws the value curve within the lane", () => {
    const points = curvePoints(keyframes.x, "x", 2000, 200, 20, 4);
    expect(points).toHaveLength(5);
    expect(points[0]).toEqual([0, 17]);
    expect(points[4]).toEqual([200, 3]);
    expect(curvePoints(keyframes.opacity, "opacity", 2000, 200, 20, 2).every(([, y]) => y === 10)).toBe(true);
    expect(curvePoints([], "x", 2000, 200, 20)).toEqual([]);
  });
});

describe("key removal and shifting", () => {
  it("removes selected keys and shifts references", () => {
    const left = removeKeys(keyframes, [
      { property: "x", atMs: 0 },
      { property: "opacity", atMs: 1000 },
    ]);
    expect(left?.x).toEqual([{ atMs: 2000, value: 0.8, easing: "linear" }]);
    expect(left?.opacity).toBeUndefined();
    expect(shiftedKeys([{ property: "x", atMs: 100 }], 50)).toEqual([{ property: "x", atMs: 150 }]);
  });
});
