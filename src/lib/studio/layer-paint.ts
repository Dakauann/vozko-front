import { parseColor } from "./color";
import type { EffectProperty } from "./effect-keys";
import type { Keyframe } from "./keyframes";
import { BLEND_MODES, LINE_CAPS, LINE_JOINS, type BlendMode, type Gradient, type Layer, type LineCap, type LineJoin, type Shadow } from "./document";
import { gradientMapIssue } from "./gradient-map";
import { LAYER_RANGES } from "./layer-ranges";
import { LEGACY_DASH } from "./paint";
import { patternIssue, scaledPattern, type Pattern } from "./pattern";
import { dashPatternFits } from "./stroke-presets";
import type { IssueCode } from "./validate";

export const PAINT_TYPES = ["solid", "gradient", "pattern"] as const;

export type PaintType = (typeof PAINT_TYPES)[number];

export interface Paint {
  type: PaintType;
  color?: string;
  gradient?: Gradient;
  pattern?: Pattern;
  opacity: number;
  blendMode?: BlendMode | "";
  hidden?: boolean;
}

export const STROKE_ALIGNS = ["center", "inside", "outside"] as const;

export type StrokeAlign = (typeof STROKE_ALIGNS)[number];

export interface StrokePaint extends Paint {
  width: number;
  align: StrokeAlign;
  dashArray?: number[];
  dashOffset?: number;
  lineCap?: LineCap | "";
  lineJoin?: LineJoin | "";
  miterLimit?: number;
}

export const EFFECT_TYPES = ["drop-shadow", "inner-shadow", "outer-glow", "inner-glow"] as const;

export type EffectType = (typeof EFFECT_TYPES)[number];

export const GLOW_SOURCES = ["edge", "center"] as const;

export type GlowSource = (typeof GLOW_SOURCES)[number];

export interface Effect {
  id: string;
  type: EffectType;
  color: string;
  opacity: number;
  x: number;
  y: number;
  blur: number;
  spread: number;
  blendMode?: BlendMode | "";
  hidden?: boolean;
  showBehind?: boolean;
  source?: GlowSource | "";
  keyframes?: Partial<Record<EffectProperty, Keyframe[]>>;
}

export const EFFECT_RANGES = {
  opacity: [0, 1],
  offset: LAYER_RANGES.shadowOffset,
  blur: LAYER_RANGES.shadowBlur,
  spread: [-100, 100],
} as const;

export const EFFECT_DEFAULTS: Record<EffectType, Omit<Effect, "id" | "type">> = {
  "drop-shadow": { color: "#000000", opacity: 0.4, x: 0, y: 6, blur: 12, spread: 0 },
  "inner-shadow": { color: "#000000", opacity: 0.35, x: 0, y: 2, blur: 6, spread: 0 },
  "outer-glow": { color: "#ffffff", opacity: 0.75, x: 0, y: 0, blur: 16, spread: 0 },
  "inner-glow": { color: "#ffffff", opacity: 0.6, x: 0, y: 0, blur: 10, spread: 0, blendMode: "screen", source: "edge" },
};

export const DEFAULT_STROKE_WIDTH = 4;

const OUTER_EFFECTS = new Set<EffectType>(["drop-shadow", "outer-glow"]);
const SHADOW_REACH = 1.5;
const BLEND_VALUES = new Set<string>(["", ...BLEND_MODES]);
const CAP_VALUES = new Set<string>(["", ...LINE_CAPS]);
const JOIN_VALUES = new Set<string>(["", ...LINE_JOINS]);
const SOURCE_VALUES = new Set<string>(["", ...GLOW_SOURCES]);
const TOKEN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const LEGACY_SHADOW_ID = "shadow";

export function isOuterEffect(type: EffectType): boolean {
  return OUTER_EFFECTS.has(type);
}

export function newEffect(type: EffectType, id: string): Effect {
  return { id, type, ...EFFECT_DEFAULTS[type] };
}

export function shadowEffect(shadow: Shadow): Effect {
  return { id: LEGACY_SHADOW_ID, type: "drop-shadow", color: shadow.color, opacity: 1, x: shadow.x, y: shadow.y, blur: shadow.blur, spread: 0, showBehind: true };
}

function within(value: number, lo: number, hi: number): boolean {
  return Number.isFinite(value) && value >= lo && value <= hi;
}

