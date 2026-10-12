import { BLEND_MODES, LINE_CAPS, LINE_JOINS, MAX_DASH_VALUES, type BlendMode, type Gradient, type Layer, type LineCap, type LineJoin } from "../document";
import { GRADIENT_MAP_INTERPOLATIONS, GRADIENT_MAP_PRESET_IDS, gradientMapIssue, gradientMapOfPreset, isGradientMapPreset, type GradientMap, type GradientMapInterpolation, type GradientMapStop } from "../gradient-map";
import { LAYER_RANGES } from "../layer-ranges";
import {
  DEFAULT_STROKE_WIDTH,
  EFFECT_DEFAULTS,
  EFFECT_RANGES,
  EFFECT_TYPES,
  GLOW_SOURCES,
  isOuterEffect,
  PAINT_TYPES,
  STROKE_ALIGNS,
  takesFills,
  takesStrokes,
  tracesOutline,
  type Effect,
  type EffectType,
  type GlowSource,
  type Paint,
  type PaintType,
  type StrokeAlign,
  type StrokePaint,
} from "../layer-paint";
import type { LayerPatch } from "../layers";
import { effectsPatch, fillsPatch, newEffectId, newStroke, strokesPatch } from "../paint-edits";
import { BRICK_OFFSET, DEFAULT_PATTERN, isBrickTile, PATTERN_PRESETS, PATTERN_RANGES, PATTERN_TILES, patternIssue, type Pattern, type PatternPreset, type PatternTile } from "../pattern";
import { isValidColor } from "../validate";
import { firstProblem, gradientOf, issueText, outOfRange, type AgentGradient, type Noted, type Patched } from "./layer-style";

export interface AgentPattern {
  preset?: string;
  media_id?: string;
  color?: string;
  background?: string;
  tile?: string;
  size?: number;
  spacing_x?: number;
  spacing_y?: number;
  offset?: number;
  angle?: number;
  origin_x?: number;
  origin_y?: number;
  opacity?: number;
  blend_mode?: string;
}

export interface AgentGradientMap {
  preset?: string;
  stops?: { at: number; color: string }[];
  intensity?: number;
  reverse?: boolean;
  interpolation?: string;
}

export interface AgentPaint {
  type?: string;
  color?: string;
  gradient?: AgentGradient;
  pattern?: AgentPattern;
  opacity?: number;
  blend_mode?: string;
  hidden?: boolean;
}

export interface AgentStroke extends AgentPaint {
  width?: number;
  align?: string;
  dash_array?: number[];
  dash_offset?: number;
  line_cap?: string;
  line_join?: string;
  miter_limit?: number;
}

export interface AgentEffect {
  id?: string;
  type?: string;
  color?: string;
  opacity?: number;
  x?: number;
  y?: number;
  blur?: number;
  spread?: number;
  blend_mode?: string;
  hidden?: boolean;
  show_behind?: boolean;
  source?: string;
}

export interface AgentPaintFields {
  pattern?: AgentPattern;
  gradient_map?: AgentGradientMap;
  fills?: AgentPaint[];
  strokes?: AgentStroke[];
  effects?: AgentEffect[];
}

export interface PaintSourceFields {
  fill?: string;
  gradient?: AgentGradient;
  stroke?: string;
  stroke_width?: number;
  dash?: boolean;
  dash_array?: number[];
  dash_offset?: number;
  line_cap?: string;
  line_join?: string;
  miter_limit?: number;
  shadow?: unknown;
}

export type PaintOp = AgentPaintFields & PaintSourceFields;

const PAINT_KEYS = ["pattern", "gradient_map", "fills", "strokes", "effects"] as const;
const SINGLE_FILL_KEYS = ["fill", "gradient"] as const;
const SINGLE_STROKE_KEYS = ["stroke", "stroke_width", "dash", "dash_array", "dash_offset", "line_cap", "line_join", "miter_limit"] as const;
const NORMAL = "normal";

type Refusal = { ok: false; reason: string };

function refuse(reason: string): Refusal {
  return { ok: false, reason };
}

function oneOf<T extends string>(name: string, value: string | undefined, allowed: readonly T[]): Patched<T | undefined> {
  if (value === undefined) return { ok: true, value: undefined };
  return (allowed as readonly string[]).includes(value) ? { ok: true, value: value as T } : refuse(`${name} precisa ser um de: ${allowed.join(", ")}`);
}

