import { describe, expect, it } from "vitest";

import { editFieldValue, fieldKeyState, fieldValue, lanesIssue, setFieldKey, setFieldLane, toggleFieldKey, type AnimatedFields } from "./animated-fields";
import type { Keyframe } from "./keyframes";

interface Dot {
  size: number;
  glow?: number;
  keyframes?: Partial<Record<"size" | "glow", Keyframe[]>>;
}

const DOT: AnimatedFields<Dot, "size" | "glow"> = {
  staticValue: (dot, property) => (property === "size" ? dot.size : (dot.glow ?? 0.5)),
  withStatic: (dot, property, value) => ({ ...dot, [property]: value }),
  range: (property) => (property === "size" ? [0, 10] : [0, 1]),
};

const key = (atMs: number, value: number): Keyframe => ({ atMs, value, easing: "linear" });

describe("animated fields", () => {
  it("reads the static value until a lane exists, then the lane, clamped to the range", () => {
    expect(fieldValue(DOT, { size: 4 }, "size", 300)).toBe(4);
    expect(fieldValue(DOT, { size: 4 }, "glow", 300)).toBe(0.5);
    const lit = setFieldKey(DOT, setFieldKey(DOT, { size: 4 }, "size", 0, 2), "size", 1000, 12);
    expect(fieldValue(DOT, lit, "size", 500)).toBe(6);
    expect(fieldValue(DOT, lit, "size", 1000)).toBe(10);
  });

  it("keeps the easing of a key it replaces and sorts keys by time", () => {
    const eased = { size: 1, keyframes: { size: [{ atMs: 500, value: 1, easing: "easeIn" as const }] } };
    const next = setFieldKey(DOT, setFieldKey(DOT, eased, "size", 500, 3), "size", 100, 2);
    expect(next.keyframes?.size).toEqual([key(100, 2), { atMs: 500, value: 3, easing: "easeIn" }]);
  });

  it("replaces a whole lane and folds an emptied lane back into the static value", () => {
    const lane = setFieldLane(DOT, { size: 1 }, "size", [key(800, 6), key(0, 2)]);
    expect(lane.keyframes?.size?.map((frame) => frame.atMs)).toEqual([0, 800]);
    const cleared = setFieldLane(DOT, lane, "size", []);
    expect(cleared.keyframes).toBeUndefined();
    expect(cleared.size).toBe(2);
  });

  it("toggles a key at the moment and keeps the last value when the last key goes", () => {
    const keyed = toggleFieldKey(DOT, { size: 3 }, "size", 200);
    expect(keyed.keyframes?.size).toEqual([key(200, 3)]);
    const back = toggleFieldKey(DOT, setFieldKey(DOT, keyed, "size", 200, 7), "size", 200);
    expect(back.keyframes).toBeUndefined();
    expect(back.size).toBe(7);
  });

  it("tells key, interpolated and static states", () => {
    const keyed = setFieldKey(DOT, { size: 1 }, "size", 400, 2);
    expect(fieldKeyState(keyed, "size", 400)).toBe("key");
    expect(fieldKeyState(keyed, "size", 100)).toBe("interpolated");
    expect(fieldKeyState(keyed, "size", null)).toBe("interpolated");
    expect(fieldKeyState(keyed, "glow", 400)).toBe("static");
  });

  it("edits the static value of a still field, writes a key on an animated one and refuses without a moment", () => {
    expect(editFieldValue(DOT, { size: 1 }, "size", 4, null)).toEqual({ size: 4 });
    const keyed = setFieldKey(DOT, { size: 1 }, "size", 0, 1);
    expect(editFieldValue(DOT, keyed, "size", 5, 300)?.keyframes?.size).toEqual([key(0, 1), key(300, 5)]);
    expect(editFieldValue(DOT, keyed, "size", 5, null)).toBeNull();
  });

  it("checks lanes: known names, easing, order, time and range", () => {
    const allowed = (property: string) => (property === "size" ? ([0, 10] as const) : null);
    expect(lanesIssue({ size: [key(0, 1), key(10, 2)] }, allowed)).toBeNull();
    expect(lanesIssue({ glow: [key(0, 1)] }, allowed)).toBe("invalid");
    expect(lanesIssue({ size: [key(10, 1), key(0, 2)] }, allowed)).toBe("out_of_range");
    expect(lanesIssue({ size: [key(0, 11)] }, allowed)).toBe("out_of_range");
    expect(lanesIssue({ size: [{ atMs: 0, value: 1, easing: "wobbly" as never }] }, allowed)).toBe("unknown");
    expect(lanesIssue({ size: [key(999_999, 1)] }, allowed)).toBe("out_of_range");
  });
});
