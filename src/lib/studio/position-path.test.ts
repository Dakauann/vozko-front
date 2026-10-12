import { describe, expect, it } from "vitest";

import { msOfFrame } from "./document";
import { ease, valueAt, type Keyframe } from "./keyframes";
import type { PositionKeyframe } from "./path-keys";
import { headingAt, joinedPath, pathPolyline, positionAt, resolvedHandles, separatedLanes } from "./position-path";

const SQUARE = 1;
const WIDE = 16 / 9;

function key(atMs: number, x: number, y: number, extra: Partial<PositionKeyframe> = {}): PositionKeyframe {
  return { atMs, x, y, easing: "linear", ...extra };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }, aspect: number): number {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y);
}

describe("a position path", () => {
  it("moves along straight linear keys exactly like separate x and y lanes", () => {
    const keys = [key(0, 0.1, 0.2, { spatial: "linear", easing: "easeInOut" }), key(1000, 0.7, 0.9, { spatial: "linear" })];
    const x: Keyframe[] = [{ atMs: 0, value: 0.1, easing: "easeInOut" }, { atMs: 1000, value: 0.7, easing: "linear" }];
    const y: Keyframe[] = [{ atMs: 0, value: 0.2, easing: "easeInOut" }, { atMs: 1000, value: 0.9, easing: "linear" }];
    for (let ms = -100; ms <= 1100; ms += 37) {
      const point = positionAt(keys, ms, WIDE);
      expect(point.x).toBeCloseTo(valueAt(x, ms), 12);
      expect(point.y).toBeCloseTo(valueAt(y, ms), 12);
    }
  });

  it("passes through every key and holds the ends", () => {
    const keys = [key(0, 0.2, 0.8), key(500, 0.5, 0.2), key(1000, 0.8, 0.8)];
    expect(positionAt(keys, -50, SQUARE)).toEqual({ x: 0.2, y: 0.8 });
    expect(positionAt(keys, 500, SQUARE)).toEqual({ x: 0.5, y: 0.2 });
    expect(positionAt(keys, 2000, SQUARE)).toEqual({ x: 0.8, y: 0.8 });
  });

  it("bends through the middle of auto keys instead of making a corner", () => {
    const keys = [key(0, 0.2, 0.8), key(500, 0.5, 0.2), key(1000, 0.8, 0.8)];
    const handles = resolvedHandles(keys, SQUARE);
    expect(handles[1].out.x).toBeGreaterThan(0);
    expect(handles[1].out.y).toBeCloseTo(0, 9);
    expect(handles[1].in.x).toBeCloseTo(-handles[1].out.x, 9);
    expect(positionAt(keys, 400, SQUARE).y).toBeLessThan(0.2 + 0.6 * 0.2);
  });

  it("travels at constant speed along a curved segment with a linear easing", () => {
    const keys = [key(0, 0.1, 0.5, { spatial: "free", in: { x: 0, y: 0 }, out: { x: 0.2, y: -0.4 } }), key(1000, 0.9, 0.5, { spatial: "free", in: { x: -0.2, y: -0.4 }, out: { x: 0, y: 0 } })];
    const steps = Array.from({ length: 10 }, (_, i) => distance(positionAt(keys, i * 100, WIDE), positionAt(keys, (i + 1) * 100, WIDE), WIDE));
    const mean = steps.reduce((sum, step) => sum + step, 0) / steps.length;
    for (const step of steps) expect(Math.abs(step - mean) / mean).toBeLessThan(0.01);
  });

  it("measures speed in pixels, so the canvas shape changes where the clip is halfway", () => {
    const keys = [key(0, 0.1, 0.1, { spatial: "free", in: { x: 0, y: 0 }, out: { x: 0, y: 0.6 } }), key(1000, 0.9, 0.9, { spatial: "free", in: { x: -0.6, y: 0 }, out: { x: 0, y: 0 } })];
    expect(positionAt(keys, 500, SQUARE)).not.toEqual(positionAt(keys, 500, WIDE));
  });

  it("lets the easing set the speed along the path", () => {
    const keys = [key(0, 0.1, 0.5, { easing: "easeIn", spatial: "linear" }), key(1000, 0.9, 0.5, { spatial: "linear" })];
    expect(positionAt(keys, 500, SQUARE).x).toBeCloseTo(0.1 + 0.8 * ease("easeIn", 0.5), 12);
  });

  it("overshoots along the direction the path arrives from", () => {
    const keys = [key(0, 0.1, 0.5, { easing: "backOut" }), key(500, 0.5, 0.5), key(1000, 0.5, 0.1)];
    const peak = Math.max(...Array.from({ length: 50 }, (_, i) => positionAt(keys, i * 10, SQUARE).x));
    expect(peak).toBeGreaterThan(0.5);
  });

  it("holds still on a hold key and between two equal keys", () => {
    const keys = [key(0, 0.1, 0.5, { easing: "hold" }), key(500, 0.5, 0.5), key(800, 0.5, 0.5), key(1000, 0.9, 0.2)];
    expect(positionAt(keys, 300, SQUARE)).toEqual({ x: 0.1, y: 0.5 });
    for (const ms of [550, 650, 750]) {
      const point = positionAt(keys, ms, SQUARE);
      expect(point.x).toBeCloseTo(0.5, 12);
      expect(point.y).toBeCloseTo(0.5, 12);
    }
  });

  it("keeps stored handles of smooth and free keys", () => {
    const keys = [key(0, 0.2, 0.5), key(500, 0.5, 0.5, { spatial: "smooth", in: { x: -0.1, y: 0.1 }, out: { x: 0.1, y: -0.1 } }), key(1000, 0.8, 0.5)];
    expect(resolvedHandles(keys, WIDE)[1]).toEqual({ in: { x: -0.1, y: 0.1 }, out: { x: 0.1, y: -0.1 } });
  });

  it("draws a polyline that starts and ends on the keys", () => {
    const keys = [key(0, 0.2, 0.8), key(500, 0.5, 0.2), key(1000, 0.8, 0.8)];
    const line = pathPolyline(keys, SQUARE);
    expect(line[0]).toEqual({ x: 0.2, y: 0.8 });
    expect(line.at(-1)).toEqual({ x: 0.8, y: 0.8 });
    expect(line.length).toBeGreaterThan(20);
  });
});