function blendOf(name: string, value: string | undefined, current: BlendMode | "" | undefined): Patched<BlendMode | undefined> {
  const mode = oneOf(`${name}.blend_mode`, value, BLEND_MODES);
  if (!mode.ok) return mode;
  if (value === undefined) return { ok: true, value: current || undefined };
  return { ok: true, value: mode.value === NORMAL ? undefined : mode.value };
}

function colorOf(name: string, value: string | undefined): string | null {
  return value === undefined || isValidColor(value, true) ? null : `${name} precisa ser uma cor #rrggbb ou #rrggbbaa`;
}

export function hasPaintFields(op: AgentPaintFields): boolean {
  return PAINT_KEYS.some((key) => op[key] !== undefined);
}

export function patternOf(input: AgentPattern, current: Pattern | undefined, knowsImage: (mediaId: string) => boolean, name = "pattern"): Patched<Pattern> {
  const problem = firstProblem(
    colorOf(`${name}.color`, input.color),
    colorOf(`${name}.background`, input.background),
    outOfRange(`${name}.size`, input.size, PATTERN_RANGES.size),
    outOfRange(`${name}.offset`, input.offset, PATTERN_RANGES.offset),
    outOfRange(`${name}.angle`, input.angle, PATTERN_RANGES.angle),
    outOfRange(`${name}.origin_x`, input.origin_x, PATTERN_RANGES.origin),
    outOfRange(`${name}.origin_y`, input.origin_y, PATTERN_RANGES.origin),
    outOfRange(`${name}.opacity`, input.opacity, PATTERN_RANGES.opacity),
  );
  if (problem) return refuse(problem);
  if (input.preset !== undefined && input.media_id !== undefined) return refuse(`${name} usa preset ou media_id, não os dois`);
  const preset = oneOf<PatternPreset>(`${name}.preset`, input.preset, PATTERN_PRESETS);
  if (!preset.ok) return preset;
  const tile = oneOf<PatternTile>(`${name}.tile`, input.tile, PATTERN_TILES);
  if (!tile.ok) return tile;
  if (input.media_id !== undefined && !knowsImage(input.media_id)) return refuse(`a imagem ${input.media_id} não está na biblioteca`);
  const blend = blendOf(name, input.blend_mode, current?.blendMode);
  if (!blend.ok) return blend;
  let pattern: Pattern = current ?? DEFAULT_PATTERN;
  if (preset.value) pattern = { ...pattern, source: "preset", presetId: preset.value, assetId: undefined, color: pattern.color || DEFAULT_PATTERN.color };
  if (input.media_id !== undefined) pattern = { ...pattern, source: "asset", assetId: input.media_id, presetId: undefined, color: undefined, background: undefined };
  if (pattern.source === "asset" && (input.color !== undefined || input.background !== undefined)) return refuse(`${name}.color e ${name}.background valem só para preset; uma imagem usa as próprias cores`);
  const spacing = { x: input.spacing_x ?? pattern.spacing?.x ?? 0, y: input.spacing_y ?? pattern.spacing?.y ?? 0 };
  const origin = { x: input.origin_x ?? pattern.origin?.x ?? 0, y: input.origin_y ?? pattern.origin?.y ?? 0 };
  const nextTile = tile.value ?? pattern.tile ?? "grid";
  const offset = input.offset ?? (isBrickTile(nextTile) ? pattern.offset || BRICK_OFFSET : undefined);
  pattern = {
    ...pattern,
    ...(input.color !== undefined ? { color: input.color } : {}),
    ...(input.background !== undefined ? { background: input.background } : {}),
    tile: nextTile,
    size: input.size ?? pattern.size,
    spacing: spacing.x === 0 && spacing.y === 0 ? undefined : spacing,
    offset: offset || undefined,
    angle: (input.angle ?? pattern.angle) || undefined,
    origin: origin.x === 0 && origin.y === 0 ? undefined : origin,
    opacity: input.opacity ?? pattern.opacity,
    blendMode: blend.value,
  };
  const code = patternIssue(pattern);
  if (!code) return { ok: true, value: pattern };
  if (code === "invalid" && (pattern.offset ?? 0) !== 0 && !isBrickTile(pattern.tile)) return refuse(`${name}.offset vale só para tile brick-row ou brick-column`);
  return refuse(`${name}.spacing_x e ${name}.spacing_y vão de -90% do size a ${PATTERN_RANGES.maxSpacing}, e size + spacing precisa dar pelo menos 1 pixel (${issueText(code)})`);
}

