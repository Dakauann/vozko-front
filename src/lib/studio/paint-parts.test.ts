import { describe, expect, it } from "vitest";

import { newIconLayer, newImageLayer, newShapeLayer, newTextLayer, type Layer } from "./document";
import { newEffect, type Paint, type StrokePaint } from "./layer-paint";
import { paintParts, type PaintPart } from "./paint-parts";
import { DEFAULT_PATTERN } from "./pattern";

const solid = (color: string, patch: Partial<Paint> = {}): Paint => ({ type: "solid", color, opacity: 1, ...patch });
const stroke = (align: StrokePaint["align"], patch: Partial<StrokePaint> = {}): StrokePaint => ({ ...solid("#ff0000"), width: 4, align, ...patch });

function masked(part: PaintPart | undefined): Extract<PaintPart, { kind: "masked" }> {
  if (!part || part.kind !== "masked") throw new Error("expected a masked part");
  return part;
}

function content(part: PaintPart | undefined): Extract<PaintPart, { kind: "content" }> {
  if (!part || part.kind !== "content") throw new Error("expected a content part");
  return part;
}

describe("paint parts", () => {
  it("draws solid and gradient fills of shapes directly, each with its opacity and blend", () => {
    const shape: Layer = { ...newShapeLayer("rect"), fill: undefined, shadow: { color: "#000000", blur: 2, x: 0, y: 0 }, fills: [solid("#111111"), { type: "gradient", gradient: { from: "#000000", to: "#ffffff", angle: 0 }, opacity: 0.5, blendMode: "multiply" }] };
    const parts = paintParts(shape);
    expect(parts.map((p) => p.key)).toEqual(["fill-0", "fill-1"]);
    expect(content(parts[0]).layer).toMatchObject({ fill: "#111111", strokeWidth: 0 });
    expect(content(parts[0]).layer.shadow).toBeUndefined();
    expect(content(parts[0]).layer.fills).toBeUndefined();
    expect(content(parts[1])).toMatchObject({ opacity: 0.5, blend: "multiply" });
    expect(content(parts[1]).layer.gradient).toEqual({ from: "#000000", to: "#ffffff", angle: 0 });
  });

  it("paints patterns through the layer's own silhouette", () => {
    const shape: Layer = { ...newShapeLayer("ellipse"), fill: "#ffffff", pattern: { ...DEFAULT_PATTERN, opacity: 0.4, blendMode: "screen" } };
    const [base, pattern] = paintParts(shape);
    expect(content(base).layer.fill).toBe("#ffffff");
    const part = masked(pattern);
    expect(part).toMatchObject({ opacity: 0.4, blend: "screen", reach: 0 });
    expect(part.paint.type).toBe("pattern");
    expect(part.mask).toHaveLength(1);
    expect(part.mask[0]).toMatchObject({ composite: "source-over", layer: { fill: "#000000" } });
    expect(part.mask[0].layer.pattern).toBeUndefined();
  });

  it("builds each stroke alignment from the outline and the silhouette", () => {
    const text: Layer = { ...newTextLayer("Oi"), strokes: [stroke("center", { dashArray: [2, 1], dashOffset: 1 }), stroke("inside"), stroke("outside")] };
    const [, center, inside, outside] = paintParts(text);
    expect(masked(center).mask).toEqual([{ composite: "source-over", layer: expect.objectContaining({ stroke: "#000000", strokeWidth: 4, dashArray: [2, 1], dashOffset: 1, fill: undefined }) }]);
    expect(masked(center).reach).toBe(2);
    expect(masked(inside).mask.map((m) => m.composite)).toEqual(["source-over", "destination-in"]);
    expect(masked(inside).mask[0].layer).toMatchObject({ strokeWidth: 8 });
    expect(masked(outside).mask.map((m) => m.composite)).toEqual(["source-over", "destination-out"]);
    expect(masked(outside).mask[1].layer).toMatchObject({ fill: "#000000", strokeWidth: 0 });
    expect(masked(outside).reach).toBe(4);
  });

  it("keeps dash lengths when an inside or outside outline is drawn twice as wide", () => {
    const shape: Layer = { ...newShapeLayer("rect"), strokes: [stroke("outside", { dashArray: [4, 2], dashOffset: 2 })] };
    expect(masked(paintParts(shape)[1]).mask[0].layer).toMatchObject({ strokeWidth: 8, dashArray: [2, 1], dashOffset: 1 });
  });

  it("puts the text highlight under every fill", () => {
    const text: Layer = { ...newTextLayer("Oi"), highlight: { color: "#ffee00", radius: 0.2 }, pattern: DEFAULT_PATTERN };
    const parts = paintParts(text);
    expect(parts[0].key).toBe("highlight");
    expect(content(parts[0]).layer).toMatchObject({ highlight: { color: "#ffee00", radius: 0.2 }, fill: undefined });
    expect(content(parts[1]).layer.highlight).toBeUndefined();
  });

  it("tints icons directly with solid paints and masks every other paint", () => {
    const icon: Layer = { ...newIconLayer("star"), fill: undefined, fills: [solid("#123456"), { type: "gradient", gradient: { from: "#000000", to: "#ffffff", angle: 0 }, opacity: 1 }] };
    const [tint, gradient] = paintParts(icon);
    expect(content(tint).layer.fill).toBe("#123456");
    expect(masked(gradient).mask[0].layer.fill).toBe("#000000");
  });

  it("draws a picture once and leaves outlines and effects to the pixel stage", () => {
    const photo: Layer = { ...newImageLayer("m"), strokeWidth: 3, stroke: "#000000", filters: { brightness: 0.2, contrast: 0, saturation: 0, blur: 0 }, effects: [newEffect("drop-shadow", "a")] };
    const parts = paintParts(photo);
    expect(parts).toHaveLength(1);
    expect(content(parts[0]).layer).toMatchObject({ strokeWidth: 3, assetId: "m" });
    expect(content(parts[0]).layer.filters).toBeUndefined();
    expect(content(parts[0]).layer.effects).toBeUndefined();
  });
});
