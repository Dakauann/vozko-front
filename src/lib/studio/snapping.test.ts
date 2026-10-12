import { describe, expect, it } from "vitest";

import { emptyArtboard, newShapeLayer, type Layer } from "./document";
import { boundsTargets, frameTargets, measureGaps, mergeTargets, snapMove, snapTargets } from "./snapping";

const canvas = { width: 1000, height: 1000 };

function layer(id: string, x: number, y: number, w: number, h: number, extra: Partial<Layer> = {}): Layer {
  return { ...newShapeLayer("rect", { x, y, w, h, rotation: 0, opacity: 1 }), id, ...extra };
}

describe("snapTargets", () => {
  it("collects canvas edges and center plus the edges and centers of other visible layers", () => {
    const doc = { ...emptyArtboard(canvas), layers: [layer("a", 0.2, 0.3, 0.2, 0.2), layer("b", 0.8, 0.8, 0.1, 0.1, { hidden: true }), layer("m", 0.5, 0.5, 0.1, 0.1)] };
    const targets = snapTargets(doc, ["m"]);
    expect(targets.x).toEqual([0, 500, 1000, 100, 200, 300]);
    expect(targets.y).toEqual([0, 500, 1000, 200, 300, 400]);
  });
});

describe("snapMove", () => {
  const targets = { x: [0, 500, 1000], y: [0, 500, 1000] };

  it("pulls the moving box onto the nearest line within the threshold and reports the guide", () => {
    const result = snapMove({ left: 397, top: 100, right: 597, bottom: 200 }, targets, 5);
    expect(result.dx).toBe(3);
    expect(result.dy).toBe(0);
    expect(result.guides.vertical).toEqual([500]);
    expect(result.guides.horizontal).toEqual([]);
  });

  it("snaps edges as well as centers on both axes", () => {
    const result = snapMove({ left: 2, top: 896, right: 102, bottom: 998 }, targets, 5);
    expect(result.dx).toBe(-2);
    expect(result.dy).toBe(2);
    expect(result.guides.vertical).toEqual([0]);
    expect(result.guides.horizontal).toEqual([1000]);
  });

  it("leaves the box alone when nothing is close", () => {
    const result = snapMove({ left: 120, top: 120, right: 220, bottom: 220 }, targets, 5);
    expect(result).toEqual({ dx: 0, dy: 0, guides: { vertical: [], horizontal: [] } });
  });

  it("reports every target line that the snapped box touches", () => {
    const result = snapMove({ left: 1, top: 300, right: 501, bottom: 400 }, { x: [0, 500], y: [] }, 5);
    expect(result.dx).toBe(-1);
    expect(result.guides.vertical).toEqual([0, 500]);
  });
});

describe("frameTargets and boundsTargets", () => {
  it("offer the frame edges and center, then the edges and centers of each box", () => {
    expect(frameTargets({ width: 100, height: 200 })).toEqual({ x: [0, 50, 100], y: [0, 100, 200] });
    expect(boundsTargets([{ left: 10, top: 20, right: 30, bottom: 60 }])).toEqual({ x: [10, 20, 30], y: [20, 40, 60] });
    expect(mergeTargets({ x: [1], y: [2] }, { x: [3], y: [] })).toEqual({ x: [1, 3], y: [2] });
  });
});

describe("measureGaps", () => {
  const frame = { left: 0, top: 0, right: 1000, bottom: 1000 };
  const moving = { left: 400, top: 400, right: 500, bottom: 500 };

  it("measures to the nearest box on each side that faces the moving box", () => {
    const others = [
      { left: 100, top: 420, right: 300, bottom: 480 },
      { left: 0, top: 450, right: 350, bottom: 460 },
      { left: 600, top: 0, right: 700, bottom: 100 },
      { left: 420, top: 700, right: 480, bottom: 800 },
    ];
    expect(measureGaps(moving, others, frame)).toEqual([
      { axis: "horizontal", from: 350, to: 400, at: 455 },
      { axis: "horizontal", from: 500, to: 1000, at: 450 },
      { axis: "vertical", from: 0, to: 400, at: 450 },
      { axis: "vertical", from: 500, to: 700, at: 450 },
    ]);
  });

  it("skips sides that touch or leave the frame", () => {
    const gaps = measureGaps({ left: -20, top: 0, right: 80, bottom: 100 }, [], frame);
    expect(gaps).toEqual([
      { axis: "horizontal", from: 80, to: 1000, at: 50 },
      { axis: "vertical", from: 100, to: 1000, at: 30 },
    ]);
  });
});
