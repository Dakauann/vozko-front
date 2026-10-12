import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { emptyArtboard, emptyVideoDocument, imageDocument, newImageLayer, newOverlayClip, newTextLayer, type Layer } from "./document";
import {
  maskSurfaceSize,
  newPaintLayer,
  paintedBounds,
  pixelSurfaceIssue,
  surfaceSizeFor,
  type AreaOp,
  type PixelSurface,
  type StrokeOp,
} from "./pixel-surface";
import { documentIssue, layerIssue } from "./validate";

function stroke(patch: Partial<StrokeOp> = {}): StrokeOp {
  return { kind: "stroke", id: "s1", mode: "paint", color: "#e4572e", size: 24, hardness: 0.8, opacity: 1, points: [10, 10, 40, 30], ...patch };
}

function area(patch: Partial<AreaOp> = {}): AreaOp {
  return { kind: "area", id: "a1", mode: "erase", opacity: 1, feather: 0, parts: [{ points: [0, 0, 50, 0, 50, 50] }], ...patch };
}

function surface(ops: PixelSurface["ops"], size = 100): PixelSurface {
  return { width: size, height: size, ops };
}

describe("pixel surfaces", () => {
  it("accepts strokes and areas with their own fields", () => {
    expect(pixelSurfaceIssue(surface([stroke(), stroke({ id: "s2", mode: "erase", color: undefined, pressure: true, points: [1, 2, 0.5, 3, 4, 1] }), area()]), "paint")).toBeNull();
    expect(pixelSurfaceIssue(surface([stroke({ mode: "hide", color: undefined }), area({ mode: "reveal", invert: true, feather: 250, parts: [{ points: [0, 0, 9, 0, 9, 9] }, { mode: "subtract", points: [1, 1, 2, 1, 2, 2] }] })]), "mask")).toBeNull();
  });

  it("accepts any number of operations", () => {
    const many = Array.from({ length: 3000 }, (_, i) => stroke({ id: `s${i}`, points: [i % 100, 5] }));
    expect(pixelSurfaceIssue(surface(many), "paint")).toBeNull();
  });

  it.each<[string, PixelSurface, "paint" | "mask"]>([
    ["a surface wider than 4096", surface([], 4097), "paint"],
    ["an empty surface side", { width: 0, height: 10, ops: [] }, "paint"],
    ["a fractional side", { width: 10.5, height: 10, ops: [] }, "paint"],
    ["an unknown kind", surface([{ ...stroke(), kind: "smudge" as StrokeOp["kind"] }]), "paint"],
    ["a mask mode on paint", surface([stroke({ mode: "hide", color: undefined })]), "paint"],
    ["a paint mode on a mask", surface([stroke({ mode: "paint" })]), "mask"],
    ["paint without a color", surface([stroke({ color: undefined })]), "paint"],
    ["a color on an erase", surface([stroke({ mode: "erase" })]), "paint"],
    ["a color with alpha", surface([stroke({ color: "#e4572e80" })]), "paint"],
    ["a brush of zero", surface([stroke({ size: 0 })]), "paint"],
    ["a brush past 1000", surface([stroke({ size: 1001 })]), "paint"],
    ["a hardness past 1", surface([stroke({ hardness: 1.5 })]), "paint"],
    ["a zero opacity", surface([stroke({ opacity: 0 })]), "paint"],
    ["an odd point list", surface([stroke({ points: [1, 2, 3] })]), "paint"],
    ["a pressure list off stride", surface([stroke({ pressure: true, points: [1, 2, 0.5, 3] })]), "paint"],
    ["pressure past 1", surface([stroke({ pressure: true, points: [1, 2, 1.5] })]), "paint"],
    ["no points", surface([stroke({ points: [] })]), "paint"],
    ["a point far outside", surface([stroke({ points: [1, 9000] })]), "paint"],
    ["a non finite point", surface([stroke({ points: [1, Number.NaN] })]), "paint"],
    ["area fields on a stroke", surface([{ ...stroke(), feather: 4 } as StrokeOp]), "paint"],
    ["stroke fields on an area", surface([{ ...area(), size: 4 } as AreaOp]), "paint"],
    ["an area without parts", surface([area({ parts: [] })]), "paint"],
    ["an area starting with a subtraction", surface([area({ parts: [{ mode: "subtract", points: [0, 0, 5, 0, 5, 5] }] })]), "paint"],
    ["a part with two points", surface([area({ parts: [{ points: [0, 0, 5, 0] }] })]), "paint"],
    ["an unknown part mode", surface([area({ parts: [{ points: [0, 0, 5, 0, 5, 5] }, { mode: "add" as "subtract", points: [0, 0, 5, 0, 5, 5] }] })]), "paint"],
    ["a feather past 250", surface([area({ feather: 251 })]), "paint"],
    ["a bad op id", surface([stroke({ id: "Bad Id" })]), "paint"],
    ["a repeated op id", surface([stroke(), stroke()]), "paint"],
  ])("refuses %s", (_, value, kind) => {
    expect(pixelSurfaceIssue(value, kind)).not.toBeNull();
  });
});

