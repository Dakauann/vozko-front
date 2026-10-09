import { describe, expect, it } from "vitest";

import { emptyArtboard, newShapeLayer, type Layer } from "./document";
import { cachePixelRatioFor, clipRuns, compositeOf, curvePath, framePolygon, gradientLine, gradientPaint, gradientStops, starPolygon, strokeStyle } from "./paint";

describe("gradientPaint", () => {
  const box = { x: -100, y: -50, width: 200, height: 100 };

  it("keeps the linear line and two stops when nothing else is set", () => {
    expect(gradientPaint({ from: "#000000", to: "#ffffff", angle: 0 }, box)).toEqual({
      kind: "linear",
      start: { x: -100, y: 0 },
      end: { x: 100, y: 0 },
      stops: [0, "#000000", 1, "#ffffff"],
    });
  });

  it("places a radial center inside the box and reaches the far edge at radius one", () => {
    expect(gradientPaint({ kind: "radial", from: "#ffffff", to: "#000000", angle: 0, cx: 0.5, cy: 0.25, radius: 1 }, box)).toEqual({
      kind: "radial",
      center: { x: 0, y: -25 },
      radius: 100,
      stops: [0, "#ffffff", 1, "#000000"],
    });
  });

  it("puts a middle color halfway", () => {
    expect(gradientStops({ from: "#111111", via: "#ff8800", to: "#eeeeee", angle: 0 })).toEqual([0, "#111111", 0.5, "#ff8800", 1, "#eeeeee"]);
  });
});

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

describe("starPolygon", () => {
  it("draws any number of points with the inner radius as a share of the tip", () => {
    const burst = starPolygon({ points: 16, inner: 0.8 }, 200, 100);
    expect(burst).toHaveLength(64);
    expect([burst[0], burst[1]]).toEqual([100, 0]);
    const firstValley = Math.hypot((burst[2] - 100) / 100, (burst[3] - 50) / 50);
    expect(firstValley).toBeCloseTo(0.8);
  });

  it("falls back to the classic five point star", () => {
    expect(starPolygon({}, 100, 100)).toEqual(framePolygon("star", 100, 100));
  });
});

describe("clipRuns", () => {
  function rect(id: string, extra: Partial<Layer> = {}): Layer {
    return { ...newShapeLayer("rect"), id, ...extra };
  }

  it("binds clipped layers to the nearest unclipped layer below", () => {
    const doc = { ...emptyArtboard({ width: 10, height: 10 }), layers: [rect("a", { clip: true }), rect("b"), rect("c", { clip: true }), rect("d", { clip: true }), rect("e")] };
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

describe("strokeStyle", () => {
  it("keeps the round look of older documents and scales dashes by the stroke width", () => {
    expect(strokeStyle({ type: "shape", shape: "path", strokeWidth: 4 })).toEqual({ lineCap: "round", lineJoin: "round", miterLimit: 10, dash: undefined, dashOffset: 0 });
    expect(strokeStyle({ type: "shape", shape: "rect", strokeWidth: 4 })).toMatchObject({ lineCap: "butt", lineJoin: "miter" });
    expect(strokeStyle({ type: "text", strokeWidth: 4 })).toMatchObject({ lineJoin: "miter" });
    expect(strokeStyle({ type: "shape", shape: "rect", strokeWidth: 4, dash: true })).toMatchObject({ dash: [12, 8] });
    expect(strokeStyle({ type: "shape", shape: "rect", strokeWidth: 4, lineCap: "butt", lineJoin: "miter", miterLimit: 6, dashArray: [2, 1], dashOffset: 0.5 })).toEqual({ lineCap: "butt", lineJoin: "miter", miterLimit: 6, dash: [8, 4], dashOffset: 2 });
    expect(strokeStyle({ type: "shape", shape: "rect", strokeWidth: 0, dashArray: [2, 1] }).dash).toBeUndefined();
  });
});
