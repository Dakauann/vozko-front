import { describe, expect, it } from "vitest";

import { emptyArtboard, IMAGE_DOCUMENT_VERSION, IMAGE_SCHEMA, newImageLayer, newTextLayer, type Artboard, type ImageDocument, type Layer } from "../document";
import { newPaintLayer } from "../pixel-surface";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { applyImageOperation, IMAGE_ID_FIELDS, type ImageOpContext, type ImageOperation } from "./image-ops";
import { imageOutline } from "./outline";

const CANVAS = { width: 1000, height: 500 };

function doc(): ImageDocument {
  const main: Artboard = {
    ...emptyArtboard(CANVAS),
    id: "main",
    layers: [
      { ...newImageLayer("photo", { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 }), id: "photo" },
      { ...newPaintLayer(CANVAS), id: "ink" },
      { ...newTextLayer("Oi"), id: "title" },
      { ...newPaintLayer(CANVAS), id: "held", locked: true },
    ],
  };
  return { schema: IMAGE_SCHEMA, version: IMAGE_DOCUMENT_VERSION, artboards: [main] };
}

const ctx = { naturalSize: () => ({ width: 1000, height: 500 }), icons: [], activeArtboard: "main" } as ImageOpContext;

function run(ops: ImageOperation[]) {
  return planBatch(doc(), ops, (d, op) => applyImageOperation(d, op, ctx), IMAGE_ID_FIELDS);
}

function done(ops: ImageOperation[]) {
  const plan = run(ops);
  if (!plan.ok) throw new Error(`${plan.op}: ${plan.reason}`);
  expect(documentIssue("image", plan.final)).toBeNull();
  return plan;
}

function layer(d: ImageDocument, id: string): Layer {
  return d.artboards[0].layers.find((l) => l.id === id)!;
}

function refusal(op: ImageOperation): string {
  const plan = run([op]);
  return plan.ok ? "" : plan.reason;
}

const RECT = { shape: "rect" as const, x: 0.25, y: 0.5, w: 0.2, h: 0.4 };

describe("pixel operations for Elo", () => {
  it("adds a paint layer the size of the artboard", () => {
    const plan = done([{ op: "add_paint_layer", ref: "p", name: "Assinatura" }]);
    expect(layer(plan.final, plan.created.p[0])).toMatchObject({ type: "paint", name: "Assinatura", surface: { width: 1000, height: 500, ops: [] } });
  });

  it("fills and erases areas of a paint layer", () => {
    const plan = done([
      { op: "paint_area", layer_id: "ink", action: "fill", area: RECT, paint_color: "#ff0000", paint_opacity: 0.5 },
      { op: "paint_area", layer_id: "ink", action: "erase", area: { shape: "ellipse", x: 0.25, y: 0.5, w: 0.1, h: 0.1, feather: 8 } },
    ]);
    const ops = layer(plan.final, "ink").surface!.ops;
    expect(ops[0]).toMatchObject({ kind: "area", mode: "paint", color: "#ff0000", opacity: 0.5, parts: [{ points: [150, 150, 350, 150, 350, 350, 150, 350] }] });
    expect(ops[1]).toMatchObject({ kind: "area", mode: "erase", feather: 8 });
  });

  it("hides and reveals parts of a photo without losing pixels", () => {
    const plan = done([
      { op: "paint_area", layer_id: "photo", action: "hide", area: { ...RECT, invert: true } },
      { op: "paint_area", layer_id: "photo", action: "reveal", area: { shape: "polygon", points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.1 }, { x: 0.15, y: 0.3 }] } },
      { op: "paint_area", layer_id: "photo", action: "erase", area: RECT },
    ]);
    const mask = layer(plan.final, "photo").mask!;
    expect(mask.ops.map((op) => [op.mode, op.kind === "area" ? Boolean(op.invert) : null])).toEqual([
      ["hide", true],
      ["reveal", false],
      ["hide", false],
    ]);
  });

  it("fills a new paint layer when asked to fill a photo", () => {
    const plan = done([{ op: "paint_area", ref: "f", layer_id: "photo", action: "fill", area: RECT, paint_color: "#00ff00" }]);
    const created = layer(plan.final, plan.created.f[0]);
    expect(created.type).toBe("paint");
    expect(created.surface!.ops).toHaveLength(1);
  });

  it("crops to an area and copies an area to a new layer", () => {
    const cropped = done([{ op: "crop_to_area", layer_id: "photo", area: RECT }]);
    expect(layer(cropped.final, "photo").crop).toEqual({ x: 0.15, y: 0.3, w: 0.2, h: 0.4 });
    const copied = done([{ op: "copy_area_to_layer", ref: "c", layer_id: "ink", area: RECT }]);
    expect(layer(copied.final, copied.created.c[0]).surface!.ops[0]).toMatchObject({ mode: "erase", invert: true });
  });

  it("removes a mask with clear", () => {
    const plan = done([
      { op: "paint_area", layer_id: "photo", action: "hide", area: RECT },
      { op: "update_layer", layer_id: "photo", clear: ["mask"] },
    ]);
    expect(layer(plan.final, "photo").mask).toBeUndefined();
  });

  it("explains each refusal in words", () => {
    expect(refusal({ op: "paint_area", layer_id: "ink", action: "fill", paint_color: "#ff0000" })).toContain("area");
    expect(refusal({ op: "paint_area", layer_id: "ink", action: "fill", area: RECT })).toContain("paint_color");
    expect(refusal({ op: "paint_area", layer_id: "ink", action: "hide", area: RECT })).toContain("fotos");
    expect(refusal({ op: "paint_area", layer_id: "title", action: "erase", area: RECT })).toContain("add_paint_layer");
    expect(refusal({ op: "paint_area", layer_id: "held", action: "erase", area: RECT })).toContain("travada");
    expect(refusal({ op: "paint_area", layer_id: "ink", action: "smudge", area: RECT })).toContain("action");
    expect(refusal({ op: "paint_area", layer_id: "ink", action: "erase", area: { shape: "polygon", points: [{ x: 0, y: 0 }] } })).toContain("3");
    expect(refusal({ op: "paint_area", layer_id: "ink", action: "erase", area: { ...RECT, feather: 300 } })).toContain("feather");
    expect(refusal({ op: "paint_area", layer_id: "ink", action: "erase", area: { shape: "rect", x: 3, y: 3, w: 0.1, h: 0.1 } })).toContain("não cobre");
  });

  it("reads back pixels in the outline", () => {
    const plan = done([{ op: "paint_area", layer_id: "ink", action: "fill", area: RECT, paint_color: "#ff0000" }, { op: "paint_area", layer_id: "photo", action: "hide", area: RECT }]);
    const outline = imageOutline(plan.final, { detail: "summary", asset: () => undefined, playheadMs: 0, selection: [], jobs: [], activeArtboard: "main" });
    const layers = outline.artboards[0].layers;
    expect(layers.find((l) => l.id === "ink")).toMatchObject({ type: "paint", pixels: { width: 1000, height: 500, strokes: 0, areas: 1, painted: { x: 0.25, y: 0.5, w: 0.2, h: 0.4 } } });
    expect(layers.find((l) => l.id === "photo")).toMatchObject({ mask: { strokes: 0, areas: 1 } });
  });
});
