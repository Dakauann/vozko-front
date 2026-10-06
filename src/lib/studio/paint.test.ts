import { describe, expect, it } from "vitest";

import { emptyImageDocument, newShapeLayer, type Layer } from "./document";
import { cachePixelRatioFor, clipRuns, compositeOf, curvePath, framePolygon, gradientLine } from "./paint";

describe("gradientLine", () => {
  it("runs left to right through the box center at zero degrees", () => {
    expect(gradientLine(0, { x: 0, y: 0, width: 200, height: 100 })).toEqual({ start: { x: 0, y: 50 }, end: { x: 200, y: 50 } });
  });

  it("runs top to bottom at ninety degrees, reaching the corners on the diagonal", () => {
    const vertical = gradientLine(90, { x: 0, y: 0, width: 200, height: 100 });
    expect(vertical.start.x).toBeCloseTo(100);
    expect(vertical.start.y).toBeCloseTo(0);
    expect(vertical.end.y).toBeCloseTo(100);
    const diagonal = gradientLine(45, { x: -50, y: -50, width: 100, height: 100 });
    expect(diagonal.start.x).toBeCloseTo(-50);
    expect(diagonal.end.y).toBeCloseTo(50);
  });
});

describe("compositeOf", () => {
  it("maps normal to the default canvas operation and keeps the others", () => {
    expect(compositeOf(undefined)).toBe("source-over");
    expect(compositeOf("normal")).toBe("source-over");
    expect(compositeOf("multiply")).toBe("multiply");
    expect(compositeOf("color-dodge")).toBe("color-dodge");
  });
});

describe("curvePath", () => {
  it("draws a flat line when there is no curve", () => {
    expect(curvePath(200, 100, 0)).toBe("M 0 50 L 200 50");
  });

  it("arches up for a positive curve and down for a negative one", () => {
    expect(curvePath(200, 100, 1)).toBe("M 0 100 A 100 100 0 0 1 200 100");
    expect(curvePath(200, 100, -1)).toBe("M 0 0 A 100 100 0 0 0 200 0");
  });
});

describe("framePolygon", () => {
  it("outlines a triangle and a five point star inside the box", () => {
    expect(framePolygon("triangle", 100, 50)).toEqual([50, 0, 100, 50, 0, 50]);
    const star = framePolygon("star", 100, 100);
    expect(star).toHaveLength(20);
    expect(star[0]).toBeCloseTo(50);
    expect(star[1]).toBeCloseTo(0);
  });
});

describe("clipRuns", () => {
  function rect(id: string, extra: Partial<Layer> = {}): Layer {
    return { ...newShapeLayer("rect"), id, ...extra };
  }

  it("binds clipped layers to the nearest unclipped layer below", () => {
    const doc = { ...emptyImageDocument({ width: 10, height: 10 }), layers: [rect("a", { clip: true }), rect("b"), rect("c", { clip: true }), rect("d", { clip: true }), rect("e")] };
    expect(clipRuns(doc.layers).map((run) => run.map((l) => l.id))).toEqual([["a"], ["b", "c", "d"], ["e"]]);
  });
});

describe("cachePixelRatioFor", () => {
  it("follows the zoom in quarter steps, capped so caches stay small", () => {
    expect(cachePixelRatioFor(0.5, 1)).toBe(0.5);
    expect(cachePixelRatioFor(0.62, 2)).toBe(1.25);
    expect(cachePixelRatioFor(4, 2)).toBe(2);
    expect(cachePixelRatioFor(0.01, 1)).toBe(0.25);
  });
});
