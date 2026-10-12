import { describe, expect, it } from "vitest";

import { emptyArtboard, newIconLayer, newImageLayer, newShapeLayer, newTextLayer, type Layer } from "./document";
import { resizeCanvas } from "./layers";
import { paintsProperty } from "./paint";
import { DEFAULT_PATTERN } from "./pattern";
import {
  effectPlan,
  strokeLook,
  withStrokeLook,
  fillPaints,
  layerEffects,
  newEffect,
  paintReach,
  paintsRichly,
  scaledPaint,
  strokePaints,
  type Effect,
  type Paint,
  type StrokePaint,
} from "./layer-paint";

const solid = (color: string, patch: Partial<Paint> = {}): Paint => ({ type: "solid", color, opacity: 1, ...patch });
const outline = (color: string, width: number, align: StrokePaint["align"], patch: Partial<StrokePaint> = {}): StrokePaint => ({ ...solid(color), width, align, ...patch });
const effect = (type: Effect["type"], patch: Partial<Effect> = {}): Effect => ({ ...newEffect(type, "fx"), ...patch });

describe("layer paints", () => {
  it("reads the single legacy fill, gradient and pattern as a paint stack", () => {
    const shape = { ...newShapeLayer("rect"), fill: "#ff0000", pattern: { ...DEFAULT_PATTERN, opacity: 0.5, blendMode: "multiply" as const } };
    expect(fillPaints(shape)).toEqual([solid("#ff0000"), { type: "pattern", pattern: shape.pattern, opacity: 0.5, blendMode: "multiply" }]);
    const gradient = { from: "#000000", to: "#ffffff", angle: 0 };
    expect(fillPaints({ ...newTextLayer("Oi"), gradient })).toEqual([{ type: "gradient", gradient, opacity: 1 }]);
    expect(fillPaints(newIconLayer("star", ""))).toEqual([solid("#000000")]);
    expect(fillPaints(newShapeLayer("line"))).toEqual([]);
    expect(fillPaints(newImageLayer("m"))).toEqual([]);
  });

  it("uses the fill list when there is one and skips hidden paints", () => {
    const shape: Layer = { ...newShapeLayer("ellipse"), fill: undefined, fills: [solid("#111111"), solid("#222222", { hidden: true }), solid("#333333", { opacity: 0.3 })] };
    expect(fillPaints(shape).map((p) => p.color)).toEqual(["#111111", "#333333"]);
  });

  it("reads the legacy outline as one stroke, with the text outline outside the letters", () => {
    expect(strokePaints({ ...newShapeLayer("rect"), stroke: "#000000", strokeWidth: 6 })).toEqual([outline("#000000", 6, "center")]);
    expect(strokePaints({ ...newTextLayer("Oi"), stroke: "#000000", strokeWidth: 6 })).toEqual([outline("#000000", 3, "outside")]);
    expect(strokePaints({ ...newShapeLayer("rect"), stroke: "#000000", strokeWidth: 0 })).toEqual([]);
    const listed: Layer = { ...newTextLayer("Oi"), strokes: [outline("#ff0000", 4, "outside"), outline("#00ff00", 9, "inside", { hidden: true })] };
    expect(strokePaints(listed)).toEqual([outline("#ff0000", 4, "outside")]);
  });

  it("reads the legacy shadow as a drop shadow that shows behind", () => {
    const shadowed = { ...newShapeLayer("rect"), shadow: { color: "#00000066", blur: 12, x: 0, y: 6 } };
    expect(layerEffects(shadowed)).toEqual([{ id: "shadow", type: "drop-shadow", color: "#00000066", opacity: 1, x: 0, y: 6, blur: 12, spread: 0, showBehind: true }]);
    expect(layerEffects({ ...shadowed, shadow: undefined, effects: [effect("outer-glow"), effect("inner-glow", { hidden: true })] }).map((e) => e.type)).toEqual(["outer-glow"]);
  });

  it("gives new effects the defaults of their kind", () => {
    expect(newEffect("drop-shadow", "a")).toEqual({ id: "a", type: "drop-shadow", color: "#000000", opacity: 0.4, x: 0, y: 6, blur: 12, spread: 0 });
    expect(newEffect("inner-glow", "b")).toMatchObject({ color: "#ffffff", blendMode: "screen", source: "edge" });
    expect(newEffect("outer-glow", "c")).toMatchObject({ x: 0, y: 0, color: "#ffffff" });
  });

  it("paints through the layered renderer only when a layer needs it", () => {
    expect(paintsRichly(newShapeLayer("rect"))).toBe(false);
    expect(paintsRichly({ ...newShapeLayer("rect"), shadow: { color: "#000000", blur: 4, x: 0, y: 0 } })).toBe(false);
    expect(paintsRichly({ ...newShapeLayer("rect"), pattern: DEFAULT_PATTERN })).toBe(true);
    expect(paintsRichly({ ...newShapeLayer("rect"), effects: [effect("inner-shadow")] })).toBe(true);
    expect(paintsRichly({ ...newImageLayer("m"), strokes: [outline("#ffffff", 8, "outside")] })).toBe(true);
    expect(paintsRichly({ ...newShapeLayer("rect"), fills: [] })).toBe(false);
  });

  it("reaches as far as the widest outer effect or outside stroke", () => {
    expect(paintReach(newShapeLayer("rect"))).toBe(0);
    expect(paintReach({ ...newShapeLayer("rect"), stroke: "#000000", strokeWidth: 10 })).toBe(5);
    expect(paintReach({ ...newShapeLayer("rect"), shadow: { color: "#000000", blur: 10, x: 4, y: -8 } })).toBe(23);
    const listed: Layer = { ...newShapeLayer("rect"), strokes: [outline("#000000", 12, "outside"), outline("#000000", 30, "inside")], effects: [effect("drop-shadow", { blur: 10, x: 0, y: 0, spread: 4 }), effect("inner-shadow", { blur: 100 })] };
    expect(paintReach(listed)).toBe(31);
  });

  it("hands the pixel stage the visible effects and the outlines traced around pictures", () => {
    const photo: Layer = { ...newImageLayer("m"), strokes: [outline("#ffffff", 8, "outside")], effects: [effect("drop-shadow"), effect("outer-glow", { hidden: true })] };
    expect(effectPlan(photo)).toEqual({ effects: [effect("drop-shadow")], outlines: [outline("#ffffff", 8, "outside")] });
    const shape: Layer = { ...newShapeLayer("rect"), strokes: [outline("#ffffff", 8, "outside")] };
    expect(effectPlan(shape)).toEqual({ effects: [], outlines: [] });
  });

  it("leaves color keys to layers painted by the single fill and outline", () => {
    const listed: Layer = { ...newTextLayer("Oi"), fill: undefined, fills: [solid("#ffffff")], strokes: [outline("#000000", 2, "outside")] };
    expect(paintsProperty(listed, "fill")).toBe(false);
    expect(paintsProperty(listed, "stroke")).toBe(false);
    expect(paintsProperty({ ...newTextLayer("Oi"), pattern: DEFAULT_PATTERN }, "fill")).toBe(true);
  });

  it("rescales every pixel quantity with the artboard and keeps them in range", () => {
    const layer: Layer = {
      ...newShapeLayer("rect"),
      fill: undefined,
      fills: [{ type: "pattern", pattern: { ...DEFAULT_PATTERN, size: 40 }, opacity: 1 }],
      strokes: [outline("#000000", 150, "outside")],
      effects: [effect("drop-shadow", { x: 400, y: -10, blur: 20, spread: 80 })],
    };
    const scaled = scaledPaint(layer, 2);
    expect(scaled.fills?.[0].pattern?.size).toBe(80);
    expect(scaled.strokes?.[0].width).toBe(200);
    expect(scaled.effects?.[0]).toMatchObject({ x: 500, y: -20, blur: 40, spread: 100 });
    expect(scaledPaint({ ...newShapeLayer("rect"), pattern: { ...DEFAULT_PATTERN, size: 40 } }, 0.5).pattern?.size).toBe(20);
    expect(scaledPaint(newShapeLayer("rect"), 2)).toEqual({});
  });

  it("rescales paints when the artboard is resized", () => {
    const board = { ...emptyArtboard({ width: 1000, height: 1000 }), layers: [{ ...newShapeLayer("rect"), id: "s", effects: [effect("drop-shadow", { blur: 20 })], pattern: { ...DEFAULT_PATTERN, size: 40 } }] };
    const resized = resizeCanvas(board, { width: 500, height: 500 }).layers[0];
    expect(resized.effects?.[0].blur).toBe(10);
    expect(resized.pattern?.size).toBe(20);
  });
});

describe("stroke look of one stroke in the list", () => {
  it("reads one stroke as the stroke fields of its layer", () => {
    const layer = newShapeLayer("rect");
    const stroke: StrokePaint = { type: "solid", color: "#000000", opacity: 1, width: 3, align: "center", dashArray: [2, 1], lineCap: "round" };
    expect(strokeLook(layer, stroke)).toEqual({ type: "shape", shape: "rect", strokeWidth: 3, dashArray: [2, 1], dashOffset: undefined, lineCap: "round", lineJoin: undefined, miterLimit: undefined });
  });

  it("writes stroke field changes back onto the stroke and drops the legacy dash flag", () => {
    const stroke: StrokePaint = { type: "solid", color: "#000000", opacity: 1, width: 3, align: "center" };
    expect(withStrokeLook(stroke, { dashArray: [6, 3], dash: undefined, lineJoin: "bevel", miterLimit: 4, dashOffset: 1 })).toEqual({ ...stroke, dashArray: [6, 3], lineJoin: "bevel", miterLimit: 4, dashOffset: 1 });
    expect(withStrokeLook({ ...stroke, dashArray: [6, 3], dashOffset: 1 }, { dashArray: undefined, dash: undefined, dashOffset: undefined })).toEqual(stroke);
  });
});
