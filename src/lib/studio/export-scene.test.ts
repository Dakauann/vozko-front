import { describe, expect, it } from "vitest";

import { emptyArtboard, newImageLayer, newShapeLayer, newTextLayer, type Artboard, type Layer, type Transform } from "./document";
import { alphaBounds, exportScene, isOpaque, layerVectors, patchRatio, rasterLayerCount, type RasterItem, type VectorItem } from "./export-scene";
import { pathBounds } from "./path-nodes";
import { repeatLayers } from "./repeat-edits";

const canvas = { width: 1000, height: 500 };
const centered: Transform = { x: 0.5, y: 0.5, w: 0.2, h: 0.4, rotation: 0, opacity: 1 };

function board(layers: Layer[], background = "#ffffff"): Artboard {
  return { ...emptyArtboard(canvas, background), layers };
}

function shape(patch: Partial<Layer> = {}): Layer {
  return { ...newShapeLayer("rect", centered), id: "s", fill: "#ff000080", ...patch };
}

describe("export scene background", () => {
  it("paints the artboard colour or gradient, and leaves a clear artboard clear only when asked", () => {
    expect(exportScene(board([], "#123456"), { transparent: true }).background).toEqual({ kind: "solid", color: "#123456", alpha: 1 });
    expect(exportScene(board([], ""), { transparent: true }).background).toBeNull();
    expect(exportScene(board([], ""), { transparent: false }).background).toEqual({ kind: "solid", color: "#ffffff", alpha: 1 });
    const gradient = { ...board([]), canvas: { ...canvas, background: "", gradient: { from: "#000000", to: "#ffffff80", angle: 0 } } };
    expect(exportScene(gradient, { transparent: true }).background).toEqual({
      kind: "linear",
      from: { x: 0, y: 250 },
      to: { x: 1000, y: 250 },
      stops: [
        { offset: 0, color: "#000000", alpha: 1 },
        { offset: 1, color: "#ffffff", alpha: 128 / 255 },
      ],
    });
  });
});

describe("vector layers", () => {
  it("keeps a filled and stroked shape as a vector in artboard pixels", () => {
    const scene = exportScene(board([shape({ stroke: "#111111", strokeWidth: 4, dash: true, blendMode: "multiply", transform: { ...centered, opacity: 0.5 } })]), { transparent: true });
    expect(scene.items).toHaveLength(1);
    const item = scene.items[0] as VectorItem;
    expect(item.kind).toBe("vector");
    expect(pathBounds(item.subpaths)).toEqual({ left: 400, top: 150, right: 600, bottom: 350 });
    expect(item.fill).toEqual({ kind: "solid", color: "#ff0000", alpha: 128 / 255 });
    expect(item.stroke).toEqual({ color: "#111111", alpha: 1, width: 4, cap: "butt", join: "miter", miterLimit: 10, dash: [12, 8], dashOffset: 0 });
    expect(item).toMatchObject({ fillRule: "nonzero", opacity: 0.5, blend: "multiply" });
  });

  it("turns a gradient with the layer, as the canvas draws it", () => {
    const rotated = shape({ fill: undefined, gradient: { from: "#000000", to: "#ffffff", angle: 0 }, transform: { ...centered, w: 0.2, h: 0.2, rotation: 90 } });
    const fill = (exportScene(board([rotated]), { transparent: true }).items[0] as VectorItem).fill;
    expect(fill).toMatchObject({ kind: "linear" });
    if (fill?.kind !== "linear") return;
    expect(fill.from.x).toBeCloseTo(500);
    expect(fill.from.y).toBeCloseTo(150);
    expect(fill.to.x).toBeCloseTo(500);
    expect(fill.to.y).toBeCloseTo(350);
    const radial = shape({ fill: undefined, gradient: { from: "#000000", to: "#ffffff", angle: 0, kind: "radial", cx: 0.5, cy: 0.5, radius: 1 } });
    expect((exportScene(board([radial]), { transparent: true }).items[0] as VectorItem).fill).toMatchObject({ kind: "radial", center: { x: 500, y: 250 }, radius: 100 });
  });

  it("adds the arrowheads of an open path as filled triangles in the line colour", () => {
    const arrow: Layer = { id: "a", type: "shape", shape: "path", path: "M0 0.5 L1 0.5", stroke: "#222222", strokeWidth: 4, arrowEnd: true, transform: centered };
    const items = layerVectors(arrow, canvas)!;
    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({ fill: { kind: "solid", color: "#222222", alpha: 1 }, stroke: null });
    expect(pathBounds(items[1].subpaths)).toEqual({ left: 600, top: 244, right: 612, bottom: 256 });
  });

  it("draws a plain line as a stroke and leaves a line with pointers to the raster", () => {
    const line = { ...newShapeLayer("line", centered), id: "l", arrowEnd: false };
    const items = layerVectors(line, canvas)!;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ fill: null, stroke: { color: "#111111", width: 8, cap: "round" } });
    expect(exportScene(board([{ ...newShapeLayer("arrow", centered), id: "ar" }]), { transparent: true }).items[0].kind).toBe("raster");
  });
});

