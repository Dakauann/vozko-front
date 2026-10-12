import { describe, expect, it } from "vitest";

import { isValidPath } from "../vector-path";
import { apply, boundsOf, compose, ellipseBezier, mapBezier, placementAffine, rectBezier, reversed, starBezier, strokeScale, unitPath } from "./lottie-geometry";

describe("Lottie geometry", () => {
  it("draws a rectangle from its top right corner, clockwise, and reverses on request", () => {
    const rect = rectBezier({ x: 100, y: 100 }, { x: 80, y: 60 }, 0, false);
    expect(rect.points).toEqual([{ x: 140, y: 70 }, { x: 140, y: 130 }, { x: 60, y: 130 }, { x: 60, y: 70 }]);
    expect(rect.closed).toBe(true);
    expect(reversed(rect).points).toEqual([{ x: 140, y: 70 }, { x: 60, y: 70 }, { x: 60, y: 130 }, { x: 140, y: 130 }]);
  });

  it("rounds rectangle corners with eight points like the reference player", () => {
    const rect = rectBezier({ x: 0, y: 0 }, { x: 100, y: 100 }, 10, false);
    expect(rect.points).toHaveLength(8);
    expect(rect.points[0]).toEqual({ x: 50, y: -40 });
    expect(rect.ins[0].y).toBeCloseTo(-50 + 10 * (1 - 0.5519), 6);
  });

  it("starts an ellipse at the top and a polygon at twelve o'clock", () => {
    const ellipse = ellipseBezier({ x: 0, y: 0 }, { x: 40, y: 20 }, false);
    expect(ellipse.points[0]).toEqual({ x: 0, y: -10 });
    expect(ellipse.points[1]).toEqual({ x: 20, y: 0 });
    expect(ellipse.outs[0].x).toBeCloseTo(20 * 0.5519, 6);
    const pentagon = starBezier({ center: { x: 0, y: 0 }, points: 5, outer: 10, inner: 0, rotation: 0, polygon: true, reversed: false });
    expect(pentagon.points).toHaveLength(5);
    expect(pentagon.points[0].x).toBeCloseTo(0, 9);
    expect(pentagon.points[0].y).toBeCloseTo(-10, 9);
    expect(starBezier({ center: { x: 0, y: 0 }, points: 4, outer: 10, inner: 5, rotation: 0, polygon: false, reversed: false }).points).toHaveLength(8);
  });

  it("composes anchor, position, scale and rotation like a layer transform", () => {
    const m = placementAffine({ x: 10, y: 0 }, { x: 100, y: 100 }, { x: 2, y: 2 }, 90);
    const moved = apply(m, { x: 20, y: 0 });
    expect(moved.x).toBeCloseTo(100, 9);
    expect(moved.y).toBeCloseTo(120, 9);
    expect(strokeScale(m)).toBeCloseTo(2, 9);
    const both = compose(placementAffine({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 1, y: 1 }, 0), m);
    expect(apply(both, { x: 20, y: 0 }).x).toBeCloseTo(105, 9);
  });

  it("writes a valid unit box path, straight where it can and curved when asked", () => {
    const rect = rectBezier({ x: 100, y: 100 }, { x: 80, y: 60 }, 0, false);
    const box = boundsOf([rect])!;
    expect(box).toEqual({ x: 60, y: 70, w: 80, h: 60 });
    expect(unitPath([rect], box, false)).toBe("M1 0 L1 1 L0 1 L0 0 Z");
    const curved = unitPath([rect], box, true);
    expect(curved.startsWith("M1 0 C1 0 1 1 1 1")).toBe(true);
    expect(isValidPath(curved)).toBe(true);
    expect(unitPath([mapBezier(rect, placementAffine({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }, 0))], box, false)).toBe("M1 0 L1 1 L0 1 L0 0 Z");
  });
});