function strokedShape(layer: Layer): boolean {
  return layer.type === "shape" && (layer.shape === "line" || layer.shape === "arrow");
}

export function takesFills(layer: Layer): boolean {
  return layer.type === "text" || layer.type === "icon" || (layer.type === "shape" && !strokedShape(layer));
}

export function takesStrokes(layer: Layer): boolean {
  return !strokedShape(layer) && !layer.arrowStart && !layer.arrowEnd;
}

export function tracesOutline(layer: Pick<Layer, "type">): boolean {
  return layer.type === "image" || layer.type === "icon";
}

export function paintsRichly(layer: Layer): boolean {
  return Boolean(layer.pattern) || (layer.fills?.length ?? 0) > 0 || (layer.strokes?.length ?? 0) > 0 || (layer.effects?.length ?? 0) > 0;
}

export function fillPaints(layer: Layer): Paint[] {
  if (!takesFills(layer)) return [];
  if (layer.fills && layer.fills.length > 0) return layer.fills.filter((paint) => !paint.hidden);
  const fill = layer.type === "icon" ? layer.fill || "#000000" : layer.fill;
  const base: Paint[] = layer.gradient ? [{ type: "gradient", gradient: layer.gradient, opacity: 1 }] : fill ? [{ type: "solid", color: fill, opacity: 1 }] : [];
  if (!layer.pattern) return base;
  return [...base, { type: "pattern", pattern: layer.pattern, opacity: layer.pattern.opacity, ...(layer.pattern.blendMode ? { blendMode: layer.pattern.blendMode } : {}) }];
}

export function strokePaints(layer: Layer): StrokePaint[] {
  if (layer.strokes && layer.strokes.length > 0) return layer.strokes.filter((stroke) => !stroke.hidden);
  if (layer.type === "image" || strokedShape(layer)) return [];
  return legacyStroke(layer);
}

export function legacyStroke(layer: Layer): StrokePaint[] {
  const width = layer.strokeWidth ?? 0;
  if (width <= 0 || !layer.stroke) return [];
  const outside = layer.type === "text" || layer.type === "image";
  const factor = outside ? 2 : 1;
  const pattern = layer.dashArray && layer.dashArray.length > 0 ? layer.dashArray : layer.dash ? [...LEGACY_DASH] : [];
  return [
    {
      type: "solid",
      color: layer.stroke,
      opacity: 1,
      width: width / factor,
      align: outside ? "outside" : "center",
      ...(pattern.length > 0 && layer.type !== "image" ? { dashArray: pattern.map((v) => v * factor) } : {}),
      ...(layer.dashOffset && layer.type !== "image" ? { dashOffset: layer.dashOffset * factor } : {}),
      ...(layer.lineCap && layer.type !== "image" ? { lineCap: layer.lineCap } : {}),
      ...(layer.lineJoin && layer.type !== "image" ? { lineJoin: layer.lineJoin } : {}),
      ...(layer.miterLimit && layer.type !== "image" ? { miterLimit: layer.miterLimit } : {}),
    },
  ];
}

export function layerEffects(layer: Layer): Effect[] {
  if (layer.effects && layer.effects.length > 0) return layer.effects.filter((effect) => !effect.hidden);
  return layer.shadow ? [shadowEffect(layer.shadow)] : [];
}

export interface EffectPlan {
  effects: Effect[];
  outlines: StrokePaint[];
}

export function effectPlan(layer: Layer): EffectPlan {
  return { effects: layerEffects(layer), outlines: tracesOutline(layer) ? strokePaints(layer) : [] };
}

function strokeReach(stroke: StrokePaint): number {
  if (stroke.align === "outside") return stroke.width;
  return stroke.align === "center" ? stroke.width / 2 : 0;
}

export function effectReach(effect: Effect): number {
  if (!isOuterEffect(effect.type)) return 0;
  return SHADOW_REACH * effect.blur + Math.max(Math.abs(effect.x), Math.abs(effect.y)) + Math.max(effect.spread, 0);
}

export function paintReach(layer: Layer): number {
  const strokes = layer.strokes && layer.strokes.length > 0 ? strokePaints(layer).map(strokeReach) : [(layer.strokeWidth ?? 0) / 2];
  return Math.max(0, ...strokes) + Math.max(0, ...layerEffects(layer).map(effectReach));
}

function clamp(value: number, [lo, hi]: readonly [number, number]): number {
  return Math.min(Math.max(value, lo), hi);
}

