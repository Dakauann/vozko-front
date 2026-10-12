import { newStudioId, type Layer } from "./document";
import { DEFAULT_STROKE_WIDTH, fillPaints, legacyStroke, newEffect, shadowEffect, tracesOutline, type Effect, type EffectType, type Paint, type StrokePaint } from "./layer-paint";
import type { LayerPatch } from "./layers";

export const NEW_FILL_COLOR = "#c4c4c4";
export const NEW_STROKE_COLOR = "#000000";

export function newEffectId(): string {
  return newStudioId("fx");
}

export function fillsPatch(fills: readonly Paint[]): LayerPatch {
  return { fills: fills.length > 0 ? [...fills] : undefined, fill: undefined, gradient: undefined, pattern: undefined };
}

export function strokesPatch(strokes: readonly StrokePaint[]): LayerPatch {
  return {
    strokes: strokes.length > 0 ? [...strokes] : undefined,
    stroke: undefined,
    strokeWidth: undefined,
    dash: undefined,
    dashArray: undefined,
    dashOffset: undefined,
    lineCap: undefined,
    lineJoin: undefined,
    miterLimit: undefined,
  };
}

export function effectsPatch(effects: readonly Effect[]): LayerPatch {
  return { effects: effects.length > 0 ? [...effects] : undefined, shadow: undefined };
}

export function listedFills(layer: Layer): Paint[] {
  return layer.fills && layer.fills.length > 0 ? layer.fills : fillPaints(layer);
}

export function listedStrokes(layer: Layer): StrokePaint[] {
  return layer.strokes && layer.strokes.length > 0 ? layer.strokes : legacyStroke(layer);
}

export function listedEffects(layer: Layer): Effect[] {
  if (layer.effects && layer.effects.length > 0) return layer.effects;
  return layer.shadow ? [{ ...shadowEffect(layer.shadow), id: newEffectId() }] : [];
}

export function newStroke(layer: Layer): StrokePaint {
  const align = layer.type === "shape" ? "inside" : "outside";
  return { type: "solid", color: NEW_STROKE_COLOR, opacity: 1, width: DEFAULT_STROKE_WIDTH, align: tracesOutline(layer) ? "outside" : align };
}

export function addedFill(layer: Layer): LayerPatch {
  return fillsPatch([...listedFills(layer), { type: "solid", color: NEW_FILL_COLOR, opacity: 1 }]);
}

export function addedStroke(layer: Layer): LayerPatch {
  return strokesPatch([...listedStrokes(layer), newStroke(layer)]);
}

export function addedEffect(layer: Layer, type: EffectType): LayerPatch {
  return effectsPatch([...listedEffects(layer), newEffect(type, newEffectId())]);
}

export function replaced<T>(list: readonly T[], index: number, item: T): T[] {
  return list.map((current, i) => (i === index ? item : current));
}

export function removed<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

export function moved<T>(list: readonly T[], index: number, delta: number): readonly T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