export function gradientMapOf(input: AgentGradientMap, current: GradientMap | undefined): Patched<GradientMap> {
  if (input.preset !== undefined && !isGradientMapPreset(input.preset)) return refuse(`gradient_map.preset precisa ser um de: ${GRADIENT_MAP_PRESET_IDS.join(", ")}`);
  const interpolation = oneOf<GradientMapInterpolation>("gradient_map.interpolation", input.interpolation, GRADIENT_MAP_INTERPOLATIONS);
  if (!interpolation.ok) return interpolation;
  const problem = outOfRange("gradient_map.intensity", input.intensity, [0, 1]);
  if (problem) return refuse(problem);
  const stops: GradientMapStop[] | undefined = input.stops ?? (input.preset !== undefined ? gradientMapOfPreset(input.preset as Parameters<typeof gradientMapOfPreset>[0]) : current?.stops);
  if (!stops) return refuse(`gradient_map precisa de preset ou de stops; presets: ${GRADIENT_MAP_PRESET_IDS.join(", ")}`);
  const reverse = input.reverse ?? current?.reverse;
  const mode = interpolation.value ?? current?.interpolation;
  const map: GradientMap = { stops, intensity: input.intensity ?? current?.intensity ?? 1, ...(reverse ? { reverse } : {}), ...(mode && mode !== "perceptual" ? { interpolation: mode } : {}) };
  return gradientMapIssue(map) ? refuse("gradient_map.stops precisa de pelo menos 2 cores #rrggbb com at de 0 a 1 em ordem crescente") : { ok: true, value: map };
}

function paintBody(input: AgentPaint, name: string, knowsImage: (mediaId: string) => boolean): Patched<Pick<Paint, "type" | "color" | "gradient" | "pattern">> {
  const given = (["color", "gradient", "pattern"] as const).filter((key) => input[key] !== undefined);
  if (given.length !== 1) return refuse(`${name} precisa de exatamente um entre color, gradient e pattern`);
  const kinds: Record<(typeof given)[number], PaintType> = { color: "solid", gradient: "gradient", pattern: "pattern" };
  const type = kinds[given[0]];
  const declared = oneOf<PaintType>(`${name}.type`, input.type, PAINT_TYPES);
  if (!declared.ok) return declared;
  if (declared.value !== undefined && declared.value !== type) return refuse(`${name}.type ${declared.value} não combina com o campo ${given[0]}`);
  if (type === "solid") {
    const problem = colorOf(`${name}.color`, input.color);
    return problem ? refuse(problem) : { ok: true, value: { type, color: input.color } };
  }
  if (type === "gradient") {
    const gradient = gradientOf(input.gradient!);
    return gradient.ok ? { ok: true, value: { type, gradient: gradient.value } } : refuse(`${name}.${gradient.reason}`);
  }
  const pattern = patternOf(input.pattern!, undefined, knowsImage, `${name}.pattern`);
  return pattern.ok ? { ok: true, value: { type, pattern: pattern.value } } : pattern;
}

function paintOf(input: AgentPaint, name: string, knowsImage: (mediaId: string) => boolean): Patched<Paint> {
  const body = paintBody(input, name, knowsImage);
  if (!body.ok) return body;
  const problem = outOfRange(`${name}.opacity`, input.opacity, [0, 1]);
  if (problem) return refuse(problem);
  const blend = blendOf(name, input.blend_mode, undefined);
  if (!blend.ok) return blend;
  return { ok: true, value: { ...body.value, opacity: input.opacity ?? 1, ...(blend.value ? { blendMode: blend.value } : {}), ...(input.hidden ? { hidden: true } : {}) } };
}