function scaledFill<P extends Paint>(paint: P, fit: number): P {
  return paint.pattern ? { ...paint, pattern: scaledPattern(paint.pattern, fit) } : paint;
}

export function scaledPaint(layer: Layer, fit: number): Partial<Layer> {
  const patch: Partial<Layer> = {};
  if (layer.pattern) patch.pattern = scaledPattern(layer.pattern, fit);
  if (layer.fills && layer.fills.length > 0) patch.fills = layer.fills.map((paint) => scaledFill(paint, fit));
  if (layer.strokes && layer.strokes.length > 0) patch.strokes = layer.strokes.map((stroke) => ({ ...scaledFill(stroke, fit), width: clamp(stroke.width * fit, LAYER_RANGES.strokeWidth) }));
  if (layer.effects && layer.effects.length > 0) {
    patch.effects = layer.effects.map((effect) => ({
      ...effect,
      x: clamp(effect.x * fit, EFFECT_RANGES.offset),
      y: clamp(effect.y * fit, EFFECT_RANGES.offset),
      blur: clamp(effect.blur * fit, EFFECT_RANGES.blur),
      spread: clamp(effect.spread * fit, EFFECT_RANGES.spread),
    }));
  }
  return patch;
}

type GradientCheck = (gradient: Gradient | undefined) => boolean;

function colorValid(value: string | undefined): boolean {
  return Boolean(value) && parseColor(value) !== null;
}

function paintIssue(paint: Paint, gradientValid: GradientCheck): IssueCode | null {
  if (!BLEND_VALUES.has(paint.blendMode ?? "")) return "unknown";
  if (!within(paint.opacity, 0, 1)) return "out_of_range";
  const color = paint.color ?? "";
  switch (paint.type) {
    case "solid":
      return colorValid(color) && !paint.gradient && !paint.pattern ? null : "invalid";
    case "gradient":
      return color === "" && paint.gradient && gradientValid(paint.gradient) && !paint.pattern ? null : "invalid";
    case "pattern":
      return color === "" && !paint.gradient && paint.pattern ? patternIssue(paint.pattern) : "invalid";
  }
  return "unknown";
}

function dashIssue(stroke: StrokePaint): IssueCode | null {
  if (!CAP_VALUES.has(stroke.lineCap ?? "") || !JOIN_VALUES.has(stroke.lineJoin ?? "")) return "unknown";
  const miter = stroke.miterLimit ?? 0;
  if (miter !== 0 && !within(miter, ...LAYER_RANGES.miterLimit)) return "out_of_range";
  const dashes = stroke.dashArray ?? [];
  if (!dashPatternFits(dashes)) return "invalid";
  return within(stroke.dashOffset ?? 0, ...LAYER_RANGES.dashOffset) ? null : "out_of_range";
}

function styledStroke(stroke: StrokePaint): boolean {
  return (stroke.dashArray ?? []).length > 0 || (stroke.dashOffset ?? 0) !== 0 || (stroke.lineCap ?? "") !== "" || (stroke.lineJoin ?? "") !== "" || (stroke.miterLimit ?? 0) !== 0;
}

function strokeIssue(stroke: StrokePaint, layer: Pick<Layer, "type">, gradientValid: GradientCheck): IssueCode | null {
  const paint = paintIssue(stroke, gradientValid);
  if (paint) return paint;
  if (!(STROKE_ALIGNS as readonly string[]).includes(stroke.align)) return "unknown";
  if (!within(stroke.width, ...LAYER_RANGES.strokeWidth)) return "out_of_range";
  const dash = dashIssue(stroke);
  if (dash) return dash;
  if (tracesOutline(layer) && (stroke.type !== "solid" || stroke.align !== "outside" || (stroke.blendMode ?? "") !== "" || styledStroke(stroke))) return "invalid";
  return null;
}

function legacyStroked(layer: Layer): boolean {
  return (layer.stroke ?? "") !== "" || (layer.strokeWidth ?? 0) !== 0 || Boolean(layer.dash) || (layer.dashArray ?? []).length > 0 || (layer.dashOffset ?? 0) !== 0 || (layer.lineCap ?? "") !== "" || (layer.lineJoin ?? "") !== "" || (layer.miterLimit ?? 0) !== 0;
}

