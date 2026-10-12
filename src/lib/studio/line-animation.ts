import { STUDIO_LIMITS, type Clip, type Layer } from "./document";
import { arrowheadSize } from "./arrowheads";
import { curveExtent, ease, valueAt, withoutProperty, type Keyframe, type Keyframes } from "./keyframes";
import { LINE_GROUPS, LINE_PROPERTIES, LINE_RANGES, LINE_SLOTS, WIGGLE_SEED_RANGE, linePropertiesOf, type LineGroup, type LineProperty } from "./line-properties";
import { paintsProperty, strokeStyle } from "./paint";
import type { ClipPatch } from "./timeline";
import type { IssueCode } from "./validate";

export const WAVE_MODES = ["bend", "width"] as const;

export type WaveMode = (typeof WAVE_MODES)[number];

export interface LineTrim {
  start: number;
  end: number;
  offset: number;
  sequential?: boolean;
}

export interface LineWave {
  mode: WaveMode;
  amount: number;
  wavelength: number;
  speed: number;
  phase: number;
  travel?: number;
}

export interface LineWiggle {
  size: number;
  detail: number;
  rate: number;
  seed: number;
  travel?: number;
}

export interface LineTaper {
  startLength: number;
  endLength: number;
  startWidth: number;
  endWidth: number;
  startEase: number;
  endEase: number;
}

export interface LineAnimation {
  trim?: LineTrim;
  wave?: LineWave;
  wiggle?: LineWiggle;
  taper?: LineTaper;
}

export const LINE_DEFAULTS = {
  trim: { start: 0, end: 1, offset: 0 },
  wave: { mode: "bend", amount: 12, wavelength: 120, speed: 1, phase: 0 },
  wiggle: { size: 10, detail: 2, rate: 2, seed: 1 },
  taper: { startLength: 0.25, endLength: 0.25, startWidth: 0, endWidth: 0, startEase: 0, endEase: 0 },
} as const satisfies { [G in LineGroup]-?: Required<LineAnimation>[G] };

export interface ResolvedTrim {
  start: number;
  end: number;
  offset: number;
  sequential: boolean;
}

export interface ResolvedWave {
  mode: WaveMode;
  amount: number;
  wavelength: number;
  turns: number;
}

export interface ResolvedWiggle {
  size: number;
  detail: number;
  time: number;
  seed: number;
}

export interface ResolvedLine {
  trim?: ResolvedTrim;
  wave?: ResolvedWave;
  wiggle?: ResolvedWiggle;
  taper?: LineTaper;
}

type LineClip = Pick<Clip, "line" | "keyframes">;

const SIMPSON_STEPS = 32;
const SAFETY_PX = 2;
const WIGGLE_REACH = Math.SQRT2;
const WIGGLE_FINE_SCALE = 2;
const MAX_STEP_PX = 2;
const MIN_STEP_PX = 0.5;
const SAMPLES_PER_FEATURE = 8;

export const LINE_TRAVEL_RANGES = {
  wave: [0, 1],
  wiggle: [0, (LINE_RANGES.wiggleRate[1] * STUDIO_LIMITS.maxVideoMs) / 1000],
} as const;

function framesOf(k: Keyframes | undefined, property: LineProperty): readonly Keyframe[] {
  return k?.[property] ?? [];
}

function groupValues(line: LineAnimation | undefined, group: LineGroup): Record<string, number> {
  return { ...LINE_DEFAULTS[group], ...line?.[group] } as unknown as Record<string, number>;
}

export function lineStaticValue(clip: Pick<Clip, "line">, property: LineProperty): number {
  const [group, field] = LINE_SLOTS[property];
  return groupValues(clip.line, group)[field];
}

export function lineStaticPatch(clip: Pick<Clip, "line">, property: LineProperty, value: number): ClipPatch {
  const [group, field] = LINE_SLOTS[property];
  return { line: { ...clip.line, [group]: { ...LINE_DEFAULTS[group], ...clip.line?.[group], [field]: value } } };
}

export function lineValue(clip: LineClip, property: LineProperty, localMs: number): number {
  const frames = framesOf(clip.keyframes, property);
  return frames.length === 0 ? lineStaticValue(clip, property) : valueAt(frames, localMs);
}

function easedArea(easing: Keyframe["easing"], until: number): number {
  if (until <= 0) return 0;
  const h = until / SIMPSON_STEPS;
  let sum = ease(easing, 0) + ease(easing, until);
  for (let i = 1; i < SIMPSON_STEPS; i++) sum += ease(easing, i * h) * (i % 2 === 1 ? 4 : 2);
  return (sum * h) / 3;
}

function segmentArea(from: Keyframe, to: Keyframe, untilMs: number): number {
  const span = to.atMs - from.atMs;
  const p = Math.min(1, Math.max(0, (untilMs - from.atMs) / span));
  return (span / 1000) * (from.value * p + (to.value - from.value) * easedArea(from.easing, p));
}

