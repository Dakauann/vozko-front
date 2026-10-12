import { describe, expect, it } from "vitest";

import { newImageLayer, type Layer } from "./document";
import { pixelFrame } from "./pixel-space";
import { newPaintLayer } from "./pixel-surface";
import { combineSelection, ellipsePoints, invertSelection, rectPoints, selectionArea, selectionBounds, type PixelSelection } from "./pixel-selection";

const CANVAS = { width: 400, height: 200 };

function selection(patch: Partial<PixelSelection> = {}): PixelSelection {
  return { artboardId: "a", parts: [{ mode: "add", points: rectPoints({ x: 10, y: 20 }, { x: 110, y: 70 }) }], feather: 0, invert: false, ...patch };
}

describe("selection shapes", () => {
  it("builds rectangles from any two corners", () => {
    expect(rectPoints({ x: 50, y: 40 }, { x: 10, y: 20 })).toEqual([10, 20, 50, 20, 50, 40, 10, 40]);
  });

  it("builds ellipses as polygons inside their box", () => {
    const points = ellipsePoints({ x: 0, y: 0 }, { x: 100, y: 50 });
    expect(points.length / 2).toBeGreaterThanOrEqual(24);
    const xs = points.filter((_, i) => i % 2 === 0);
    expect(Math.min(...xs)).toBeCloseTo(0, 6);
    expect(Math.max(...xs)).toBeCloseTo(100, 6);
  });

  it("adds with Shift, subtracts with Alt and replaces otherwise", () => {
    const first = combineSelection(null, "a", rectPoints({ x: 0, y: 0 }, { x: 10, y: 10 }), "replace");
    const added = combineSelection(first, "a", rectPoints({ x: 20, y: 0 }, { x: 30, y: 10 }), "add");
    expect(added.parts.map((p) => p.mode)).toEqual(["add", "add"]);
    const cut = combineSelection(added, "a", rectPoints({ x: 5, y: 0 }, { x: 25, y: 10 }), "subtract");
    expect(cut.parts.map((p) => p.mode)).toEqual(["add", "add", "subtract"]);
    expect(combineSelection(cut, "a", rectPoints({ x: 0, y: 0 }, { x: 1, y: 1 }), "replace").parts).toHaveLength(1);
    expect(combineSelection(cut, "b", rectPoints({ x: 0, y: 0 }, { x: 1, y: 1 }), "add").parts).toHaveLength(1);
    expect(invertSelection(first).invert).toBe(true);
  });

  it("measures its bounds on the artboard", () => {
    expect(selectionBounds(selection(), CANVAS)).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    expect(selectionBounds(selection({ invert: true }), CANVAS)).toEqual({ x: 0, y: 0, width: 400, height: 200 });
    expect(selectionBounds(selection({ parts: [{ mode: "add", points: rectPoints({ x: -50, y: -50 }, { x: -10, y: -10 }) }] }), CANVAS)).toBeNull();
  });
});

describe("selection to area", () => {
  it("converts to surface pixels of a paint layer", () => {
    const layer = { ...newPaintLayer(CANVAS), surface: { width: 800, height: 400, ops: [] } };
    const area = selectionArea(selection({ feather: 5 }), pixelFrame(layer, CANVAS, "paint")!, { mode: "erase", opacity: 0.5 }, "op1")!;
    expect(area).toEqual({ kind: "area", id: "op1", mode: "erase", opacity: 0.5, feather: 10, parts: [{ points: [20, 40, 220, 40, 220, 140, 20, 140] }] });
  });

  it("clips shapes that run far past the surface", () => {
    const layer = newPaintLayer(CANVAS);
    const area = selectionArea(selection({ parts: [{ mode: "add", points: rectPoints({ x: -9000, y: 10 }, { x: 50, y: 30 }) }] }), pixelFrame(layer, CANVAS, "paint")!, { mode: "paint", color: "#ff0000", opacity: 1 }, "op")!;
    expect(Math.min(...area.parts[0].points.filter((_, i) => i % 2 === 0))).toBeGreaterThanOrEqual(-4);
  });

  it("maps onto the mask of a cropped photo", () => {
    const photo: Layer = { ...newImageLayer("x", { x: 0.5, y: 0.5, w: 0.5, h: 1, rotation: 0, opacity: 1 }), crop: { x: 0.5, y: 0, w: 0.5, h: 1 } };
    const area = selectionArea(selection(), pixelFrame(photo, CANVAS, "mask")!, { mode: "hide", opacity: 1 }, "m")!;
    expect(area.parts[0].points.slice(0, 2)).toEqual([110, 20]);
  });

  it("keeps an inverted selection even when nothing is added", () => {
    const layer = newPaintLayer(CANVAS);
    const frame = pixelFrame(layer, CANVAS, "paint")!;
    expect(selectionArea(selection({ parts: [] }), frame, { mode: "erase", opacity: 1 }, "x")).toBeNull();
    expect(selectionArea(selection({ parts: [], invert: true }), frame, { mode: "erase", opacity: 1 }, "x")).toMatchObject({ parts: [{ points: [0, 0, 400, 0, 400, 200, 0, 200] }] });
    expect(selectionArea(selection({ parts: [{ mode: "subtract", points: rectPoints({ x: 0, y: 0 }, { x: 5, y: 5 }) }, ...selection().parts] }), frame, { mode: "erase", opacity: 1 }, "x")!.parts).toHaveLength(1);
  });
});
