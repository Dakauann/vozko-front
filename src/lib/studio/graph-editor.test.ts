import { describe, expect, it } from "vitest";

import {
  axisLocked,
  boxGripAt,
  boxPixelTransform,
  dragSpeedHandle,
  dragValueHandle,
  fitRange,
  graphable,
  graphHitAt,
  graphLayer,
  graphProperties,
  graphRange,
  graphTicks,
  graphTransform,
  graphX,
  graphY,
  keyHandles,
  keysInGraphBox,
  msAtGraphX,
  nudgeHandle,
  peakSpeed,
  readoutAt,
  selectionBox,
  sidesJoined,
  speedCurve,
  valueAtGraphY,
  valueCurve,
  type GraphScale,
} from "./graph-editor";
import { keySide, keyVelocity, transformKeys } from "./keyframe-ease";
import type { Keyframe, Keyframes } from "./keyframes";
import type { PositionKeyframe } from "./path-keys";

function key(atMs: number, value: number, easing: Keyframe["easing"] = "linear"): Keyframe {
  return { atMs, value, easing };
}

function spot(atMs: number, x: number, y: number): PositionKeyframe {
  return { atMs, x, y, easing: "linear", spatial: "linear" };
}

const scale: GraphScale = { durationMs: 2000, widthPx: 200, heightPx: 120, padPx: 10, low: 0, high: 1 };

describe("which properties a graph shows", () => {
  const k: Keyframes = { x: [key(0, 0), key(1000, 1)], opacity: [key(0, 1)], fill: [{ atMs: 0, color: "#000000", easing: "linear" }], position: [spot(0, 0, 0), spot(1000, 1, 0)] };

  it("draws numbers in both graphs, paths only in the speed graph and colors in neither", () => {
    expect(graphable("x", "value")).toBe(true);
    expect(graphable("position", "value")).toBe(false);
    expect(graphable("position", "speed")).toBe(true);
    expect(graphable("fill", "speed")).toBe(false);
  });

  it("shows every animated property or only the chosen ones", () => {
    const { position, ...numbers } = k;
    expect(graphProperties(numbers, "value", "animated", "x", [])).toEqual(["x", "opacity"]);
    expect(graphProperties({ ...numbers, position }, "speed", "animated", "x", [])).toEqual(["x", "opacity", "position"]);
    expect(graphProperties(numbers, "value", "selected", "x", [{ property: "opacity", atMs: 0 }])).toEqual(["x", "opacity"]);
    expect(graphProperties(numbers, "value", "selected", "fill", [])).toEqual([]);
  });
});

describe("curves", () => {
  it("samples the eased value with flat ends and a step for a hold", () => {
    const curve = valueCurve([key(500, 0, "hold"), key(1000, 1)], 0, 2000, 4);
    expect(curve[0]).toEqual({ ms: 0, value: 0 });
    expect(curve).toContainEqual({ ms: 1000, value: 0 });
    expect(curve).toContainEqual({ ms: 1000, value: 1 });
    expect(curve[curve.length - 1]).toEqual({ ms: 2000, value: 1 });
    const eased = valueCurve([key(0, 0, "easeIn"), key(1000, 1)], 0, 1000, 4);
    expect(eased.find((p) => p.ms === 500)!.value).toBeCloseTo(0.125, 9);
  });

  it("derives a signed speed per second for numbers and an arc length speed for paths", () => {
    const linear = speedCurve("x", [key(0, 1), key(500, 0)], 0, 1000, undefined, 4);
    expect(linear.filter((p) => p.ms > 0 && p.ms < 500).every((p) => Math.abs(p.value + 2) < 1e-6)).toBe(true);
    expect(linear[linear.length - 1]).toEqual({ ms: 1000, value: 0 });
    const path = speedCurve("position", [spot(0, 0, 0), spot(1000, 0, 0.5)], 0, 1000, 1, 4);
    expect(path.filter((p) => p.ms > 0 && p.ms < 1000).every((p) => Math.abs(p.value - 0.5) < 1e-6)).toBe(true);
    expect(speedCurve("position", [spot(0, 0, 0), spot(1000, 0, 0.5)], 0, 1000, undefined, 4)).toEqual([]);
  });

  it("finds the peak speed of a segment and reads the curve under the pointer", () => {
    expect(peakSpeed("x", [key(0, 0, "easeInOut"), key(1000, 1)], 0)).toBeCloseTo(3, 2);
    expect(peakSpeed("fill", [{ atMs: 0, color: "#000000", easing: "linear" }, { atMs: 1000, color: "#ffffff", easing: "linear" }], 0)).toBeNull();
    const k: Keyframes = { x: [key(0, 0), key(1000, 0.5)] };
    expect(readoutAt(k, "x", "value", 500)).toBeCloseTo(0.25, 9);
    expect(readoutAt(k, "x", "speed", 500)).toBeCloseTo(0.5, 6);
    expect(readoutAt(k, "x", "speed", 1500)).toBe(0);
  });
});

