import { describe, expect, it } from "vitest";

import {
  KEYFRAME_LIMITS,
  animatedTransform,
  keyframeCount,
  keyframesInRange,
  keyframesIssue,
  removeKeyframe,
  setKeyframe,
  shiftKeyframes,
  valueAt,
  type Easing,
  type Keyframe,
  type Keyframes,
} from "./keyframes";

const box = { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, opacity: 1 };

function ramp(easing: Easing): Keyframe[] {
  return [
    { atMs: 1000, value: 0, easing },
    { atMs: 3000, value: 100, easing: "linear" },
  ];
}

const SHARED_VECTORS: Array<[string, Keyframe[], number, number]> = [
  ["holds the first value before it", ramp("linear"), 0, 0],
  ["holds the last value after it", ramp("linear"), 5000, 100],
  ["linear midpoint", ramp("linear"), 2000, 50],
  ["linear quarter", ramp("linear"), 1500, 25],
  ["hold keeps the value until the next key", ramp("hold"), 2999, 0],
  ["hold lands on the next key", ramp("hold"), 3000, 100],
  ["ease in starts slow", ramp("easeIn"), 1500, 1.5625],
  ["ease out starts fast", ramp("easeOut"), 1500, 57.8125],
  ["ease in out is symmetric at the middle", ramp("easeInOut"), 2000, 50],
  ["ease in out first quarter", ramp("easeInOut"), 1500, 6.25],
  ["ease in out last quarter", ramp("easeInOut"), 2500, 93.75],
  ["a single key is constant", [{ atMs: 500, value: 7, easing: "easeIn" }], 9000, 7],
  [
    "the outgoing easing of each key shapes its segment",
    [
      { atMs: 0, value: 0, easing: "linear" },
      { atMs: 1000, value: 10, easing: "hold" },
      { atMs: 2000, value: 20, easing: "linear" },
    ],
    1500,
    10,
  ],
  [
    "negative times work for keys before the clip",
    [
      { atMs: -1000, value: 0, easing: "linear" },
      { atMs: 1000, value: 10, easing: "linear" },
    ],
    0,
    5,
  ],
];

describe("keyframe interpolation (same vectors as the Go renderer)", () => {
  it.each(SHARED_VECTORS)("%s", (_name, frames, atMs, want) => {
    expect(valueAt(frames, atMs)).toBeCloseTo(want, 9);
  });
});

describe("animated transform", () => {
  it("overrides position, rotation and opacity and multiplies the box by scale", () => {
    const k: Keyframes = {
      x: [{ atMs: 0, value: 0.2, easing: "linear" }, { atMs: 1000, value: 0.8, easing: "linear" }],
      scale: [{ atMs: 0, value: 2, easing: "linear" }],
      opacity: [{ atMs: 0, value: 0.5, easing: "linear" }],
    };
    expect(animatedTransform(box, k, 500)).toEqual({ x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 0.5 });
    expect(animatedTransform(box, undefined, 500)).toBe(box);
  });
});

describe("editing keyframes", () => {
  it("adds, replaces and removes a key while keeping the order", () => {
    let k = setKeyframe(undefined, "x", 1000, 0.7);
    k = setKeyframe(k, "x", 0, 0.1, "easeOut");
    k = setKeyframe(k, "x", 1000, 0.9);
    expect(k?.x).toEqual([
      { atMs: 0, value: 0.1, easing: "easeOut" },
      { atMs: 1000, value: 0.9, easing: "linear" },
    ]);
    k = removeKeyframe(k, "x", 0);
    k = removeKeyframe(k, "x", 1000);
    expect(k).toBeUndefined();
  });

  it("refuses a key past the per property limit", () => {
    let k: Keyframes | undefined;
    for (let i = 0; i < KEYFRAME_LIMITS.perProperty; i++) k = setKeyframe(k, "y", i * 10, 0.5);
    expect(setKeyframe(k, "y", 99_999, 0.5)).toBe(k);
  });

  it("moves keys with the content when the clip start is trimmed", () => {
    const k: Keyframes = { x: [{ atMs: 500, value: 0.1, easing: "linear" }] };
    expect(shiftKeyframes(k, -200)?.x?.[0].atMs).toBe(300);
    expect(shiftKeyframes(undefined, -200)).toBeUndefined();
  });

  it("keeps only the keys that shape a range, so a split half animates the same", () => {
    const k: Keyframes = {
      x: [0, 1000, 2000, 3000, 4000].map((atMs, i) => ({ atMs, value: i / 10, easing: "linear" as const })),
      opacity: [{ atMs: 5000, value: 1, easing: "linear" }],
    };
    const kept = keyframesInRange(k, 1500, 2500);
    expect(kept?.x?.map((f) => f.atMs)).toEqual([1000, 2000, 3000]);
    expect(kept?.opacity?.map((f) => f.atMs)).toEqual([5000]);
    for (const at of [1500, 1800, 2200, 2500]) expect(valueAt(kept!.x!, at)).toBeCloseTo(valueAt(k.x!, at), 12);
  });

  it("counts every key of a clip", () => {
    expect(keyframeCount({ x: ramp("linear"), opacity: [{ atMs: 0, value: 1, easing: "hold" }] })).toBe(3);
    expect(keyframeCount(undefined)).toBe(0);
  });
});

describe("keyframe rules (mirror of the backend)", () => {
  it("accepts a valid animation", () => {
    expect(
      keyframesIssue(
        {
          x: [{ atMs: 0, value: -0.5, easing: "easeOut" }, { atMs: 1000, value: 0.5, easing: "linear" }],
          scale: [{ atMs: 0, value: 0.2, easing: "easeInOut" }, { atMs: 4000, value: 2, easing: "linear" }],
          rotation: [{ atMs: 0, value: -720, easing: "linear" }],
        },
        box,
      ),
    ).toBeNull();
    expect(keyframesIssue(undefined, box)).toBeNull();
  });

  it.each<[string, Keyframes, string]>([
    ["unsorted", { y: [{ atMs: 1000, value: 0.1, easing: "linear" }, { atMs: 1000, value: 0.2, easing: "linear" }] }, "out_of_range"],
    ["unknown easing", { y: [{ atMs: 0, value: 0.1, easing: "bounce" as Easing }] }, "unknown"],
    ["opacity range", { opacity: [{ atMs: 0, value: 1.5, easing: "linear" }] }, "out_of_range"],
    ["position range", { x: [{ atMs: 0, value: 3, easing: "linear" }] }, "out_of_range"],
    ["scale range", { scale: [{ atMs: 0, value: 0, easing: "linear" }] }, "out_of_range"],
    ["oversized box", { scale: [{ atMs: 0, value: 9, easing: "linear" }] }, "out_of_range"],
    ["rotation range", { rotation: [{ atMs: 0, value: 5000, easing: "linear" }] }, "out_of_range"],
    ["time range", { x: [{ atMs: 90_001, value: 0.5, easing: "linear" }] }, "out_of_range"],
    ["empty", {}, "required"],
  ])("refuses %s", (_name, k, code) => {
    expect(keyframesIssue(k, box)).toBe(code);
  });
});
