import { describe, expect, it } from "vitest";

import { keySide, keyVelocity, segmentDistance, setKeySide, setKeySpeed, setKeysVelocity, stretchKeys, transformKeys } from "./keyframe-ease";
import type { Keyframe, Keyframes } from "./keyframes";
import type { PositionKeyframe } from "./path-keys";

function key(atMs: number, value: number, easing: Keyframe["easing"] = "linear", smooth?: boolean): Keyframe {
  return smooth ? { atMs, value, easing, smooth } : { atMs, value, easing };
}

function spot(atMs: number, x: number, y: number): PositionKeyframe {
  return { atMs, x, y, easing: "linear", spatial: "linear" };
}

describe("path speed by arc length", () => {
  const path: Keyframes = { position: [spot(0, 0, 0), spot(1000, 0, 0.5), spot(3000, 0.5, 0.5)] };

  it("measures a path segment by its length and a numeric one by its change", () => {
    expect(segmentDistance("position", path.position!, 0, 1)).toBeCloseTo(0.5, 6);
    expect(segmentDistance("position", path.position!, 1, 2)).toBeCloseTo(1, 6);
    expect(segmentDistance("position", path.position!, 0)).toBeNull();
    expect(segmentDistance("x", [key(0, 0.2), key(1000, 0.8)], 0)).toBeCloseTo(0.6, 9);
    expect(segmentDistance("fill", [{ atMs: 0, color: "#000000", easing: "linear" }, { atMs: 1000, color: "#ffffff", easing: "linear" }], 0)).toBeNull();
  });

  it("reads path speed only when the frame aspect is known", () => {
    expect(keyVelocity(path, "position", 1000, 1)!.in!.speed).toBeCloseTo(0.5, 6);
    expect(keyVelocity(path, "position", 1000, 1)!.out!.speed).toBeCloseTo(0.25, 6);
    expect(keyVelocity(path, "position", 1000)!.in!.speed).toBeNull();
  });

  it("sets a path speed by arc length and refuses it without the aspect", () => {
    const result = setKeysVelocity(path, [{ property: "position", atMs: 1000 }], { out: { speed: 0.5, influence: 0.5 } }, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(keyVelocity(result.keyframes, "position", 1000, 1)!.out).toEqual({ speed: 0.5, influence: 0.5 });
    expect(setKeysVelocity(path, [{ property: "position", atMs: 1000 }], { out: { speed: 0.5 } })).toEqual({ ok: false, refusal: { kind: "notNumeric", property: "position" } });
  });
});

describe("one side of a key", () => {
  const k: Keyframes = { x: [key(0, 0), key(1000, 1, "linear", true), key(2000, 0, "hold"), key(3000, 1)] };

  it("reads the influence and rise of each side", () => {
    expect(keySide(k, "x", 0, "out")).toEqual({ influence: 0.333, rise: 0.333 });
    expect(keySide(k, "x", 1000, "in")!.influence).toBeCloseTo(0.333, 9);
    expect(keySide(k, "x", 1000, "in")!.rise).toBeCloseTo(0.333, 9);
    expect(keySide(k, "x", 0, "in")).toBeNull();
    expect(keySide(k, "x", 2000, "out")).toBeNull();
    expect(keySide(k, "x", 500, "out")).toBeNull();
  });

  it("writes one side, clamps it to the curve and turns a smooth key manual", () => {
    const out = setKeySide(k, "x", 1000, "out", { influence: 0.6, rise: 0.2 })!;
    expect(out.x![1]).toEqual({ atMs: 1000, value: 1, easing: "cubic-bezier(0.6,0.2,0.667,0.667)" });
    const into = setKeySide(k, "x", 1000, "in", { influence: 2, rise: 5 })!;
    expect(into.x![0].easing).toBe("cubic-bezier(0.333,0.333,0,-1)");
    expect(setKeySide(k, "x", 3000, "in", { influence: 0.5, rise: 0.5 })).toBe(k);
    expect(setKeySide(k, "x", 1000, "out", { influence: Number.NaN, rise: 0.5 })).toBe(k);
  });
});

describe("setting one side's speed for a gesture", () => {
  const k: Keyframes = { x: [key(0, 0), key(1000, 1), key(2000, 1)] };

  it("sets speed and influence, clamping to the curve instead of refusing", () => {
    expect(keyVelocity(setKeySpeed(k, "x", 0, "out", { speed: 2, influence: 0.5 }), "x", 0)!.out).toEqual({ speed: 2, influence: 0.5 });
    expect(keySide(setKeySpeed(k, "x", 0, "out", { speed: 900, influence: 0.5 }), "x", 0, "out")).toEqual({ influence: 0.5, rise: 2 });
  });

  it("keeps the rise on a flat segment and leaves a missing side alone", () => {
    expect(keySide(setKeySpeed(k, "x", 1000, "out", { speed: 3, influence: 0.6 }), "x", 1000, "out")).toEqual({ influence: 0.6, rise: 0.333 });
    expect(setKeySpeed(k, "x", 0, "in", { speed: 1 })).toBe(k);
  });
});

describe("transforming keys in time and value", () => {
  const k: Keyframes = { x: [key(0, 0.2), key(1000, 0.4), key(2000, 0.6), key(4000, 0.8)], opacity: [key(1000, 0.5), key(2000, 1)] };

  it("moves keys in time and value together and returns the moved selection", () => {
    const edit = transformKeys(k, [{ property: "x", atMs: 1000 }, { property: "x", atMs: 2000 }], { time: { pivot: 0, scale: 1, offset: 500 }, values: { x: { pivot: 0, scale: 1, offset: 0.1 } } })!;
    expect(edit.keyframes.x!.map((f) => [f.atMs, Number(f.value.toFixed(6))])).toEqual([
      [0, 0.2],
      [1500, 0.5],
      [2500, 0.7],
      [4000, 0.8],
    ]);
    expect(edit.keys).toEqual([
      { property: "x", atMs: 1500 },
      { property: "x", atMs: 2500 },
    ]);
  });

  it("scales around a pivot per property and clamps values to the property range", () => {
    const edit = transformKeys(k, [{ property: "opacity", atMs: 1000 }, { property: "opacity", atMs: 2000 }], { time: { pivot: 1000, scale: 2, offset: 0 }, values: { opacity: { pivot: 0.5, scale: 3, offset: 0 } } })!;
    expect(edit.keyframes.opacity).toEqual([key(1000, 0.5), key(3000, 1)]);
  });

  it("refuses collisions, a flipped or empty time scale and values that are not numbers", () => {
    expect(transformKeys(k, [{ property: "x", atMs: 1000 }], { time: { pivot: 0, scale: 1, offset: 1000 } })).toBeNull();
    expect(transformKeys(k, [{ property: "x", atMs: 1000 }], { time: { pivot: 0, scale: -1, offset: 0 } })).toBeNull();
    expect(transformKeys(k, [{ property: "x", atMs: 1000 }], { values: { x: { pivot: 0, scale: Number.NaN, offset: 0 } } })).toBeNull();
    expect(transformKeys(k, [], { time: { pivot: 0, scale: 1, offset: 10 } })).toBeNull();
  });

  it("keeps stretching as a time transform from the first or last key", () => {
    const picked = [
      { property: "x" as const, atMs: 1000 },
      { property: "x" as const, atMs: 2000 },
    ];
    expect(stretchKeys(k, picked, 1.5, "first")).toEqual(transformKeys(k, picked, { time: { pivot: 1000, scale: 1.5, offset: 0 } }));
  });
});