describe("graph scale", () => {
  it("maps time and value to pixels and back", () => {
    expect(graphX(scale, 1000)).toBe(100);
    expect(msAtGraphX(scale, 50)).toBe(500);
    expect(graphY(scale, 1)).toBe(10);
    expect(graphY(scale, 0)).toBe(110);
    expect(valueAtGraphY(scale, 60)).toBeCloseTo(0.5, 9);
  });

  it("fits a range with padding and opens a flat one", () => {
    expect(fitRange([0, 1], 0.01, 0.1)).toEqual([-0.1, 1.1]);
    const flat = fitRange([2, 2], 0.5, 0);
    expect(flat).toEqual([1.75, 2.25]);
    expect(fitRange([], 1, 0)).toEqual([-0.5, 0.5]);
  });

  it("chooses round ticks inside the range", () => {
    expect(graphTicks(0, 1, 4)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(graphTicks(-35, 95, 6)).toEqual([-20, 0, 20, 40, 60, 80]);
    expect(graphTicks(1, 1, 4)).toEqual([]);
  });

  it("fits the value graph to the curve and handles, and the speed graph through zero", () => {
    const k: Keyframes = { x: [key(0, 0.2, "backOut"), key(1000, 0.6)] };
    const [low, high] = graphRange(k, "x", "value", 1000, undefined, [0]);
    expect(low).toBeLessThan(0.2);
    expect(high).toBeGreaterThan(0.6);
    const [speedLow] = graphRange({ x: [key(0, 0), key(1000, 1)] }, "x", "speed", 1000, undefined, []);
    expect(speedLow).toBeLessThan(0);
    const only = graphRange({ x: [key(0, 0), key(1000, 1), key(2000, 0.5)] }, "x", "value", 2000, undefined, [], [1000, 2000]);
    expect(only[0]).toBeGreaterThan(0.4);
  });
});

describe("handles", () => {
  const k: Keyframes = { x: [key(0, 0, "cubic-bezier(0.25,0.1,0.75,0.9)"), key(1000, 1, "cubic-bezier(0.5,0,0.5,1)"), key(2000, 0)] };

  it("places value handles on the segment bezier and speed handles at the side speed", () => {
    const value = keyHandles(k, "x", 1000, "value");
    expect(value.find((h) => h.side === "in")!.point.ms).toBeCloseTo(750, 6);
    expect(value.find((h) => h.side === "in")!.point.value).toBeCloseTo(0.9, 6);
    expect(value.find((h) => h.side === "out")!.point).toEqual({ ms: 1500, value: 1 });
    const speed = keyHandles(k, "x", 1000, "speed");
    expect(speed.find((h) => h.side === "in")!.point.ms).toBeCloseTo(750, 6);
    expect(speed.find((h) => h.side === "in")!.point.value).toBeCloseTo(0.4, 6);
    expect(speed.find((h) => h.side === "out")!.point.value).toBe(0);
    expect(keyHandles({ x: [key(0, 0, "hold"), key(1000, 1)] }, "x", 0, "value")).toEqual([]);
  });

  it("drags a value handle in influence and rise and keeps joined sides at one speed", () => {
    const eased: Keyframes = { x: [key(0, 0, "cubic-bezier(0.333,0.333,0.667,1)"), key(1000, 1, "cubic-bezier(0.333,0,0.667,0.667)"), key(2000, 2)] };
    expect(sidesJoined(eased, "x", 1000)).toBe(true);
    const moved = dragValueHandle(eased, "x", 1000, "out", { ms: 1500, value: 1.25 }, false)!;
    expect(keySide(moved, "x", 1000, "out")).toEqual({ influence: 0.5, rise: 0.25 });
    expect(keyVelocity(moved, "x", 1000)!.in!.speed).toBeCloseTo(keyVelocity(moved, "x", 1000)!.out!.speed!, 6);
    const split = dragValueHandle(eased, "x", 1000, "out", { ms: 1500, value: 1.25 }, true)!;
    expect(keyVelocity(split, "x", 1000)!.in!.speed).toBe(0);
  });

  it("drags a speed handle to set speed and influence, clamped to what the curve reaches", () => {
    const k2: Keyframes = { x: [key(0, 0), key(1000, 1)] };
    const set = dragSpeedHandle(k2, "x", 0, "out", { ms: 400, value: 2 }, false)!;
    expect(keyVelocity(set, "x", 0)!.out).toEqual({ speed: 2, influence: 0.4 });
    const steep = dragSpeedHandle(k2, "x", 0, "out", { ms: 100, value: 1000 }, false)!;
    expect(keySide(steep, "x", 0, "out")!.rise).toBe(2);
  });

  it("drags a path speed handle by arc length", () => {
    const path: Keyframes = { position: [spot(0, 0, 0), spot(1000, 0, 0.5)] };
    const set = dragSpeedHandle(path, "position", 0, "out", { ms: 500, value: 0.25 }, false, 1)!;
    expect(keyVelocity(set, "position", 0, 1)!.out).toEqual({ speed: 0.25, influence: 0.5 });
  });

  it("nudges a handle by influence and value from the keyboard", () => {
    const k2: Keyframes = { x: [key(0, 0), key(1000, 1)] };
    const nudged = nudgeHandle(k2, "x", 0, "out", "value", { influence: 0.1, value: 0.1 }, false)!;
    expect(keySide(nudged, "x", 0, "out")!.influence).toBeCloseTo(0.433, 6);
    expect(keySide(nudged, "x", 0, "out")!.rise).toBeCloseTo(0.433, 6);
    expect(nudgeHandle(k2, "x", 1000, "out", "value", { influence: 0.1, value: 0 }, false)).toBe(k2);
  });
});

describe("layers and hit testing", () => {
  const k: Keyframes = { x: [key(0, 0), key(1000, 1), key(2000, 0)] };
  const layer = graphLayer(k, "x", "value", scale, undefined, [1000]);

  it("marks keys and the handles of selected keys in pixels", () => {
    expect(layer.keys.map((mark) => [mark.atMs, mark.x, mark.y])).toEqual([
      [0, 0, 110],
      [1000, 100, 10],
      [2000, 200, 110],
    ]);
    expect(layer.handles.map((mark) => mark.side)).toEqual(["in", "out"]);
    expect(layer.points.length).toBeGreaterThan(3);
  });

  it("hits handles before keys and finds keys inside a box", () => {
    const handle = layer.handles[1];
    expect(graphHitAt([layer], handle.x + 2, handle.y)).toEqual({ kind: "handle", property: "x", atMs: 1000, side: "out" });
    expect(graphHitAt([layer], 101, 12)).toEqual({ kind: "key", property: "x", atMs: 1000 });
    expect(graphHitAt([layer], 50, 50)).toBeNull();
    expect(keysInGraphBox([layer], { left: 90, right: 210, top: 0, bottom: 50 })).toEqual([{ property: "x", atMs: 1000 }]);
  });
});

describe("transform box", () => {
  const box = selectionBox([
    { x: 100, y: 10 },
    { x: 200, y: 110 },
  ])!;

  it("bounds the selected keys and finds the grip under the pointer", () => {
    expect(box).toEqual({ left: 100, right: 200, top: 10, bottom: 110 });
    expect(selectionBox([{ x: 1, y: 1 }])).toBeNull();
    expect(boxGripAt(box, 200, 60)).toBe("right");
    expect(boxGripAt(box, 100, 10)).toBe("topLeft");
    expect(boxGripAt(box, 150, 60)).toBe("move");
    expect(boxGripAt(box, 20, 60)).toBeNull();
  });

  it("scales from the opposite edge and moves from inside", () => {
    expect(boxPixelTransform(box, "right", 100, 0)).toEqual({ pivotX: 100, scaleX: 2, offsetX: 0, pivotY: 0, scaleY: 1, offsetY: 0 });
    expect(boxPixelTransform(box, "top", 0, 50)).toEqual({ pivotX: 0, scaleX: 1, offsetX: 0, pivotY: 110, scaleY: 0.5, offsetY: 0 });
    expect(boxPixelTransform(box, "move", 10, -5)).toEqual({ pivotX: 0, scaleX: 1, offsetX: 10, pivotY: 0, scaleY: 1, offsetY: -5 });
    expect(boxPixelTransform(box, "left", 200, 0).scaleX).toBeGreaterThan(0);
  });

  it("turns a pixel transform into time and per property value maps", () => {
    const transform = graphTransform(boxPixelTransform(box, "bottomRight", 100, -50), { x: scale }, "value");
    expect(transform.time).toEqual({ pivot: 1000, scale: 2, offset: 0 });
    expect(transform.values!.x!.pivot).toBeCloseTo(1, 9);
    expect(transform.values!.x!.scale).toBe(0.5);
    const k: Keyframes = { x: [key(1000, 1), key(2000, 0)] };
    const edit = transformKeys(k, [{ property: "x", atMs: 1000 }, { property: "x", atMs: 2000 }], transform)!;
    expect(edit.keyframes.x!.map((f) => [f.atMs, f.value])).toEqual([
      [1000, 1],
      [3000, 0.5],
    ]);
    expect(graphTransform(boxPixelTransform(box, "move", 0, -10), { x: scale }, "speed").values).toBeUndefined();
  });

  it("locks a drag to its stronger axis", () => {
    expect(axisLocked(10, 3)).toEqual({ dx: 10, dy: 0 });
    expect(axisLocked(-2, 8)).toEqual({ dx: 0, dy: 8 });
  });
});
