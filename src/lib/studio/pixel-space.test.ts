import { describe, expect, it } from "vitest";

import { newImageLayer, type Layer } from "./document";
import { newPaintLayer } from "./pixel-surface";
import { fromSurface, maskPlacement, pixelFrame, surfaceScale, toSurface } from "./pixel-space";

const CANVAS = { width: 1000, height: 800 };

describe("pixel space", () => {
  it("maps artboard pixels onto a full frame paint surface one to one", () => {
    const frame = pixelFrame(newPaintLayer(CANVAS), CANVAS, "paint")!;
    expect(toSurface(frame, { x: 120, y: 340 })).toEqual({ x: 120, y: 340 });
    expect(surfaceScale(frame)).toBe(1);
  });

  it("follows rotation, scale and flips of a paint layer", () => {
    const layer: Layer = { ...newPaintLayer(CANVAS, { x: 0.5, y: 0.5, w: 0.2, h: 0.25, rotation: 90, opacity: 1 }), flipX: true };
    const frame = pixelFrame({ ...layer, surface: { width: 400, height: 400, ops: [] } }, CANVAS, "paint")!;
    const corner = toSurface(frame, { x: 600, y: 300 });
    expect(corner.x).toBeCloseTo(400, 6);
    expect(corner.y).toBeCloseTo(0, 6);
    const back = fromSurface(frame, corner);
    expect(back.x).toBeCloseTo(600, 6);
    expect(back.y).toBeCloseTo(300, 6);
    expect(surfaceScale(frame)).toBeCloseTo(2, 6);
  });

  it("places a mask over the whole uncropped photo", () => {
    const photo: Layer = { ...newImageLayer("asset", { x: 0.5, y: 0.5, w: 0.4, h: 0.5, rotation: 0, opacity: 1 }), crop: { x: 0.5, y: 0, w: 0.5, h: 1 } };
    const frame = pixelFrame(photo, CANVAS, "mask")!;
    expect(frame.surface).toEqual({ width: 800, height: 400 });
    expect(toSurface(frame, { x: 300, y: 200 })).toEqual({ x: 400, y: 0 });
    expect(maskPlacement(photo, 400, 400)).toEqual({ x: -400, y: 0, width: 800, height: 400, flipX: false, flipY: false });
    expect(maskPlacement({ ...photo, flipX: true }, 400, 400)).toEqual({ x: 0, y: 0, width: 800, height: 400, flipX: true, flipY: false });
  });

  it("keeps the existing mask grid when a photo already has one", () => {
    const photo: Layer = { ...newImageLayer("asset", { x: 0.5, y: 0.5, w: 0.4, h: 0.5, rotation: 0, opacity: 1 }), mask: { width: 100, height: 50, ops: [] } };
    const frame = pixelFrame(photo, CANVAS, "mask")!;
    expect(toSurface(frame, { x: 700, y: 600 })).toEqual({ x: 100, y: 50 });
  });

  it("has no pixel frame for layers without pixels", () => {
    expect(pixelFrame({ ...newImageLayer("asset") }, CANVAS, "paint")).toBeNull();
    expect(pixelFrame(newPaintLayer(CANVAS), CANVAS, "mask")).toBeNull();
  });
});
