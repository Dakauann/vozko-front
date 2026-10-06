import { describe, expect, it } from "vitest";

import {
  adjacentKey,
  editTransform,
  isAnimated,
  keyAt,
  keyTimes,
  localTime,
  propertyValue,
  setKeyEasing,
  toggleAnimation,
  toggleKeyAt,
} from "./keyframe-edit";

const box = { x: 0.5, y: 0.5, w: 0.4, h: 0.2, rotation: 0, opacity: 1 };
const still = { startMs: 1000, durationMs: 4000, transform: box };
const moving = {
  ...still,
  keyframes: {
    x: [
      { atMs: 0, value: 0.2, easing: "linear" as const },
      { atMs: 2000, value: 0.8, easing: "linear" as const },
    ],
    scale: [{ atMs: 1000, value: 2, easing: "linear" as const }],
  },
};

describe("keyframe editing", () => {
  it("reads clip local time only inside the clip", () => {
    expect(localTime(still, 1500)).toBe(500);
    expect(localTime(still, 900)).toBeNull();
    expect(localTime(still, 5000)).toBe(4000);
  });

  it("reads static and animated values", () => {
    expect(propertyValue(still, "x", 0)).toBe(0.5);
    expect(propertyValue(still, "scale", 0)).toBe(1);
    expect(propertyValue(moving, "x", 1000)).toBeCloseTo(0.5);
    expect(isAnimated(moving, "x")).toBe(true);
    expect(isAnimated(moving, "y")).toBe(false);
  });

  it("finds keys near the playhead and navigates between them", () => {
    expect(keyAt(moving.keyframes.x, 2010)?.atMs).toBe(2000);
    expect(keyAt(moving.keyframes.x, 1000)).toBeNull();
    expect(keyTimes(moving)).toEqual([0, 1000, 2000]);
    expect(adjacentKey([0, 1000, 2000], 1000, 1)).toBe(2000);
    expect(adjacentKey([0, 1000, 2000], 1000, -1)).toBe(0);
    expect(adjacentKey([0, 1000, 2000], 2000, 1)).toBeNull();
  });

  it("turns animation on with a key at the playhead and off keeping the current value", () => {
    const on = toggleAnimation(still, "opacity", 700);
    expect(on.keyframes?.opacity).toEqual([{ atMs: 700, value: 1, easing: "linear" }]);
    const off = toggleAnimation(moving, "x", 1000);
    expect(off.keyframes?.x).toBeUndefined();
    expect(off.keyframes?.scale).toHaveLength(1);
    expect(off.transform?.x).toBeCloseTo(0.5);
    const unscaled = toggleAnimation({ ...still, keyframes: { scale: moving.keyframes.scale } }, "scale", 0);
    expect(unscaled.keyframes).toBeUndefined();
    expect(unscaled.transform).toMatchObject({ w: 0.8, h: 0.4 });
  });

  it("adds or removes the key under the playhead and sets its easing", () => {
    expect(toggleKeyAt(moving, "x", 2005).keyframes?.x).toHaveLength(1);
    expect(toggleKeyAt(moving, "x", 1000).keyframes?.x).toHaveLength(3);
    expect(setKeyEasing(moving, "x", 0, "easeOut")?.keyframes?.x?.[0].easing).toBe("easeOut");
    expect(setKeyEasing(moving, "x", 1000, "easeOut")).toBeNull();
  });

  it("routes a transform edit to keys for animated properties and to the base for the rest", () => {
    const edit = editTransform(moving, { ...box, x: 0.6, y: 0.3, w: 1.2, h: 0.6 }, 1000);
    expect(edit.outside).toBe(false);
    expect(edit.patch.transform).toMatchObject({ x: 0.5, y: 0.3, w: 0.4 });
    expect(edit.patch.keyframes?.x?.map((f) => f.atMs)).toEqual([0, 1000, 2000]);
    expect(edit.patch.keyframes?.scale?.[0].value).toBeCloseTo(3);
  });

  it("flags an animated edit made with the playhead outside the clip", () => {
    const edit = editTransform(moving, { ...box, x: 0.1 }, null);
    expect(edit.outside).toBe(true);
    expect(edit.patch.keyframes).toBeUndefined();
    expect(editTransform(still, { ...box, x: 0.1 }, null).patch.transform?.x).toBe(0.1);
  });
});
