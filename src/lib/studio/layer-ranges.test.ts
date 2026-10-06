import { describe, expect, it } from "vitest";

import { newImageLayer, newShapeLayer, newTextLayer, type Layer } from "./document";
import { clampTo, LAYER_RANGES, normalizedRotation } from "./layer-ranges";
import { layerIssue } from "./validate";

function edges(make: (value: number) => Layer, [lo, hi]: readonly [number, number]) {
  return { lo: layerIssue(make(lo)), hi: layerIssue(make(hi)) };
}

describe("LAYER_RANGES", () => {
  it("only offers values the document validation accepts", () => {
    const text = newTextLayer("Oi");
    const shape = newShapeLayer("rect");
    const image = newImageLayer("m-1");
    const cases = [
      edges((v) => ({ ...shape, transform: { ...shape.transform, x: v, y: v } }), LAYER_RANGES.position),
      edges((v) => ({ ...shape, transform: { ...shape.transform, w: v, h: v } }), LAYER_RANGES.size),
      edges((v) => ({ ...shape, transform: { ...shape.transform, rotation: v } }), LAYER_RANGES.rotation),
      edges((v) => ({ ...shape, transform: { ...shape.transform, opacity: v } }), LAYER_RANGES.opacity),
      edges((v) => ({ ...text, fontSize: v }), LAYER_RANGES.fontSize),
      edges((v) => ({ ...text, lineHeight: v }), LAYER_RANGES.lineHeight),
      edges((v) => ({ ...text, letterSpacing: v }), LAYER_RANGES.letterSpacing),
      edges((v) => ({ ...shape, strokeWidth: v }), LAYER_RANGES.strokeWidth),
      edges((v) => ({ ...shape, radius: v }), LAYER_RANGES.radius),
      edges((v) => ({ ...shape, shadow: { color: "#000000", blur: v, x: 0, y: 0 } }), LAYER_RANGES.shadowBlur),
      edges((v) => ({ ...shape, shadow: { color: "#000000", blur: 0, x: v, y: v } }), LAYER_RANGES.shadowOffset),
      edges((v) => ({ ...image, filters: { brightness: v, contrast: 0, saturation: 0, blur: 0 } }), LAYER_RANGES.brightness),
      edges((v) => ({ ...image, filters: { brightness: 0, contrast: v, saturation: 0, blur: 0 } }), LAYER_RANGES.contrast),
      edges((v) => ({ ...image, filters: { brightness: 0, contrast: 0, saturation: v, blur: 0 } }), LAYER_RANGES.saturation),
      edges((v) => ({ ...image, filters: { brightness: 0, contrast: 0, saturation: 0, blur: v } }), LAYER_RANGES.blur),
      edges((v) => ({ ...image, crop: { x: 0, y: 0, w: v, h: v } }), LAYER_RANGES.cropSide),
    ];
    for (const result of cases) expect(result).toEqual({ lo: null, hi: null });
  });
});

describe("clampTo", () => {
  it("clamps into the range and refuses non finite input", () => {
    expect(clampTo(5, [0, 1])).toBe(1);
    expect(clampTo(-5, [0, 1])).toBe(0);
    expect(clampTo(Number.NaN, [0.5, 1])).toBe(0.5);
  });
});

describe("normalizedRotation", () => {
  it("wraps any angle into the half open range around zero", () => {
    expect(normalizedRotation(370)).toBe(10);
    expect(normalizedRotation(-190)).toBe(170);
    expect(normalizedRotation(180)).toBe(-180);
    expect(normalizedRotation(-360)).toBe(0);
  });
});