function strokeOf(input: AgentStroke, name: string, layer: Layer, knowsImage: (mediaId: string) => boolean): Patched<StrokePaint> {
  const paint = paintOf(input, name, knowsImage);
  if (!paint.ok) return paint;
  const align = oneOf<StrokeAlign>(`${name}.align`, input.align, STROKE_ALIGNS);
  if (!align.ok) return align;
  const cap = oneOf<LineCap>(`${name}.line_cap`, input.line_cap, LINE_CAPS);
  if (!cap.ok) return cap;
  const join = oneOf<LineJoin>(`${name}.line_join`, input.line_join, LINE_JOINS);
  if (!join.ok) return join;
  const dashes = input.dash_array ?? [];
  if (dashes.length > MAX_DASH_VALUES || dashes.some((v) => outOfRange("dash", v, LAYER_RANGES.dashValue) !== null) || (dashes.length > 0 && dashes.every((v) => v === 0))) {
    return refuse(`${name}.dash_array leva até ${MAX_DASH_VALUES} valores de 0 a ${LAYER_RANGES.dashValue[1]}, nem todos zero`);
  }
  const problem = firstProblem(outOfRange(`${name}.width`, input.width, LAYER_RANGES.strokeWidth), outOfRange(`${name}.miter_limit`, input.miter_limit, LAYER_RANGES.miterLimit), outOfRange(`${name}.dash_offset`, input.dash_offset, LAYER_RANGES.dashOffset));
  if (problem) return refuse(problem);
  const styled = dashes.length > 0 || input.dash_offset !== undefined || cap.value || join.value || input.miter_limit !== undefined || input.blend_mode !== undefined;
  if (tracesOutline(layer) && (paint.value.type !== "solid" || (align.value ?? "outside") !== "outside" || styled)) {
    return refuse(`${name}: em imagens e ícones o contorno segue a silhueta, só com color, width, opacity e align outside`);
  }
  return {
    ok: true,
    value: {
      ...paint.value,
      width: input.width ?? DEFAULT_STROKE_WIDTH,
      align: align.value ?? newStroke(layer).align,
      ...(dashes.length > 0 ? { dashArray: dashes } : {}),
      ...(input.dash_offset ? { dashOffset: input.dash_offset } : {}),
      ...(cap.value ? { lineCap: cap.value } : {}),
      ...(join.value ? { lineJoin: join.value } : {}),
      ...(input.miter_limit ? { miterLimit: input.miter_limit } : {}),
    },
  };
}

function effectOf(input: AgentEffect, name: string, current: readonly Effect[]): Patched<Effect> {
  const known = input.id !== undefined ? current.find((effect) => effect.id === input.id) : undefined;
  const type = oneOf<EffectType>(`${name}.type`, input.type ?? known?.type, EFFECT_TYPES);
  if (!type.ok) return type;
  if (!type.value) return refuse(`${name} precisa de type: ${EFFECT_TYPES.join(", ")}`);
  const source = oneOf<GlowSource>(`${name}.source`, input.source, GLOW_SOURCES);
  if (!source.ok) return source;
  if (input.blend_mode !== undefined && isOuterEffect(type.value)) return refuse(`${name}.blend_mode vale só para inner-shadow e inner-glow; sombras e brilhos de fora ficam atrás da camada`);
  if (input.show_behind !== undefined && type.value !== "drop-shadow") return refuse(`${name}.show_behind vale só para drop-shadow`);
  if (input.source !== undefined && type.value !== "inner-glow") return refuse(`${name}.source vale só para inner-glow`);
  const problem = firstProblem(
    colorOf(`${name}.color`, input.color),
    outOfRange(`${name}.opacity`, input.opacity, EFFECT_RANGES.opacity),
    outOfRange(`${name}.x`, input.x, EFFECT_RANGES.offset),
    outOfRange(`${name}.y`, input.y, EFFECT_RANGES.offset),
    outOfRange(`${name}.blur`, input.blur, EFFECT_RANGES.blur),
    outOfRange(`${name}.spread`, input.spread, EFFECT_RANGES.spread),
  );
  if (problem) return refuse(problem);
  const base: Effect = known && known.type === type.value ? known : { id: known?.id ?? newEffectId(), type: type.value, ...EFFECT_DEFAULTS[type.value] };
  const blend = blendOf(name, input.blend_mode, base.blendMode);
  if (!blend.ok) return blend;
  const effect: Effect = {
    ...base,
    color: input.color ?? base.color,
    opacity: input.opacity ?? base.opacity,
    x: input.x ?? base.x,
    y: input.y ?? base.y,
    blur: input.blur ?? base.blur,
    spread: input.spread ?? base.spread,
    blendMode: blend.value,
    hidden: (input.hidden ?? base.hidden) ? true : undefined,
    showBehind: (input.show_behind ?? base.showBehind) ? true : undefined,
    source: source.value ?? base.source,
  };
  return { ok: true, value: Object.fromEntries(Object.entries(effect).filter(([, v]) => v !== undefined)) as unknown as Effect };
}