export function travelled(frames: readonly Keyframe[], fallback: number, localMs: number): number {
  if (localMs <= 0) return 0;
  if (frames.length === 0) return (fallback * localMs) / 1000;
  const first = frames[0];
  const last = frames[frames.length - 1];
  let total = first.atMs > 0 ? (first.value * Math.min(localMs, first.atMs)) / 1000 : 0;
  for (let i = 0; i < frames.length - 1; i++) {
    const from = frames[i];
    const to = frames[i + 1];
    const startMs = Math.max(0, from.atMs);
    const endMs = Math.min(localMs, to.atMs);
    if (endMs > startMs) total += segmentArea(from, to, endMs) - segmentArea(from, to, startMs);
  }
  if (localMs > last.atMs) total += (last.value * (localMs - Math.max(0, last.atMs))) / 1000;
  return total;
}

function travelledOf(clip: LineClip, property: LineProperty, localMs: number): number {
  return travelled(framesOf(clip.keyframes, property), lineStaticValue(clip, property), localMs);
}

export function lineAt(clip: LineClip, localMs: number): ResolvedLine | undefined {
  const line = clip.line;
  if (!line) return undefined;
  const at = (property: LineProperty) => lineValue(clip, property, localMs);
  const clamped = (property: LineProperty) => {
    const [low, high] = LINE_RANGES[property];
    return Math.min(high, Math.max(low, at(property)));
  };
  return {
    ...(line.trim ? { trim: { start: clamped("trimStart"), end: clamped("trimEnd"), offset: at("trimOffset"), sequential: Boolean(line.trim.sequential) } } : {}),
    ...(line.wave ? { wave: { mode: line.wave.mode, amount: Math.max(0, at("waveAmount")), wavelength: clamped("waveLength"), turns: (line.wave.travel ?? 0) + travelledOf(clip, "waveSpeed", localMs) - at("wavePhase") / 360 } } : {}),
    ...(line.wiggle ? { wiggle: { size: Math.max(0, at("wiggleSize")), detail: clamped("wiggleDetail"), time: (line.wiggle.travel ?? 0) + travelledOf(clip, "wiggleRate", localMs), seed: line.wiggle.seed } } : {}),
    ...(line.taper
      ? {
          taper: {
            startLength: clamped("taperStartLength"),
            endLength: clamped("taperEndLength"),
            startWidth: clamped("taperStartWidth"),
            endWidth: clamped("taperEndWidth"),
            startEase: clamped("taperStartEase"),
            endEase: clamped("taperEndEase"),
          },
        }
      : {}),
  };
}

function cycle(turns: number): number {
  const wrapped = ((turns % 1) + 1) % 1;
  return wrapped >= 1 ? 0 : wrapped;
}

export function splitLine(clip: LineClip, atLocalMs: number): LineAnimation | undefined {
  const line = clip.line;
  if (!line) return undefined;
  return {
    ...line,
    ...(line.wave ? { wave: { ...line.wave, travel: cycle((line.wave.travel ?? 0) + travelledOf(clip, "waveSpeed", atLocalMs)) } } : {}),
    ...(line.wiggle ? { wiggle: { ...line.wiggle, travel: (line.wiggle.travel ?? 0) + travelledOf(clip, "wiggleRate", atLocalMs) } } : {}),
  };
}

function strokedShape(layer: Layer): boolean {
  return layer.type === "shape" && (layer.shape === "line" || layer.shape === "arrow");
}

export function lineColorOf(layer: Layer): string | undefined {
  return layer.stroke || (strokedShape(layer) ? layer.fill : undefined) || undefined;
}

export function takesLineAnimation(layer: Layer): boolean {
  return layer.type === "shape" && paintsProperty(layer, "stroke") && (layer.strokeWidth ?? 0) > 0 && lineColorOf(layer) !== undefined && !layer.shadow && (layer.effects?.length ?? 0) === 0;
}

export function strokelessLayer(layer: Layer): Layer {
  return { ...layer, stroke: undefined, strokeWidth: undefined, arrowStart: undefined, arrowEnd: undefined, arrowStartKind: undefined, arrowEndKind: undefined, dash: undefined, dashArray: undefined, dashOffset: undefined, lineCap: undefined, lineJoin: undefined, miterLimit: undefined };
}

export function paintsFillArea(layer: Layer): boolean {
  return layer.type === "shape" && !strokedShape(layer) && Boolean(layer.fill || layer.gradient || layer.pattern || (layer.fills?.length ?? 0) > 0);
}

function highest(clip: LineClip, property: LineProperty): number {
  const frames = framesOf(clip.keyframes, property);
  return frames.length === 0 ? lineStaticValue(clip, property) : curveExtent(frames)[1];
}

function lowest(clip: LineClip, property: LineProperty): number {
  const frames = framesOf(clip.keyframes, property);
  return frames.length === 0 ? lineStaticValue(clip, property) : curveExtent(frames)[0];
}

export function lineStep(clip: LineClip): number {
  const wave = clip.line?.wave ? Math.max(LINE_RANGES.waveLength[0], lowest(clip, "waveLength")) : Infinity;
  const wiggle = clip.line?.wiggle ? 100 / WIGGLE_FINE_SCALE / Math.min(LINE_RANGES.wiggleDetail[1], highest(clip, "wiggleDetail")) : Infinity;
  return Math.min(MAX_STEP_PX, Math.max(MIN_STEP_PX, Math.min(wave, wiggle) / SAMPLES_PER_FEATURE));
}