describe("the path heading", () => {
  it("points along the direction of travel in pixels", () => {
    const keys = [key(0, 0.1, 0.1, { spatial: "linear" }), key(1000, 0.9, 0.9, { spatial: "linear" })];
    expect(headingAt(keys, 500, SQUARE)).toBeCloseTo(45, 9);
    expect(headingAt(keys, 500, WIDE)).toBeCloseTo((Math.atan2(0.8, 0.8 * WIDE) * 180) / Math.PI, 9);
  });

  it("keeps the last direction while the clip waits and starts with the first", () => {
    const keys = [key(0, 0.1, 0.5, { spatial: "linear" }), key(500, 0.5, 0.5, { spatial: "linear", easing: "hold" }), key(800, 0.5, 0.5, { spatial: "linear" }), key(1000, 0.5, 0.9, { spatial: "linear" })];
    expect(headingAt(keys, -100, SQUARE)).toBeCloseTo(0, 9);
    expect(headingAt(keys, 650, SQUARE)).toBeCloseTo(0, 9);
    expect(headingAt(keys, 900, SQUARE)).toBeCloseTo(90, 9);
    expect(headingAt(keys, 2000, SQUARE)).toBeCloseTo(90, 9);
  });

  it("follows the curve tangent and never flips on an overshoot", () => {
    const keys = [key(0, 0.1, 0.5, { easing: "backOut", spatial: "linear" }), key(1000, 0.9, 0.5, { spatial: "linear" })];
    for (let ms = 0; ms <= 1000; ms += 25) expect(headingAt(keys, ms, SQUARE)).toBeCloseTo(0, 9);
  });

  it("has no direction for a single key", () => {
    expect(headingAt([key(0, 0.5, 0.5)], 0, SQUARE)).toBeNull();
  });
});

describe("joining and separating dimensions", () => {
  it("joins x and y lanes at the union of their times", () => {
    const x: Keyframe[] = [{ atMs: 0, value: 0.1, easing: "easeOut" }, { atMs: 1000, value: 0.9, easing: "linear" }];
    const y: Keyframe[] = [{ atMs: 0, value: 0.5, easing: "linear" }, { atMs: 500, value: 0.2, easing: "linear" }, { atMs: 1000, value: 0.5, easing: "linear" }];
    const joined = joinedPath(x, y, { x: 0.5, y: 0.5 }, "auto");
    expect(joined.map((k) => k.atMs)).toEqual([0, 500, 1000]);
    expect(joined[1].x).toBeCloseTo(valueAt(x, 500), 12);
    expect(joined[1].y).toBe(0.2);
    expect(joined[0].easing).toBe("easeOut");
    expect(joined.every((k) => k.spatial === "auto")).toBe(true);
  });

  it("fills a missing lane with the still position", () => {
    const x: Keyframe[] = [{ atMs: 0, value: 0.1, easing: "linear" }, { atMs: 1000, value: 0.9, easing: "linear" }];
    expect(joinedPath(x, [], { x: 0.5, y: 0.3 }, "linear").map((k) => k.y)).toEqual([0.3, 0.3]);
  });

  it("separates a straight path exactly", () => {
    const keys = [key(0, 0.1, 0.2, { spatial: "linear", easing: "easeIn" }), key(1000, 0.7, 0.9, { spatial: "linear" })];
    const lanes = separatedLanes(keys, SQUARE);
    expect(lanes.x).toEqual([{ atMs: 0, value: 0.1, easing: "easeIn" }, { atMs: 1000, value: 0.7, easing: "linear" }]);
    expect(lanes.y.map((k) => k.value)).toEqual([0.2, 0.9]);
  });

  it("bakes a curved path into a linear sample on every frame", () => {
    const keys = [key(0, 0.2, 0.8), key(500, 0.5, 0.2), key(1000, 0.8, 0.8)];
    const lanes = separatedLanes(keys, SQUARE);
    const times = lanes.x.map((k) => k.atMs);
    expect(times.slice(1).every((at, i) => at - times[i] <= msOfFrame(1))).toBe(true);
    expect(lanes.x.map((k) => k.atMs)).toContain(500);
    for (const ms of [120, 380, 760]) {
      expect(valueAt(lanes.x, ms)).toBeCloseTo(positionAt(keys, ms, SQUARE).x, 2);
      expect(valueAt(lanes.y, ms)).toBeCloseTo(positionAt(keys, ms, SQUARE).y, 2);
    }
  });
});
