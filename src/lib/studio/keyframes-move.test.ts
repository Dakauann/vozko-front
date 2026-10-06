import { describe, expect, it } from "vitest";

import { KEYFRAME_LIMITS, duplicateKeyframes, moveKeyframes, type Keyframe, type Keyframes } from "./keyframes";

function key(atMs: number, value: number): Keyframe {
  return { atMs, value, easing: "linear" };
}

const base: Keyframes = {
  x: [key(0, 0.1), key(1000, 0.5), key(2000, 0.9)],
  opacity: [key(500, 1)],
};

describe("moveKeyframes", () => {
  it("moves only the listed keys, rounded to whole ms", () => {
    const moved = moveKeyframes(base, [{ property: "x", atMs: 1000 }], 250.4);
    expect(moved?.x?.map((f) => f.atMs)).toEqual([0, 1250, 2000]);
    expect(moved?.x?.[1].value).toBe(0.5);
    expect(moved?.opacity).toEqual(base.opacity);
  });

  it("re-sorts when keys pass each other", () => {
    const moved = moveKeyframes(base, [{ property: "x", atMs: 0 }], 1500);
    expect(moved?.x?.map((f) => [f.atMs, f.value])).toEqual([
      [1000, 0.5],
      [1500, 0.1],
      [2000, 0.9],
    ]);
  });

  it("moves several keys together, even onto times the group leaves", () => {
    const all = [
      { property: "x" as const, atMs: 0 },
      { property: "x" as const, atMs: 1000 },
      { property: "x" as const, atMs: 2000 },
      { property: "opacity" as const, atMs: 500 },
    ];
    const moved = moveKeyframes(base, all, 1000);
    expect(moved?.x?.map((f) => [f.atMs, f.value])).toEqual([
      [1000, 0.1],
      [2000, 0.5],
      [3000, 0.9],
    ]);
    expect(moved?.opacity?.map((f) => f.atMs)).toEqual([1500]);
  });

  it("refuses when one moved key of a group collides with an unmoved key", () => {
    const pair = [
      { property: "x" as const, atMs: 0 },
      { property: "x" as const, atMs: 1000 },
    ];
    expect(moveKeyframes(base, pair, 1000)).toBe(base);
  });

  it("refuses a move that lands on an unmoved key", () => {
    expect(moveKeyframes(base, [{ property: "x", atMs: 0 }], 1000)).toBe(base);
  });

  it("refuses a move past the time limit", () => {
    expect(moveKeyframes(base, [{ property: "x", atMs: 2000 }], KEYFRAME_LIMITS.maxAbsMs)).toBe(base);
  });

  it("ignores keys that do not exist and returns the same reference for a zero move", () => {
    expect(moveKeyframes(base, [{ property: "y", atMs: 0 }], 100)).toBe(base);
    expect(moveKeyframes(base, [{ property: "x", atMs: 0 }], 0)).toBe(base);
    expect(moveKeyframes(undefined, [{ property: "x", atMs: 0 }], 100)).toBeUndefined();
  });
});

describe("duplicateKeyframes", () => {
  it("copies the listed keys shifted and keeps the originals", () => {
    const copied = duplicateKeyframes(base, [{ property: "x", atMs: 1000 }, { property: "opacity", atMs: 500 }], 300);
    expect(copied?.x?.map((f) => [f.atMs, f.value])).toEqual([
      [0, 0.1],
      [1000, 0.5],
      [1300, 0.5],
      [2000, 0.9],
    ]);
    expect(copied?.opacity?.map((f) => f.atMs)).toEqual([500, 800]);
  });

  it("refuses a copy that lands on an existing key", () => {
    expect(duplicateKeyframes(base, [{ property: "x", atMs: 0 }], 1000)).toBe(base);
  });

  it("refuses a copy past the per-property limit", () => {
    const full: Keyframes = { x: Array.from({ length: KEYFRAME_LIMITS.perProperty }, (_, i) => key(i * 10, 0.5)) };
    expect(duplicateKeyframes(full, [{ property: "x", atMs: 0 }], 5)).toBe(full);
  });

  it("refuses a copy past the time limit", () => {
    expect(duplicateKeyframes(base, [{ property: "x", atMs: 2000 }], KEYFRAME_LIMITS.maxAbsMs)).toBe(base);
  });

  it("refuses a zero shift, which would always collide", () => {
    expect(duplicateKeyframes(base, [{ property: "x", atMs: 0 }], 0)).toBe(base);
  });
});