function listOf<I, O>(items: readonly I[], name: string, parse: (item: I, label: string) => Patched<O>): Patched<O[]> {
  const out: O[] = [];
  for (const [i, item] of items.entries()) {
    const parsed = parse(item, `${name}[${i}]`);
    if (!parsed.ok) return parsed;
    out.push(parsed.value);
  }
  return { ok: true, value: out };
}

function sent(op: PaintSourceFields, keys: readonly (keyof PaintSourceFields)[]): string | undefined {
  return keys.find((key) => op[key] !== undefined);
}

function conflict(op: PaintOp, layer: Layer): string | null {
  const single = sent(op, SINGLE_FILL_KEYS);
  if (op.fills !== undefined && (single || op.pattern !== undefined)) return `use fills ou ${single ?? "pattern"}, não os dois na mesma operação`;
  if ((layer.fills?.length ?? 0) > 0 && op.fills === undefined && (single || op.pattern !== undefined)) return `a camada usa fills; mande a lista inteira em fills em vez de ${single ?? "pattern"}`;
  const outline = sent(op, SINGLE_STROKE_KEYS);
  if (op.strokes !== undefined && outline) return `use strokes ou ${outline}, não os dois na mesma operação`;
  if ((layer.strokes?.length ?? 0) > 0 && op.strokes === undefined && outline) return `a camada usa strokes; mande a lista inteira em strokes em vez de ${outline}`;
  if (op.effects !== undefined && op.shadow !== undefined) return "use effects ou shadow, não os dois na mesma operação";
  if ((layer.effects?.length ?? 0) > 0 && op.effects === undefined && op.shadow !== undefined) return "a camada usa effects; mande a lista inteira em effects (uma drop-shadow) em vez de shadow";
  if (op.pattern !== undefined && (layer.gradient || op.gradient !== undefined)) return "pattern não combina com gradient na mesma camada; mande fills com as duas tintas";
  return null;
}

export function paintPatch(op: PaintOp, layer: Layer, knowsImage: (mediaId: string) => boolean): Noted<LayerPatch> {
  const clash = conflict(op, layer);
  if (clash) return refuse(clash);
  const patch: LayerPatch = {};
  const ignored: string[] = [];
  const fills = takesFills(layer);
  if (op.pattern !== undefined) {
    if (!fills) ignored.push("pattern só vale para textos, formas e ícones");
    else {
      const pattern = patternOf(op.pattern, layer.pattern, knowsImage);
      if (!pattern.ok) return pattern;
      patch.pattern = pattern.value;
    }
  }
  if (op.gradient_map !== undefined) {
    if (layer.type !== "image") ignored.push("gradient_map só vale para imagens");
    else {
      const map = gradientMapOf(op.gradient_map, layer.gradientMap);
      if (!map.ok) return map;
      patch.gradientMap = map.value;
    }
  }
  if (op.fills !== undefined) {
    if (!fills) ignored.push("fills só vale para textos, formas e ícones");
    else {
      const list = listOf(op.fills, "fills", (item, label) => paintOf(item, label, knowsImage));
      if (!list.ok) return list;
      Object.assign(patch, fillsPatch(list.value));
    }
  }
  if (op.strokes !== undefined) {
    if (!takesStrokes(layer)) ignored.push("strokes não vale para linhas, setas e caminhos com ponta de seta; use stroke e stroke_width");
    else {
      const list = listOf(op.strokes, "strokes", (item, label) => strokeOf(item, label, layer, knowsImage));
      if (!list.ok) return list;
      Object.assign(patch, strokesPatch(list.value));
    }
  }
  if (op.effects !== undefined) {
    const list = listOf(op.effects, "effects", (item, label) => effectOf(item, label, layer.effects ?? []));
    if (!list.ok) return list;
    const ids = list.value.map((effect) => effect.id);
    if (new Set(ids).size !== ids.length) return refuse("effects tem ids repetidos; cada efeito aparece uma vez");
    Object.assign(patch, effectsPatch(list.value));
  }
  return { ok: true, value: patch, ignored };
}