export function lineReach(clip: LineClip & Pick<Clip, "layer">): number {
  const layer = clip.layer;
  const width = layer?.strokeWidth ?? 0;
  const style = layer ? strokeStyle(layer) : null;
  const corner = style?.lineJoin === "miter" ? style.miterLimit : style?.lineCap === "square" ? Math.SQRT2 : 1;
  const heads = layer && (layer.arrowStart || layer.arrowEnd) ? arrowheadSize(width) + width / 2 : 0;
  const wave = clip.line?.wave ? Math.max(0, highest(clip, "waveAmount")) : 0;
  const bend = clip.line?.wave?.mode === "bend" ? wave : wave / 2;
  const wiggle = clip.line?.wiggle ? Math.max(0, highest(clip, "wiggleSize")) * WIGGLE_REACH : 0;
  return Math.ceil(Math.max((width / 2) * corner, heads) + bend + wiggle + SAFETY_PX);
}

export interface LineState {
  resolved: ResolvedLine;
  reachPx: number;
  step: number;
}

export function lineStateAt(clip: LineClip & Pick<Clip, "layer">, localMs: number): LineState | undefined {
  const resolved = clip.layer ? lineAt(clip, localMs) : undefined;
  return resolved ? { resolved, reachPx: lineReach(clip), step: lineStep(clip) } : undefined;
}

export function toggleLineGroup(clip: LineClip, group: LineGroup, on: boolean): ClipPatch {
  if (on) return { line: { ...clip.line, [group]: clip.line?.[group] ?? { ...LINE_DEFAULTS[group] } } };
  const rest: LineAnimation = { ...clip.line };
  delete rest[group];
  const keyframes = linePropertiesOf(group).reduce<Keyframes | undefined>((current, property) => withoutProperty(current, property), clip.keyframes);
  return { line: LINE_GROUPS.some((g) => rest[g]) ? rest : undefined, keyframes };
}

export interface LineOptions {
  mode?: WaveMode;
  sequential?: boolean;
  seed?: number;
}

export function lineOptionsPatch(clip: Pick<Clip, "line">, options: LineOptions): ClipPatch {
  const line: LineAnimation = { ...clip.line };
  if (options.mode !== undefined && line.wave) line.wave = { ...line.wave, mode: options.mode };
  if (options.seed !== undefined && line.wiggle) line.wiggle = { ...line.wiggle, seed: options.seed };
  if (options.sequential !== undefined && line.trim) {
    const trim: LineTrim = { start: line.trim.start, end: line.trim.end, offset: line.trim.offset };
    line.trim = options.sequential ? { ...trim, sequential: true } : trim;
  }
  return { line };
}

function within(value: number, [low, high]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= low && value <= high;
}

function travelHolds(travel: number | undefined, group: "wave" | "wiggle"): boolean {
  if (travel === undefined) return true;
  const [low, high] = LINE_TRAVEL_RANGES[group];
  return Number.isFinite(travel) && travel >= low && (group === "wave" ? travel < high : travel <= high);
}

function groupIssue(line: LineAnimation, group: LineGroup): IssueCode | null {
  const values = line[group] as unknown as Record<string, number> | undefined;
  if (!values) return null;
  if (group === "wave" && !(WAVE_MODES as readonly string[]).includes(line.wave!.mode)) return "unknown";
  if (group === "wiggle" && (!Number.isInteger(line.wiggle!.seed) || !within(line.wiggle!.seed, WIGGLE_SEED_RANGE))) return "invalid";
  if ((group === "wave" || group === "wiggle") && !travelHolds(line[group]!.travel, group)) return "out_of_range";
  return linePropertiesOf(group).every((property) => within(values[LINE_SLOTS[property][1]], LINE_RANGES[property])) ? null : "out_of_range";
}

export function lineIssue(clip: Pick<Clip, "type" | "layer" | "line" | "keyframes">): IssueCode | null {
  const keyed = LINE_PROPERTIES.filter((property) => framesOf(clip.keyframes, property).length > 0);
  const line = clip.line;
  if (!line) return keyed.length > 0 ? "invalid" : null;
  if (clip.type !== "overlay" || !clip.layer || !takesLineAnimation(clip.layer)) return "invalid";
  if (!LINE_GROUPS.some((group) => line[group])) return "required";
  for (const group of LINE_GROUPS) {
    const issue = groupIssue(line, group);
    if (issue) return issue;
  }
  return keyed.every((property) => line[LINE_SLOTS[property][0]]) ? null : "invalid";
}

export function lineGroupsOn(clip: LineClip): LineGroup[] {
  return LINE_GROUPS.filter((group) => clip.line?.[group]);
}

export function lineLaneProperties(clip: LineClip): LineProperty[] {
  return LINE_PROPERTIES.filter((property) => Boolean(clip.line?.[LINE_SLOTS[property][0]]) || framesOf(clip.keyframes, property).length > 0);
}