describe("raster patches", () => {
  it("rasterizes text, images and effects, and keeps each patch inside the artboard", () => {
    const layers = [{ ...newTextLayer("Oi", "body", centered), id: "t" }, { ...newImageLayer("asset", centered), id: "i" }, shape({ id: "sh", shadow: { color: "#000000", blur: 10, x: 4, y: 4 } })];
    const items = exportScene(board(layers), { transparent: true }).items as RasterItem[];
    expect(items.map((item) => [item.kind, item.layerIds])).toEqual([
      ["raster", ["t"]],
      ["raster", ["i"]],
      ["raster", ["sh"]],
    ]);
    for (const item of items) {
      expect(item.bounds.x).toBeGreaterThanOrEqual(0);
      expect(item.bounds.y).toBeGreaterThanOrEqual(0);
      expect(item.bounds.x + item.bounds.width).toBeLessThanOrEqual(1000);
      expect(item.bounds.y + item.bounds.height).toBeLessThanOrEqual(500);
      expect(item.bounds.x).toBeLessThanOrEqual(400);
      expect(item.bounds.x + item.bounds.width).toBeGreaterThanOrEqual(600);
    }
  });

  it("keeps a text with styled parts in a patch around its own box", () => {
    const rich = { ...newTextLayer("Oi gente", "body", centered), id: "t", runs: [{ start: 0, end: 2, fill: "#ff0000", fontWeight: 800 }] };
    const item = exportScene(board([rich]), { transparent: true }).items[0] as RasterItem;
    expect(item.layerIds).toEqual(["t"]);
    expect(item.bounds.width).toBeLessThan(1000);
  });

  it("rasterizes the whole artboard for a layer property the vector writer does not know", () => {
    const unknown = { ...shape(), glow: { color: "#ffffff", blur: 20 } } as unknown as Layer;
    const item = exportScene(board([unknown]), { transparent: true }).items[0] as RasterItem;
    expect(item).toMatchObject({ kind: "raster", layerIds: ["s"], bounds: { x: 0, y: 0, width: 1000, height: 500 } });
  });

  it("keeps a clipping run together in one patch with the base blend", () => {
    const base = shape({ id: "base", blendMode: "screen" });
    const clipped = { ...newImageLayer("a", centered), id: "photo", clip: true };
    const items = exportScene(board([base, clipped, shape({ id: "after" })]), { transparent: true }).items;
    expect(items.map((item) => item.kind)).toEqual(["raster", "vector"]);
    expect(items[0]).toMatchObject({ layerIds: ["base", "photo"], blend: "screen" });
  });

  it("leaves out a layer that sits wholly outside the artboard, as the image export does", () => {
    const away = { ...newTextLayer("Longe", "body", { ...centered, x: 5, y: 5 }), id: "away" };
    expect(exportScene(board([away]), { transparent: true }).items).toEqual([]);
  });

  it("skips hidden layers and counts the layers that become pixels", () => {
    const scene = exportScene(board([shape({ id: "gone", hidden: true }), { ...newTextLayer("A", "body", centered), id: "t" }, shape({ id: "v" })]), { transparent: true });
    expect(scene.items.map((item) => item.kind)).toEqual(["raster", "vector"]);
    expect(rasterLayerCount(scene)).toBe(1);
  });
});

describe("patch pixels", () => {
  it("finds the visible part of a patch and whether it is fully opaque", () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    data.set([1, 2, 3, 200], (1 * 4 + 2) * 4);
    data.set([1, 2, 3, 255], (2 * 4 + 1) * 4);
    expect(alphaBounds(data, 4, 4)).toEqual({ x: 1, y: 1, width: 2, height: 2 });
    expect(alphaBounds(new Uint8ClampedArray(16), 2, 2)).toBeNull();
    expect(isOpaque(data)).toBe(false);
    expect(isOpaque(new Uint8ClampedArray([0, 0, 0, 255, 9, 9, 9, 255]))).toBe(true);
  });

  it("lowers the patch resolution only when a patch would pass the canvas limits", () => {
    expect(patchRatio({ x: 0, y: 0, width: 1000, height: 500 }, 3.125)).toBe(3.125);
    expect(patchRatio({ x: 0, y: 0, width: 4096, height: 4096 }, 3.125)).toBeCloseTo(1);
    expect(patchRatio({ x: 0, y: 0, width: 4000, height: 100 }, 3.125)).toBeCloseTo(2.048);
  });
});

describe("repeat copies", () => {
  it("exports every copy of a repeated group, not only the source", () => {
    const source = shape({ fill: "#ff0000" });
    const repeated = repeatLayers(board([source]), [source.id], { mode: "grid", rows: 1, columns: 3, gapX: 0.05, gapY: 0 }).document as Artboard;
    expect(exportScene(board([source]), { transparent: true }).items).toHaveLength(1);
    expect(exportScene(repeated, { transparent: true }).items).toHaveLength(3);
  });
});


describe("blend modes the vector writers cannot composite", () => {
  it("flattens the whole artboard with its background into one patch when a layer adds light", () => {
    const glow = shape({ id: "glow", blendMode: "add" });
    const scene = exportScene(board([shape({ id: "under" }), glow]), { transparent: false });
    expect(scene.background).toBeNull();
    expect(scene.items).toEqual([{ kind: "raster", id: "r0", layerIds: ["under", "glow"], bounds: { x: 0, y: 0, width: canvas.width, height: canvas.height }, blend: "normal", backdrop: { background: "#ffffff" } }]);
    expect(exportScene(board([glow], ""), { transparent: true }).items[0]).toMatchObject({ backdrop: {} });
    expect(layerVectors(glow, canvas)).toBeNull();
  });

  it("keeps vectors for the modes PDF and SVG write", () => {
    const scene = exportScene(board([shape({ id: "s", blendMode: "multiply" })]), { transparent: false });
    expect(scene.items.map((item) => [item.kind, item.blend])).toEqual([["vector", "multiply"]]);
  });
});
