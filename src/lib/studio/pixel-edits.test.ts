import { describe, expect, it } from "vitest";

import { emptyArtboard, newImageLayer, newTextLayer, type ImageSurface, type Layer } from "./document";
import { addPaintLayer, appendPixelOp, clearMask, copySelectionToLayer, cropToSelection, paintSelection } from "./pixel-edits";
import { rectPoints, type PixelSelection } from "./pixel-selection";
import { newPaintLayer, type StrokeOp } from "./pixel-surface";
import { surfaceIssue } from "./validate";

const CANVAS = { width: 400, height: 200 };

function board(layers: Layer[]): ImageSurface {
  return { ...emptyArtboard(CANVAS), layers };
}

function selection(patch: Partial<PixelSelection> = {}): PixelSelection {
  return { artboardId: "a", parts: [{ mode: "add", points: rectPoints({ x: 100, y: 50 }, { x: 200, y: 150 }) }], feather: 0, invert: false, ...patch };
}

const paint = (): Layer => ({ ...newPaintLayer(CANVAS), id: "ink" });
const photo = (): Layer => ({ ...newImageLayer("asset", { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 }), id: "photo" });
const STROKE: StrokeOp = { kind: "stroke", id: "s1", mode: "hide", size: 10, hardness: 0.5, opacity: 1, points: [5, 5] };

describe("pixel edits", () => {
  it("adds a paint layer above the anchor", () => {
    const result = addPaintLayer(board([photo(), { ...newTextLayer("oi"), id: "t" }]), { aboveId: "photo", name: "Pintura" });
    expect(result.document.layers.map((l) => l.id)).toEqual(["photo", result.id, "t"]);
    expect(result.document.layers[1]).toMatchObject({ type: "paint", name: "Pintura", surface: { width: 400, height: 200, ops: [] } });
  });

  it("creates the mask of a photo with its first operation", () => {
    const doc = appendPixelOp(board([photo()]), "photo", "mask", STROKE, CANVAS);
    expect(doc.layers[0].mask).toEqual({ width: 400, height: 200, ops: [STROKE] });
    expect(surfaceIssue(doc)).toBeNull();
    expect(appendPixelOp(board([{ ...photo(), locked: true }]), "photo", "mask", STROKE, CANVAS).layers[0].mask).toBeUndefined();
  });

  it("fills, erases, hides and reveals a selection", () => {
    const filled = paintSelection(board([paint()]), "ink", selection(), "fill", { color: "#ff0000", opacity: 1 }, CANVAS);
    expect(filled.ok && filled.document.layers[0].surface!.ops[0]).toMatchObject({ kind: "area", mode: "paint", color: "#ff0000" });
    const erased = paintSelection(board([paint()]), "ink", selection(), "erase", { opacity: 0.5 }, CANVAS);
    expect(erased.ok && erased.document.layers[0].surface!.ops[0]).toMatchObject({ mode: "erase", opacity: 0.5 });
    const hidden = paintSelection(board([photo()]), "photo", selection(), "erase", { opacity: 1 }, CANVAS);
    expect(hidden.ok && hidden.document.layers[0].mask!.ops[0]).toMatchObject({ mode: "hide" });
    const revealed = paintSelection(board([photo()]), "photo", selection(), "reveal", { opacity: 1 }, CANVAS);
    expect(revealed.ok && revealed.document.layers[0].mask!.ops[0]).toMatchObject({ mode: "reveal" });
  });

  it("fills a new paint layer when the target cannot hold paint", () => {
    const result = paintSelection(board([photo()]), "photo", selection(), "fill", { color: "#00ff00", opacity: 1 }, CANVAS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBeDefined();
    expect(result.document.layers.map((l) => l.type)).toEqual(["image", "paint"]);
    expect(result.document.layers[1].surface!.ops).toHaveLength(1);
  });

  it("refuses what does not fit the layer", () => {
    expect(paintSelection(board([paint()]), "ink", selection(), "hide", { opacity: 1 }, CANVAS)).toEqual({ ok: false, issue: "not_image" });
    expect(paintSelection(board([{ ...newTextLayer("oi"), id: "t" }]), "t", selection(), "erase", { opacity: 1 }, CANVAS)).toEqual({ ok: false, issue: "no_pixels" });
    expect(paintSelection(board([paint()]), "nope", selection(), "erase", { opacity: 1 }, CANVAS)).toEqual({ ok: false, issue: "missing" });
    expect(paintSelection(board([{ ...paint(), locked: true }]), "ink", selection(), "erase", { opacity: 1 }, CANVAS)).toEqual({ ok: false, issue: "locked" });
    expect(paintSelection(board([paint()]), "ink", selection({ parts: [] }), "erase", { opacity: 1 }, CANVAS)).toEqual({ ok: false, issue: "empty" });
    expect(paintSelection(board([paint()]), "ink", selection(), "fill", { opacity: 1 }, CANVAS)).toEqual({ ok: false, issue: "color" });
  });

  it("crops a photo to the selection and keeps its mask on the same pixels", () => {
    const masked = { ...photo(), mask: { width: 400, height: 200, ops: [STROKE] } };
    const result = cropToSelection(board([masked]), "photo", selection(), CANVAS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const layer = result.document.layers[0];
    expect(layer.crop).toEqual({ x: 0.25, y: 0.25, w: 0.25, h: 0.5 });
    expect(layer.transform).toMatchObject({ x: 0.375, y: 0.5, w: 0.25, h: 0.5 });
    expect(layer.mask).toBe(masked.mask);
  });

  it("crops a paint surface and shifts its strokes", () => {
    const stroke: StrokeOp = { kind: "stroke", id: "a", mode: "paint", color: "#000000", size: 4, hardness: 1, opacity: 1, points: [150, 100] };
    const far: StrokeOp = { ...stroke, id: "b", points: [10, 10] };
    const layer = { ...paint(), surface: { width: 400, height: 200, ops: [stroke, far] } };
    const result = cropToSelection(board([layer]), "ink", selection(), CANVAS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cropped = result.document.layers[0];
    expect(cropped.surface).toEqual({ width: 100, height: 100, ops: [{ ...stroke, points: [50, 50] }] });
    expect(cropped.transform).toMatchObject({ x: 0.375, y: 0.5, w: 0.25, h: 0.5 });
  });

  it("copies the selection to a new layer that hides everything else", () => {
    const result = copySelectionToLayer(board([photo()]), "photo", selection(), CANVAS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const copy = result.document.layers.find((l) => l.id === result.created)!;
    expect(result.document.layers).toHaveLength(2);
    expect(copy.mask!.ops[0]).toMatchObject({ kind: "area", mode: "hide", invert: true });
    expect(copy.transform).toEqual(photo().transform);
    const painted = copySelectionToLayer(board([paint()]), "ink", selection(), CANVAS);
    expect(painted.ok && painted.document.layers[1].surface!.ops[0]).toMatchObject({ mode: "erase", invert: true });
  });

  it("removes a mask", () => {
    const doc = clearMask(board([{ ...photo(), mask: { width: 4, height: 4, ops: [] } }]), "photo");
    expect(doc.layers[0].mask).toBeUndefined();
  });
});
