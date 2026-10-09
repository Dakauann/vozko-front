import { describe, expect, it } from "vitest";

import { KEYFRAME_LIMITS, TRANSFORM_PROPERTIES, type Keyframes } from "./keyframes";
import { keyState, momentEasing, momentState, recordMoment, removeMoment, setAllEasing, setMomentEasing } from "./keyframe-edit";

const box = { x: 0.5, y: 0.4, w: 0.4, h: 0.2, rotation: 10, opacity: 0.8 };
const still = { startMs: 1000, durationMs: 4000, transform: box };
const moving = {
  ...still,
  keyframes: {
    x: [
      { atMs: 0, value: 0.2, easing: "linear" as const },
      { atMs: 2000, value: 0.8, easing: "easeOut" as const },
    ],
  } satisfies Keyframes,
};

describe("keyframe moments", () => {
  it("records every property at the playhead with its current value", () => {
    const patch = recordMoment(still, 500);
    expect(patch).not.toBeNull();
    for (const property of TRANSFORM_PROPERTIES) expect(patch?.keyframes?.[property]?.map((f) => f.atMs)).toEqual([500]);
    expect(patch?.keyframes?.x?.[0].value).toBe(0.5);
    expect(patch?.keyframes?.scale?.[0].value).toBe(1);
    expect(patch?.keyframes?.rotation?.[0].value).toBe(10);
    expect(patch?.keyframes?.opacity?.[0].value).toBe(0.8);
  });

  it("records the interpolated value and keeps existing keys", () => {
    const patch = recordMoment(moving, 1000);
    expect(patch?.keyframes?.x?.map((f) => f.atMs)).toEqual([0, 1000, 2000]);
    expect(patch?.keyframes?.x?.[1].value).toBeCloseTo(0.5);
  });

  it("snaps to a key within tolerance instead of adding a near duplicate", () => {
    const patch = recordMoment(moving, 2010);
    expect(patch?.keyframes?.x?.map((f) => f.atMs)).toEqual([0, 2000]);
    expect(patch?.keyframes?.y?.map((f) => f.atMs)).toEqual([2010]);
  });

  it("refuses when a property is already at its key limit", () => {
    const full = { ...still, keyframes: { x: Array.from({ length: KEYFRAME_LIMITS.perProperty }, (_, i) => ({ atMs: i * 100, value: 0.5, easing: "linear" as const })) } };
    expect(recordMoment(full, 3350)).toBeNull();
  });

  it("removes every key at the moment", () => {
    const recorded = { ...moving, keyframes: recordMoment(moving, 1000)!.keyframes };
    const patch = removeMoment(recorded, 1005);
    expect(patch.keyframes?.x?.map((f) => f.atMs)).toEqual([0, 2000]);
    expect(patch.keyframes?.y).toBeUndefined();
    expect(removeMoment(still, 0).keyframes).toBeUndefined();
  });

  it("describes the playhead against the keys", () => {
    expect(momentState(moving, null)).toBe("outside");
    expect(momentState({ ...still, keyframes: undefined }, 100)).toBe("none");
    expect(momentState(moving, 2000)).toBe("key");
    expect(momentState(moving, 1000)).toBe("between");
    expect(momentState(moving, 3000)).toBe("between");
  });

  it("describes each property", () => {
    expect(keyState(moving, "x", 0)).toBe("key");
    expect(keyState(moving, "x", 500)).toBe("interpolated");
    expect(keyState(moving, "y", 500)).toBe("static");
    expect(keyState(moving, "x", null)).toBe("static");
  });

  it("reads and sets easing at a moment and across a clip", () => {
    expect(momentEasing(moving, 2000)).toBe("easeOut");
    expect(momentEasing(moving, 1000)).toBeNull();
    const eased = setMomentEasing(moving, 0, "hold");
    expect(eased?.keyframes?.x?.map((f) => f.easing)).toEqual(["hold", "easeOut"]);
    expect(setMomentEasing(moving, 1000, "hold")).toBeNull();
    const all = setAllEasing(moving, "easeInOut");
    expect(all?.keyframes?.x?.map((f) => f.easing)).toEqual(["easeInOut", "easeInOut"]);
    expect(setAllEasing({ ...still, keyframes: undefined }, "linear")).toBeNull();
  });

  it("reports no shared easing when keys at a moment differ", () => {
    const mixed = { ...still, keyframes: { x: [{ atMs: 0, value: 0.5, easing: "linear" as const }], y: [{ atMs: 0, value: 0.5, easing: "hold" as const }] } };
    expect(momentEasing(mixed, 0)).toBeNull();
  });
});
