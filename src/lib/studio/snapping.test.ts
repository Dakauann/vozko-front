import { describe, expect, it } from "vitest";

import { emptyImageDocument, newShapeLayer, type Layer } from "./document";
import { snapMove, snapTargets } from "./snapping";

const canvas = { width: 1000, height: 1000 };

function layer(id: string, x: number, y: number, w: number, h: number, extra: Partial<Layer> = {}): Layer {
  return { ...newShapeLayer("rect", { x, y, w, h, rotation: 0, opacity: 1 }), id, ...extra };
}

describe("snapTargets", () => {
  it("collects canvas edges and center plus the edges and centers of other visible layers", () => {
    const doc = { ...emptyImageDocument(canvas), layers: [layer("a", 0.2, 0.3, 0.2, 0.2), layer("b", 0.8, 0.8, 0.1, 0.1, { hidden: true }), layer("m", 0.5, 0.5, 0.1, 0.1)] };
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
