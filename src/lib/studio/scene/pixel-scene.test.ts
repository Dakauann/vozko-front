import { describe, expect, it } from "vitest";

import { emptyArtboard, newImageLayer, type ImageSurface, type Layer } from "../document";
import { newPaintLayer, type StrokeOp } from "../pixel-surface";
import { imageScene } from "./image-scene";

const CANVAS = { width: 1000, height: 800 };
const none = { hidden: new Set<string>(), overrides: new Map() };

function art(layers: Layer[]): ImageSurface {
  return { ...emptyArtboard(CANVAS, "#ffffff"), layers };
}

const LIVE: StrokeOp = { kind: "stroke", id: "live", mode: "paint", color: "#000000", size: 8, hardness: 1, opacity: 1, points: [1, 2] };

describe("pixels in the image scene", () => {
  it("draws a paint layer straight from its surface over its box", () => {
    const layer: Layer = { ...newPaintLayer(CANVAS, { x: 0.25, y: 0.5, w: 0.5, h: 0.5, rotation: 10, opacity: 0.7 }), id: "ink", flipX: true, blendMode: "multiply" };
    const node = imageScene(art([layer]), none).nodes[0];
    expect(node).toMatchObject({ id: "ink", fit: "fill", opacity: 0.7, flipX: true, blend: "multiply", box: { x: 250, y: 400, width: 500, height: 400, rotation: 10 } });
    expect(node.source).toEqual({ kind: "pixels", key: "ink:paint", surface: layer.surface, live: null });
  });

  it("follows live transforms and the live stroke of that layer only", () => {
    const layer: Layer = { ...newPaintLayer(CANVAS), id: "ink" };
    const scene = imageScene(art([layer]), { ...none, overrides: new Map([["ink", { ...layer.transform, w: 0.5 }]]), live: { layerId: "ink", kind: "paint", op: LIVE } });
    expect(scene.nodes[0].box.width).toBe(500);
    expect(scene.nodes[0].source).toMatchObject({ live: LIVE });
    expect(imageScene(art([layer]), { ...none, live: { layerId: "other", kind: "paint", op: LIVE } }).nodes[0].source).toMatchObject({ live: null });
  });

  it("keeps the photo raster unchanged by mask strokes and places the mask over the uncropped photo", () => {
    const photo: Layer = { ...newImageLayer("asset", { x: 0.5, y: 0.5, w: 0.4, h: 0.5, rotation: 0, opacity: 1 }), id: "p", crop: { x: 0.5, y: 0, w: 0.5, h: 1 } };
    const plain = imageScene(art([photo]), none).nodes[0];
    const masked = imageScene(art([{ ...photo, mask: { width: 800, height: 400, ops: [{ ...LIVE, mode: "hide", color: undefined }] } }]), none).nodes[0];
    expect(masked.source).toEqual(plain.source);
    const raster = plain.source.kind === "raster" ? plain.source : null;
    const pad = (raster!.widthPx - 400) / 2;
    expect(masked.pixelMask).toMatchObject({ source: { kind: "pixels", key: "p:mask" }, flipX: false, flipY: false });
    expect(masked.pixelMask!.rect.x).toBeCloseTo((pad - 400) / raster!.widthPx, 9);
    expect(masked.pixelMask!.rect.width).toBeCloseTo(800 / raster!.widthPx, 9);
    expect(plain.pixelMask).toBeUndefined();
  });
});