export interface AgentPaintOutline {
  pattern?: AgentPattern;
  gradient_map?: AgentGradientMap;
  fills?: AgentPaint[];
  strokes?: AgentStroke[];
  effects?: AgentEffect[];
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function agentPattern(p: Pattern): AgentPattern {
  return {
    ...(p.source === "asset" ? { media_id: p.assetId } : { preset: p.presetId || undefined }),
    ...(p.color ? { color: p.color } : {}),
    ...(p.background ? { background: p.background } : {}),
    ...(p.tile ? { tile: p.tile } : {}),
    size: round(p.size),
    ...(p.spacing ? { spacing_x: round(p.spacing.x), spacing_y: round(p.spacing.y) } : {}),
    ...(p.offset ? { offset: round(p.offset) } : {}),
    ...(p.angle ? { angle: round(p.angle) } : {}),
    ...(p.origin ? { origin_x: round(p.origin.x), origin_y: round(p.origin.y) } : {}),
    opacity: round(p.opacity),
    ...(p.blendMode ? { blend_mode: p.blendMode } : {}),
  };
}

function agentGradient(g: Gradient): AgentGradient {
  return { ...g, kind: g.kind || undefined };
}

function agentFill(p: Paint): AgentPaint {
  return {
    type: p.type,
    ...(p.color ? { color: p.color } : {}),
    ...(p.gradient ? { gradient: agentGradient(p.gradient) } : {}),
    ...(p.pattern ? { pattern: agentPattern(p.pattern) } : {}),
    opacity: round(p.opacity),
    ...(p.blendMode ? { blend_mode: p.blendMode } : {}),
    ...(p.hidden ? { hidden: true } : {}),
  };
}

export function agentStroke(s: StrokePaint): AgentStroke {
  return {
    ...agentFill(s),
    width: round(s.width),
    align: s.align,
    ...(s.dashArray && s.dashArray.length > 0 ? { dash_array: s.dashArray } : {}),
    ...(s.dashOffset ? { dash_offset: s.dashOffset } : {}),
    ...(s.lineCap ? { line_cap: s.lineCap } : {}),
    ...(s.lineJoin ? { line_join: s.lineJoin } : {}),
    ...(s.miterLimit ? { miter_limit: s.miterLimit } : {}),
  };
}

export function agentEffect(e: Effect): AgentEffect & { keyframes?: Record<string, { at_ms: number; value: number; easing: string }[]> } {
  return {
    id: e.id,
    type: e.type,
    color: e.color,
    opacity: round(e.opacity),
    x: round(e.x),
    y: round(e.y),
    blur: round(e.blur),
    spread: round(e.spread),
    ...(e.blendMode ? { blend_mode: e.blendMode } : {}),
    ...(e.hidden ? { hidden: true } : {}),
    ...(e.showBehind ? { show_behind: true } : {}),
    ...(e.source ? { source: e.source } : {}),
    ...(e.keyframes && Object.values(e.keyframes).some((frames) => (frames?.length ?? 0) > 0)
      ? { keyframes: Object.fromEntries(Object.entries(e.keyframes).filter(([, frames]) => (frames?.length ?? 0) > 0).map(([property, frames]) => [property, frames!.map((f) => ({ at_ms: f.atMs, value: round(f.value), easing: f.easing }))])) }
      : {}),
  };
}

export function agentGradientMap(map: GradientMap): NonNullable<AgentPaintOutline["gradient_map"]> {
  return { stops: map.stops, intensity: round(map.intensity), ...(map.reverse ? { reverse: true } : {}), ...(map.interpolation ? { interpolation: map.interpolation } : {}) };
}

export function agentPaintOf(layer: Layer): AgentPaintOutline {
  return {
    ...(layer.pattern ? { pattern: agentPattern(layer.pattern) } : {}),
    ...(layer.gradientMap ? { gradient_map: agentGradientMap(layer.gradientMap) } : {}),
    ...(layer.fills && layer.fills.length > 0 ? { fills: layer.fills.map(agentFill) } : {}),
    ...(layer.strokes && layer.strokes.length > 0 ? { strokes: layer.strokes.map(agentStroke) } : {}),
    ...(layer.effects && layer.effects.length > 0 ? { effects: layer.effects.map(agentEffect) } : {}),
  };
}
