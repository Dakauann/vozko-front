import { describe, expect, it } from "vitest";

import { newImageLayer, type Layer } from "./document";
import { applyCropBox, clampCropBox, cropFrame } from "./crop";

const canvas = { width: 1000, height: 500 };

function image(extra: Partial<Layer> = {}, rotation = 0): Layer {
  return { ...newImageLayer("m-1", { x: 0.5, y: 0.5, w: 0.2, h: 0.4, rotation, opacity: 1 }), ...extra };
}

function expectSameLayer(actual: Pick<Layer, "transform" | "crop">, expected: Layer) {
  for (const key of ["x", "y", "w", "h", "rotation"] as const) expect(actual.transform[key]).toBeCloseTo(expected.transform[key]);
  if (!expected.crop) {
    expect(actual.crop).toBeUndefined();
    return;
  }
  for (const key of ["x", "y", "w", "h"] as const) expect(actual.crop?.[key]).toBeCloseTo(expected.crop[key]);
}

describe("cropFrame", () => {
  it("is the layer box itself when nothing is cropped", () => {
    const frame = cropFrame(image(), canvas);
    expect(frame.width).toBeCloseTo(200);
    expect(frame.height).toBeCloseTo(200);
    expect(frame.center).toEqual({ x: 500, y: 250 });
    expect(frame.box).toEqual({ left: 0, top: 0, width: 200, height: 200 });
  });

  it("grows to the whole image and places the box where the crop sits", () => {
    const frame = cropFrame(image({ crop: { x: 0.5, y: 0, w: 0.5, h: 0.5 } }), canvas);
    expect(frame.width).toBeCloseTo(400);
    expect(frame.height).toBeCloseTo(400);
    expect(frame.box.left).toBeCloseTo(200);
    expect(frame.box.top).toBeCloseTo(0);
    expect(frame.center.x).toBeCloseTo(400);
    expect(frame.center.y).toBeCloseTo(350);
  });

  it("mirrors the box for flipped images", () => {
    const frame = cropFrame(image({ crop: { x: 0.5, y: 0, w: 0.5, h: 0.5 }, flipX: true }), canvas);
    expect(frame.box.left).toBeCloseTo(0);
    expect(frame.center.x).toBeCloseTo(600);
  });
});

describe("applyCropBox", () => {
  it("round trips the frame back to the same layer", () => {
    const cases = [
      image(),
      image({ crop: { x: 0.25, y: 0.1, w: 0.5, h: 0.6 } }),
      image({ crop: { x: 0.25, y: 0.1, w: 0.5, h: 0.6 }, flipX: true, flipY: true }),
      image({ crop: { x: 0.3, y: 0.2, w: 0.4, h: 0.5 } }, 37),
    ];
    for (const layer of cases) {
      const frame = cropFrame(layer, canvas);
      expectSameLayer(applyCropBox(layer, frame, frame.box, canvas), layer);
    }
  });

  it("crops the right half and moves the center to it", () => {
    const layer = image();
    const frame = cropFrame(layer, canvas);
    const next = applyCropBox(layer, frame, { left: 100, top: 0, width: 100, height: 200 }, canvas);
    expect(next.crop).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 });
    expect(next.transform.x).toBeCloseTo(0.55);
    expect(next.transform.w).toBeCloseTo(0.1);
    expect(next.transform.h).toBeCloseTo(0.4);
  });

  it("keeps the crop inside the image and above the minimum size", () => {
    const layer = image();
    const frame = cropFrame(layer, canvas);
    const next = applyCropBox(layer, frame, { left: -50, top: 150, width: 500, height: 0 }, canvas);
    expect(next.crop?.x).toBe(0);
    expect(next.crop?.w).toBe(1);
    expect(next.crop?.h).toBeCloseTo(0.01);
    expect((next.crop?.y ?? 0) + (next.crop?.h ?? 0)).toBeLessThanOrEqual(1);
  });

  it("records a crop of a flipped image in source coordinates", () => {
    const layer = image({ flipX: true });
    const frame = cropFrame(layer, canvas);
    const next = applyCropBox(layer, frame, { left: 0, top: 0, width: 50, height: 200 }, canvas);
    expect(next.crop?.x).toBeCloseTo(0.75);
    expect(next.crop?.w).toBeCloseTo(0.25);
  });
});

describe("clampCropBox", () => {
  it("keeps a dragged box inside the frame without shrinking it", () => {
    expect(clampCropBox({ left: 150, top: -20, width: 100, height: 100 }, { width: 200, height: 200 })).toEqual({ left: 100, top: 0, width: 100, height: 100 });
  });
});
