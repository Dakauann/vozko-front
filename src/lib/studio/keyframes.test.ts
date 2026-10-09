import { describe, expect, it } from "vitest";

import {
  KEYFRAME_LIMITS,
  animatedTransform,
  keyframeCount,
  keyframeFault,
  keyframesInRange,
  keyframesIssue,
  bezierEasing,
  bezierOf,
  ease,
  easingReach,
  isEasing,
  maxScale,
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
  ["back in pulls back before leaving", ramp("backIn"), 1500, -6.41365625],
  ["back in last quarter", ramp("backIn"), 2500, 18.25903125],
  ["back out overshoots and settles", ramp("backOut"), 2500, 106.41365625],
  ["back in out pulls back and overshoots", ramp("backInOut"), 2500, 109.968184375],
  ["back in out first quarter", ramp("backInOut"), 1500, -9.968184375],
  ["elastic rings past the target", ramp("elastic"), 1500, 91.1611652352],
  ["elastic last quarter", ramp("elastic"), 2500, 100.5524271728],
  ["bounce first quarter", ramp("bounce"), 1500, 47.265625],
  ["bounce last quarter", ramp("bounce"), 2500, 97.265625],
  ["spring overshoots early", ramp("spring"), 1500, 102.1143579132],
  ["spring settles back", ramp("spring"), 2500, 97.2042262475],
  ["every easing lands on the next key", ramp("spring"), 3000, 100],
  ["an emphasized entrance curve rushes out", ramp("cubic-bezier(0.05,0.7,0.1,1)"), 1500, 83.1529746487],
  ["an emphasized entrance curve at the middle", ramp("cubic-bezier(0.05,0.7,0.1,1)"), 2000, 95.0247475324],
  ["a bezier with handles past 1 overshoots", ramp("cubic-bezier(0.34,1.56,0.64,1)"), 2000, 108.7400670219],
  ["a bezier with handles past 1 settles back", ramp("cubic-bezier(0.34,1.56,0.64,1)"), 2500, 105.9646859964],
  ["an emphasized exit curve starts slow", ramp("cubic-bezier(0.3, 0, 0.8, 0.15)"), 2500, 40.5585508922],
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

describe("custom curves", () => {
  it("reads a css cubic-bezier with its handles inside the allowed box", () => {
    expect(bezierOf("cubic-bezier(0.05,0.7,0.1,1)")).toEqual([0.05, 0.7, 0.1, 1]);
    expect(bezierOf("cubic-bezier( 0.3 , 0 , 0.8 , 0.15 )")).toEqual([0.3, 0, 0.8, 0.15]);
    for (const bad of ["cubic-bezier(1.2,0,0.5,1)", "cubic-bezier(0.2,3,0.5,1)", "cubic-bezier(0.2,0,0.5)", "bezier(0,0,1,1)", "cubic-bezier(a,0,1,1)", "cubic-bezier(-0.1,0,1,1)"]) expect(bezierOf(bad)).toBeNull();
    expect(isEasing("cubic-bezier(0.2,0,0,1)")).toBe(true);
    expect(isEasing("cubic-bezier(0.2,0,0,9)")).toBe(false);
    expect(bezierEasing([0.2, 0, 0, 1])).toBe("cubic-bezier(0.2,0,0,1)");
  });

  it("measures how far a curve overshoots so the animated box covers it", () => {
    const [low, high] = easingReach("cubic-bezier(0.34,1.56,0.64,1)");
    expect(low).toBe(0);
    expect(high).toBeGreaterThan(1.09);
    for (let i = 0; i <= 100; i++) expect(ease("cubic-bezier(0.34,1.56,0.64,1)", i / 100)).toBeLessThanOrEqual(high);
    expect(easingReach("cubic-bezier(0.2,0,0,1)")).toEqual([0, 1]);
  });

  it("refuses a key whose curve is malformed", () => {
    expect(keyframeFault({ y: [{ atMs: 0, value: 0.1, easing: "cubic-bezier(2,0,0,1)" as Easing }] }, box)).toMatchObject({ kind: "easing" });
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

  it("keeps an overshooting opacity between 0 and 1 and never flips the box", () => {
    const k: Keyframes = {
      opacity: [{ atMs: 0, value: 0, easing: "backOut" }, { atMs: 1000, value: 1, easing: "linear" }],
      scale: [{ atMs: 0, value: 1, easing: "backOut" }, { atMs: 1000, value: 0.05, easing: "linear" }],
    };
    const shown = animatedTransform(box, k, 750);
    expect(shown.opacity).toBe(1);
    expect(shown.w).toBeGreaterThanOrEqual(0);
    expect(shown.h).toBeGreaterThanOrEqual(0);
  });

  it("sizes the animated box for the overshoot of the easing, not only the keys", () => {
    const k: Keyframes = { scale: [{ atMs: 0, value: 1, easing: "elastic" }, { atMs: 1000, value: 2, easing: "linear" }] };
    expect(maxScale(k)).toBeGreaterThanOrEqual(2.37);
    for (let ms = 0; ms <= 1000; ms += 5) expect(valueAt(k.scale!, ms)).toBeLessThanOrEqual(maxScale(k));
    expect(keyframeFault(k, { ...box, w: 1.8, h: 1.8 })).toMatchObject({ kind: "box" });
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
    ["unknown easing", { y: [{ atMs: 0, value: 0.1, easing: "wiggle" as Easing }] }, "unknown"],
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

describe("keyframeFault", () => {
  it("names nothing for a valid animation", () => {
    expect(keyframeFault({ scale: [{ atMs: 0, value: 1, easing: "linear" }, { atMs: 900, value: 1.2, easing: "easeOut" }] }, box)).toBeNull();
    expect(keyframeFault(undefined, box)).toBeNull();
  });

  it("points at the exact key whose value leaves the range", () => {
    expect(keyframeFault({ scale: [{ atMs: 0, value: 1, easing: "linear" }, { atMs: 500, value: 0, easing: "linear" }] }, box)).toEqual({
      kind: "value",
      property: "scale",
      atMs: 500,
      value: 0,
      range: [0.05, 5],
    });
  });

  it("reports repeated instants, times beyond the limit and unknown easings", () => {
    expect(keyframeFault({ y: [{ atMs: 400, value: 0.1, easing: "linear" }, { atMs: 400, value: 0.2, easing: "linear" }] }, box)).toEqual({
      kind: "order",
      property: "y",
      atMs: 400,
    });
    expect(keyframeFault({ x: [{ atMs: 90_001, value: 0.5, easing: "linear" }] }, box)).toEqual({ kind: "time", property: "x", atMs: 90_001, limit: 90_000 });
    expect(keyframeFault({ y: [{ atMs: 0, value: 0.1, easing: "wiggle" as Easing }] }, box)).toEqual({ kind: "easing", property: "y", atMs: 0, easing: "wiggle" });
  });

  it("gives the largest scale the box can take", () => {
    expect(keyframeFault({ scale: [{ atMs: 0, value: 4.5, easing: "linear" }] }, { ...box, w: 1, h: 1 })).toEqual({ kind: "box", scale: 4.5, maxScale: 4 });
    expect(keyframeFault({ scale: [{ atMs: 0, value: 4.6, easing: "linear" }] }, { ...box, w: 0.9, h: 0.4 })).toEqual({ kind: "box", scale: 4.6, maxScale: 4.44 });
  });

  it("counts keys past the per property limit and an empty set", () => {
    const many = Array.from({ length: 33 }, (_, i) => ({ atMs: i * 10, value: 0.5, easing: "linear" as Easing }));
    expect(keyframeFault({ x: many }, box)).toEqual({ kind: "too_many", property: "x", limit: 32 });
    expect(keyframeFault({}, box)).toEqual({ kind: "empty" });
  });
});