function effectIssue(effect: Effect, seen: Set<string>): IssueCode | null {
  if (!TOKEN.test(effect.id) || seen.has(effect.id) || effect.keyframes) return "invalid";
  seen.add(effect.id);
  if (!(EFFECT_TYPES as readonly string[]).includes(effect.type) || !BLEND_VALUES.has(effect.blendMode ?? "") || !SOURCE_VALUES.has(effect.source ?? "")) return "unknown";
  if (!colorValid(effect.color)) return "invalid";
  if ((effect.blendMode ?? "") !== "" && isOuterEffect(effect.type)) return "invalid";
  if (effect.showBehind && effect.type !== "drop-shadow") return "invalid";
  if ((effect.source ?? "") !== "" && effect.type !== "inner-glow") return "invalid";
  if (!within(effect.opacity, ...EFFECT_RANGES.opacity) || !within(effect.blur, ...EFFECT_RANGES.blur) || !within(effect.spread, ...EFFECT_RANGES.spread)) return "out_of_range";
  return within(effect.x, ...EFFECT_RANGES.offset) && within(effect.y, ...EFFECT_RANGES.offset) ? null : "out_of_range";
}

function fillsIssue(layer: Layer, gradientValid: GradientCheck): IssueCode | null {
  const fills = layer.fills ?? [];
  if (fills.length === 0) return null;
  if (!takesFills(layer) || (layer.fill ?? "") !== "" || layer.gradient || layer.pattern) return "invalid";
  for (const paint of fills) {
    const code = paintIssue(paint, gradientValid);
    if (code) return code;
  }
  return null;
}

export function strokeListIssue(strokes: readonly StrokePaint[], owner: Pick<Layer, "type">, gradientValid: GradientCheck): IssueCode | null {
  for (const stroke of strokes) {
    const code = strokeIssue(stroke, owner, gradientValid);
    if (code) return code;
  }
  return null;
}

function strokesIssue(layer: Layer, gradientValid: GradientCheck): IssueCode | null {
  const strokes = layer.strokes ?? [];
  if (strokes.length === 0) return null;
  if (!takesStrokes(layer) || legacyStroked(layer)) return "invalid";
  return strokeListIssue(strokes, layer, gradientValid);
}

export function effectListIssue(effects: readonly Effect[]): IssueCode | null {
  const seen = new Set<string>();
  for (const effect of effects) {
    const code = effectIssue(effect, seen);
    if (code) return code;
  }
  return null;
}

function effectsIssue(layer: Layer): IssueCode | null {
  const effects = layer.effects ?? [];
  if (effects.length === 0) return null;
  if (layer.shadow) return "invalid";
  return effectListIssue(effects);
}

export function layerPaintIssue(layer: Layer, gradientValid: GradientCheck): IssueCode | null {
  if (layer.pattern) {
    if (!takesFills(layer) || layer.gradient) return "invalid";
    const code = patternIssue(layer.pattern);
    if (code) return code;
  }
  if (layer.gradientMap) {
    if (layer.type !== "image") return "invalid";
    const code = gradientMapIssue(layer.gradientMap);
    if (code) return code;
  }
  return fillsIssue(layer, gradientValid) ?? strokesIssue(layer, gradientValid) ?? effectsIssue(layer);
}

export type StrokeLook = Pick<Layer, "type" | "shape" | "strokeWidth" | "dash" | "dashArray" | "dashOffset" | "lineCap" | "lineJoin" | "miterLimit">;

export type StrokeLookPatch = Partial<Pick<Layer, "dash" | "dashArray" | "dashOffset" | "lineCap" | "lineJoin" | "miterLimit">>;

const STROKE_LOOK_KEYS = ["dashArray", "dashOffset", "lineCap", "lineJoin", "miterLimit"] as const;

export function strokeLook(layer: Pick<Layer, "type" | "shape">, stroke: StrokePaint): StrokeLook {
  return { type: layer.type, shape: layer.shape, strokeWidth: stroke.width, dashArray: stroke.dashArray, dashOffset: stroke.dashOffset, lineCap: stroke.lineCap || undefined, lineJoin: stroke.lineJoin || undefined, miterLimit: stroke.miterLimit };
}

export function withStrokeLook(stroke: StrokePaint, patch: StrokeLookPatch): StrokePaint {
  const next: StrokePaint = { ...stroke };
  for (const key of STROKE_LOOK_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value === undefined) delete next[key];
    else Object.assign(next, { [key]: value });
  }
  return next;
}