describe("paint layers and masks in the document", () => {
  const canvas = { width: 1000, height: 800 };

  it("creates a paint layer whose surface pixels are artboard pixels", () => {
    const layer = newPaintLayer(canvas);
    expect(layer).toMatchObject({ type: "paint", transform: { x: 0.5, y: 0.5, w: 1, h: 1 }, surface: { width: 1000, height: 800, ops: [] } });
    expect(layerIssue(layer)).toBeNull();
  });

  it("keeps surfaces within 4096 pixels on the long side", () => {
    expect(surfaceSizeFor(8192, 2048)).toEqual({ width: 4096, height: 1024 });
    expect(surfaceSizeFor(0.2, 50)).toEqual({ width: 1, height: 50 });
  });

  it("sizes a mask over the whole uncropped photo", () => {
    const photo: Layer = { ...newImageLayer("asset", { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, opacity: 1 }), crop: { x: 0.25, y: 0, w: 0.5, h: 1 } };
    expect(maskSurfaceSize(photo, canvas)).toEqual({ width: 1000, height: 400 });
  });

  it("refuses a paint layer that carries fields of other layers", () => {
    const layer = newPaintLayer(canvas);
    expect(layerIssue({ ...layer, fill: "#ffffff" })).toBe("invalid");
    expect(layerIssue({ ...layer, assetId: "x" })).toBe("invalid");
    expect(layerIssue({ ...layer, effects: [{ id: "e", type: "drop-shadow" }] } as Layer)).toBe("invalid");
    expect(layerIssue({ ...layer, surface: undefined })).toBe("required");
    expect(layerIssue({ ...layer, blendMode: "multiply", flipX: true, clip: true, name: "Tinta", hidden: true, locked: true })).toBeNull();
  });

  it("allows a mask only on photos and a surface only on paint layers", () => {
    const mask: PixelSurface = surface([stroke({ mode: "hide", color: undefined })]);
    expect(layerIssue({ ...newImageLayer("asset"), mask })).toBeNull();
    expect(layerIssue({ ...newTextLayer("oi"), mask })).toBe("invalid");
    expect(layerIssue({ ...newImageLayer("asset"), mask: surface([stroke()]) })).not.toBeNull();
    expect(layerIssue({ ...newTextLayer("oi"), surface: surface([]) })).toBe("invalid");
  });

  it("refuses paint layers and masks on video overlays", () => {
    const doc = emptyVideoDocument("square");
    doc.durationMs = 1000;
    doc.tracks[0].clips = [newOverlayClip(newPaintLayer({ width: 1080, height: 1080 }), 0, 1000)];
    expect(documentIssue("video", doc)).not.toBeNull();
    doc.tracks[0].clips = [newOverlayClip({ ...newImageLayer("asset"), mask: surface([]) }, 0, 1000)];
    expect(documentIssue("video", doc)).not.toBeNull();
  });

  it("validates painted documents end to end", () => {
    const paint = { ...newPaintLayer(canvas), surface: surface([stroke()], 1000) };
    const doc = imageDocument([{ ...emptyArtboard(canvas), layers: [paint] }]);
    expect(documentIssue("image", doc)).toBeNull();
    expect(documentIssue("image", imageDocument([{ ...emptyArtboard(canvas), layers: [{ ...paint, surface: surface([stroke({ size: 0 })]) }] }]))).not.toBeNull();
    expect(documentIssue("image", JSON.parse(JSON.stringify({ ...doc, artboards: [{ ...doc.artboards[0], layers: [{ ...paint, surface: { ...paint.surface, extra: 1 } }] }] })))).not.toBeNull();
  });

  it("measures the painted part of a surface", () => {
    expect(paintedBounds(surface([]))).toBeNull();
    expect(paintedBounds(surface([stroke({ size: 10, points: [20, 30, 40, 50] })]))).toEqual({ x: 15, y: 25, width: 30, height: 30 });
    expect(paintedBounds(surface([stroke({ mode: "erase", color: undefined })]))).toBeNull();
    expect(paintedBounds(surface([area({ mode: "paint", color: "#000000", invert: true })]))).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });
});

describe("the pixel contract shared with the backend", () => {
  it("accepts the fixture the backend accepts", () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_pixels.json"), "utf8"));
    expect(documentIssue("image", raw)).toBeNull();
  });
});
