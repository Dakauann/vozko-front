import { keyX } from "./focus-lanes";
import { isMorphProperty } from "./morph-keys";
import { keySide, keyVelocity, segmentDistance, setKeySide, setKeySpeed, type AxisMap, type EaseSide, type KeyTransform } from "./keyframe-ease";
import { animatedProperties, carriesValue, ease, easeSlope, isColorProperty, isPathProperty, KEYFRAME_RANGES, timedFramesOf, type AnimatedProperty, type Keyframe, type KeyframeProperty, type Keyframes, type KeyRef, type TimedKey } from "./keyframes";

export const GRAPH_MODES = ["value", "speed"] as const;

export type GraphMode = (typeof GRAPH_MODES)[number];

export const GRAPH_SHOWS = ["selected", "animated"] as const;

export type GraphShow = (typeof GRAPH_SHOWS)[number];

export type GraphFit = "all" | "selection";

export type GraphTarget = "keys" | EaseSide;

export const GRAPH_HEIGHT = 240;
export const GRAPH_PAD_PX = 16;
export const GRAPH_HIT_PX = 7;
const GRAPH_GRIP_PX = 6;
const GRAPH_SEGMENT_SAMPLES = 32;
const GRAPH_RANGE_PAD = 0.08;

const MS_PER_SECOND = 1000;
const PEAK_SAMPLES = 64;
const MIN_SPAN_SHARE = 1e-3;
const PATH_MIN_SPAN = 1e-3;
const JOIN_TOLERANCE = 1e-3;
const MIN_BOX_SCALE = 0.01;

interface GraphPoint {
  ms: number;
  value: number;
}

export interface GraphScale {
  durationMs: number;
  widthPx: number;
  heightPx: number;
  padPx: number;
  low: number;
  high: number;
}

export interface GraphBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface GraphHandle {
  side: EaseSide;
  point: GraphPoint;
}

interface GraphKeyMark {
  property: AnimatedProperty;
  atMs: number;
  x: number;
  y: number;
}

interface GraphHandleMark extends GraphKeyMark {
  side: EaseSide;
  keyXPx: number;
  keyYPx: number;
}

interface GraphLayer {
  property: AnimatedProperty;
  scale: GraphScale;
  points: [number, number][];
  keys: GraphKeyMark[];
  handles: GraphHandleMark[];
}

type GraphHit = { kind: "key"; property: AnimatedProperty; atMs: number } | { kind: "handle"; property: AnimatedProperty; atMs: number; side: EaseSide };

export type BoxGrip = "move" | "left" | "right" | "top" | "bottom" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

interface PixelTransform {
  pivotX: number;
  scaleX: number;
  offsetX: number;
  pivotY: number;
  scaleY: number;
  offsetY: number;
}

interface HandleOffset {
  influence: number;
  value: number;
}

export function graphable(property: AnimatedProperty, mode: GraphMode): boolean {
  if (isColorProperty(property) || isMorphProperty(property)) return false;
  return mode === "speed" || !isPathProperty(property);
}

export function graphProperties(k: Keyframes | undefined, mode: GraphMode, show: GraphShow, active: AnimatedProperty, selected: readonly KeyRef[]): AnimatedProperty[] {
  const chosen = new Set<AnimatedProperty>([active, ...selected.map((key) => key.property)]);
  return animatedProperties(k).filter((property) => graphable(property, mode) && (show === "animated" || chosen.has(property)));
}

export function valueCurve(frames: readonly Keyframe[], fromMs: number, toMs: number, samples: number = GRAPH_SEGMENT_SAMPLES): GraphPoint[] {
  if (frames.length === 0) return [];
  const last = frames[frames.length - 1];
  const points: GraphPoint[] = [{ ms: Math.min(fromMs, frames[0].atMs), value: frames[0].value }];
  frames.forEach((frame, index) => {
    points.push({ ms: frame.atMs, value: frame.value });
    const next = frames[index + 1];
    if (!next) return;
    if (frame.easing === "hold") {
      points.push({ ms: next.atMs, value: frame.value });
      return;
    }
    const span = next.atMs - frame.atMs;
    for (let step = 1; step < samples; step++) points.push({ ms: frame.atMs + (span * step) / samples, value: frame.value + (next.value - frame.value) * ease(frame.easing, step / samples) });
  });
  points.push({ ms: Math.max(toMs, last.atMs), value: last.value });
  return points;
}

function speedOn(property: AnimatedProperty, from: TimedKey, to: TimedKey, distance: number, p: number): number {
  if (from.easing === "hold") return 0;
  const speed = (easeSlope(from.easing, p) * distance * MS_PER_SECOND) / (to.atMs - from.atMs);
  return isPathProperty(property) ? Math.abs(speed) : speed;
}

function segmentSpeeds(property: AnimatedProperty, frames: readonly TimedKey[], segment: number, aspect: number | undefined, samples: number): GraphPoint[] | null {
  const distance = segmentDistance(property, frames, segment, aspect);
  if (distance === null) return null;
  const from = frames[segment];
  const to = frames[segment + 1];
  return Array.from({ length: samples + 1 }, (_, step) => ({ ms: from.atMs + ((to.atMs - from.atMs) * step) / samples, value: speedOn(property, from, to, distance, step / samples) }));
}

export function speedCurve(property: AnimatedProperty, frames: readonly TimedKey[], fromMs: number, toMs: number, aspect?: number, samples: number = GRAPH_SEGMENT_SAMPLES): GraphPoint[] {
  if (frames.length === 0) return [];
  const first = frames[0];
  const last = frames[frames.length - 1];
  const points: GraphPoint[] = [
    { ms: Math.min(fromMs, first.atMs), value: 0 },
    { ms: first.atMs, value: 0 },
  ];
  for (let segment = 0; segment < frames.length - 1; segment++) {
    const piece = segmentSpeeds(property, frames, segment, aspect, samples);
    if (!piece) return [];
    points.push(...piece);
  }
  points.push({ ms: last.atMs, value: 0 }, { ms: Math.max(toMs, last.atMs), value: 0 });
  return points;
}

export function peakSpeed(property: AnimatedProperty, frames: readonly TimedKey[], segment: number, aspect?: number): number | null {
  const samples = segmentSpeeds(property, frames, segment, aspect, PEAK_SAMPLES);
  return samples ? Math.max(...samples.map((point) => Math.abs(point.value))) : null;
}

export function readoutAt(k: Keyframes | undefined, property: AnimatedProperty, mode: GraphMode, ms: number, aspect?: number): number | null {
  const frames = timedFramesOf(k, property);
  if (frames.length === 0 || !graphable(property, mode)) return null;
  const segment = frames.findIndex((frame, index) => index < frames.length - 1 && ms >= frame.atMs && ms < frames[index + 1].atMs);
  if (mode === "value") {
    const numbers = frames as readonly Keyframe[];
    if (segment < 0) return ms < numbers[0].atMs ? numbers[0].value : numbers[numbers.length - 1].value;
    const from = numbers[segment];
    const to = numbers[segment + 1];
    return from.easing === "hold" ? from.value : from.value + (to.value - from.value) * ease(from.easing, (ms - from.atMs) / (to.atMs - from.atMs));
  }
  if (segment < 0) return 0;
  const distance = segmentDistance(property, frames, segment, aspect);
  const from = frames[segment];
  const to = frames[segment + 1];
  return distance === null ? null : speedOn(property, from, to, distance, (ms - from.atMs) / (to.atMs - from.atMs));
}

export function graphX(scale: GraphScale, ms: number): number {
  return keyX(ms, scale.durationMs, scale.widthPx);
}

export function msAtGraphX(scale: GraphScale, x: number): number {
  return scale.widthPx > 0 ? (x / scale.widthPx) * scale.durationMs : 0;
}

function innerHeight(scale: GraphScale): number {
  return Math.max(1, scale.heightPx - scale.padPx * 2);
}

export function graphY(scale: GraphScale, value: number): number {
  const span = scale.high - scale.low;
  return span > 0 ? scale.padPx + (1 - (value - scale.low) / span) * innerHeight(scale) : scale.heightPx / 2;
}

export function valueAtGraphY(scale: GraphScale, y: number): number {
  return scale.low + (1 - (y - scale.padPx) / innerHeight(scale)) * (scale.high - scale.low);
}

export function valuePerPx(scale: GraphScale): number {
  return (scale.high - scale.low) / innerHeight(scale);
}

export function fitRange(values: readonly number[], minSpan: number, pad: number = GRAPH_RANGE_PAD): readonly [number, number] {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return [-minSpan / 2, minSpan / 2];
  let low = Math.min(...finite);
  let high = Math.max(...finite);
  if (high - low < minSpan) {
    const middle = (low + high) / 2;
    low = middle - minSpan / 2;
    high = middle + minSpan / 2;
  }
  const margin = (high - low) * pad;
  return [low - margin, high + margin];
}

function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  const error = raw / power;
  if (error >= Math.sqrt(50)) return power * 10;
  if (error >= Math.sqrt(10)) return power * 5;
  return error >= Math.sqrt(2) ? power * 2 : power;
}

export function graphTicks(low: number, high: number, count: number): number[] {
  if (!(high > low) || count < 1) return [];
  const step = niceStep((high - low) / count);
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  const first = Math.ceil(low / step);
  const ticks: number[] = [];
  for (let index = first; index * step <= high + step * 1e-9; index++) ticks.push(Number((index * step).toFixed(decimals)) || 0);
  return ticks;
}

function minSpanOf(property: AnimatedProperty): number {
  if (!carriesValue(property)) return PATH_MIN_SPAN;
  const [low, high] = KEYFRAME_RANGES[property as KeyframeProperty];
  return (high - low) * MIN_SPAN_SHARE;
}

function segmentOfSide(frames: readonly TimedKey[], index: number, side: EaseSide): number | null {
  const segment = side === "out" ? index : index - 1;
  return segment >= 0 && segment < frames.length - 1 ? segment : null;
}

export function keyHandles(k: Keyframes | undefined, property: AnimatedProperty, atMs: number, mode: GraphMode, aspect?: number): GraphHandle[] {
  const frames = timedFramesOf(k, property);
  const index = frames.findIndex((frame) => frame.atMs === atMs);
  if (index < 0 || !graphable(property, mode)) return [];
  const velocity = mode === "speed" ? keyVelocity(k, property, atMs, aspect) : null;
  return (["in", "out"] as const).flatMap((side): GraphHandle[] => {
    const segment = segmentOfSide(frames, index, side);
    const found = keySide(k, property, atMs, side);
    if (segment === null || !found) return [];
    const span = frames[segment + 1].atMs - frames[segment].atMs;
    const direction = side === "out" ? 1 : -1;
    const ms = atMs + direction * found.influence * span;
    if (mode === "speed") {
      const speed = velocity?.[side]?.speed;
      return speed === null || speed === undefined ? [] : [{ side, point: { ms, value: isPathProperty(property) ? Math.abs(speed) : speed } }];
    }
    const delta = (frames[segment + 1] as Keyframe).value - (frames[segment] as Keyframe).value;
    return [{ side, point: { ms, value: (frames[index] as Keyframe).value + direction * found.rise * delta } }];
  });
}

function keyMarkValue(k: Keyframes | undefined, property: AnimatedProperty, frame: TimedKey, mode: GraphMode, aspect?: number): number {
  if (mode === "value") return (frame as Keyframe).value;
  const velocity = keyVelocity(k, property, frame.atMs, aspect);
  const speed = velocity?.out?.speed ?? velocity?.in?.speed ?? 0;
  return isPathProperty(property) ? Math.abs(speed) : speed;
}

export function graphRange(k: Keyframes | undefined, property: AnimatedProperty, mode: GraphMode, durationMs: number, aspect: number | undefined, handleTimes: readonly number[], only?: readonly number[]): readonly [number, number] {
  const frames = timedFramesOf(k, property);
  const handles = (times: readonly number[]) => times.flatMap((atMs) => keyHandles(k, property, atMs, mode, aspect).map((handle) => handle.point.value));
  const chosen = only && only.length > 0 ? frames.filter((frame) => only.includes(frame.atMs)) : null;
  const values = chosen
    ? [...chosen.map((frame) => keyMarkValue(k, property, frame, mode, aspect)), ...handles(chosen.map((frame) => frame.atMs))]
    : [...(mode === "value" ? valueCurve(frames as readonly Keyframe[], 0, durationMs) : speedCurve(property, frames, 0, durationMs, aspect)).map((point) => point.value), ...handles(handleTimes), ...(mode === "speed" ? [0] : [])];
  return fitRange(values, minSpanOf(property));
}

export function graphLayer(k: Keyframes | undefined, property: AnimatedProperty, mode: GraphMode, scale: GraphScale, aspect: number | undefined, handleTimes: readonly number[]): GraphLayer {
  const frames = timedFramesOf(k, property);
  const curve = mode === "value" ? valueCurve(frames as readonly Keyframe[], 0, scale.durationMs) : speedCurve(property, frames, 0, scale.durationMs, aspect);
  const keys = frames.map((frame) => ({ property, atMs: frame.atMs, x: graphX(scale, frame.atMs), y: graphY(scale, keyMarkValue(k, property, frame, mode, aspect)) }));
  const handles = keys
    .filter((mark) => handleTimes.includes(mark.atMs))
    .flatMap((mark) => keyHandles(k, property, mark.atMs, mode, aspect).map((handle) => ({ property, atMs: mark.atMs, side: handle.side, x: graphX(scale, handle.point.ms), y: graphY(scale, handle.point.value), keyXPx: mark.x, keyYPx: mark.y })));
  return { property, scale, points: curve.map((point) => [graphX(scale, point.ms), graphY(scale, point.value)]), keys, handles };
}

function nearest<T extends { x: number; y: number }>(marks: readonly T[], x: number, y: number, hitPx: number): { mark: T; distance: number } | null {
  let best: { mark: T; distance: number } | null = null;
  for (const mark of marks) {
    const distance = Math.hypot(mark.x - x, mark.y - y);
    if (distance <= hitPx && (!best || distance < best.distance)) best = { mark, distance };
  }
  return best;
}

export function graphHitAt(layers: readonly GraphLayer[], x: number, y: number, hitPx: number = GRAPH_HIT_PX): GraphHit | null {
  const handle = nearest(layers.flatMap((layer) => layer.handles), x, y, hitPx);
  if (handle) return { kind: "handle", property: handle.mark.property, atMs: handle.mark.atMs, side: handle.mark.side };
  const key = nearest(layers.flatMap((layer) => layer.keys), x, y, hitPx);
  return key ? { kind: "key", property: key.mark.property, atMs: key.mark.atMs } : null;
}

export function keysInGraphBox(layers: readonly GraphLayer[], box: GraphBox): KeyRef[] {
  return layers.flatMap((layer) => layer.keys.filter((mark) => mark.x >= box.left && mark.x <= box.right && mark.y >= box.top && mark.y <= box.bottom).map((mark) => ({ property: mark.property, atMs: mark.atMs })));
}

export function sidesJoined(k: Keyframes | undefined, property: AnimatedProperty, atMs: number, aspect?: number): boolean {
  const velocity = keyVelocity(k, property, atMs, aspect);
  const into = velocity?.in?.speed;
  const out = velocity?.out?.speed;
  if (into === null || into === undefined || out === null || out === undefined) return false;
  return Math.abs(into - out) <= JOIN_TOLERANCE * Math.max(1, Math.abs(into), Math.abs(out));
}

function opposite(side: EaseSide): EaseSide {
  return side === "out" ? "in" : "out";
}

function withPartner(base: Keyframes | undefined, next: Keyframes | undefined, property: AnimatedProperty, atMs: number, side: EaseSide, split: boolean, aspect?: number): Keyframes | undefined {
  if (split || next === base || !sidesJoined(base, property, atMs, aspect)) return next;
  const speed = keyVelocity(next, property, atMs, aspect)?.[side]?.speed;
  return speed === null || speed === undefined ? next : setKeySpeed(next, property, atMs, opposite(side), { speed }, aspect);
}

function sideSpan(frames: readonly TimedKey[], atMs: number, side: EaseSide): { index: number; segment: number; span: number } | null {
  const index = frames.findIndex((frame) => frame.atMs === atMs);
  const segment = index < 0 ? null : segmentOfSide(frames, index, side);
  return segment === null ? null : { index, segment, span: frames[segment + 1].atMs - frames[segment].atMs };
}

function influenceAt(atMs: number, side: EaseSide, ms: number, span: number): number {
  return (side === "out" ? ms - atMs : atMs - ms) / span;
}

export function dragValueHandle(base: Keyframes | undefined, property: AnimatedProperty, atMs: number, side: EaseSide, at: GraphPoint, split: boolean, aspect?: number): Keyframes | undefined {
  const frames = timedFramesOf(base, property);
  const found = sideSpan(frames, atMs, side);
  const current = keySide(base, property, atMs, side);
  if (!found || !current || !graphable(property, "value")) return base;
  const delta = (frames[found.segment + 1] as Keyframe).value - (frames[found.segment] as Keyframe).value;
  const value = (frames[found.index] as Keyframe).value;
  const rise = delta === 0 ? current.rise : (side === "out" ? at.value - value : value - at.value) / delta;
  const next = setKeySide(base, property, atMs, side, { influence: influenceAt(atMs, side, at.ms, found.span), rise });
  return withPartner(base, next, property, atMs, side, split, aspect);
}

export function dragSpeedHandle(base: Keyframes | undefined, property: AnimatedProperty, atMs: number, side: EaseSide, at: GraphPoint, split: boolean, aspect?: number): Keyframes | undefined {
  const frames = timedFramesOf(base, property);
  const found = sideSpan(frames, atMs, side);
  if (!found || !graphable(property, "speed")) return base;
  const speed = isPathProperty(property) ? Math.max(0, at.value) : at.value;
  const next = setKeySpeed(base, property, atMs, side, { speed, influence: influenceAt(atMs, side, at.ms, found.span) }, aspect);
  return withPartner(base, next, property, atMs, side, split, aspect);
}

export function nudgeHandle(k: Keyframes | undefined, property: AnimatedProperty, atMs: number, side: EaseSide, mode: GraphMode, offset: HandleOffset, split: boolean, aspect?: number): Keyframes | undefined {
  const handle = keyHandles(k, property, atMs, mode, aspect).find((candidate) => candidate.side === side);
  const found = sideSpan(timedFramesOf(k, property), atMs, side);
  if (!handle || !found) return k;
  const point = { ms: handle.point.ms + (side === "out" ? 1 : -1) * offset.influence * found.span, value: handle.point.value + offset.value };
  return mode === "value" ? dragValueHandle(k, property, atMs, side, point, split, aspect) : dragSpeedHandle(k, property, atMs, side, point, split, aspect);
}

export function selectionBox(marks: readonly { x: number; y: number }[]): GraphBox | null {
  if (marks.length < 2) return null;
  const xs = marks.map((mark) => mark.x);
  const ys = marks.map((mark) => mark.y);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

export function boxGripAt(box: GraphBox, x: number, y: number, gripPx: number = GRAPH_GRIP_PX): BoxGrip | null {
  if (x < box.left - gripPx || x > box.right + gripPx || y < box.top - gripPx || y > box.bottom + gripPx) return null;
  const left = Math.abs(x - box.left) <= gripPx;
  const right = !left && Math.abs(x - box.right) <= gripPx;
  const top = Math.abs(y - box.top) <= gripPx;
  const bottom = !top && Math.abs(y - box.bottom) <= gripPx;
  if (top && left) return "topLeft";
  if (top && right) return "topRight";
  if (bottom && left) return "bottomLeft";
  if (bottom && right) return "bottomRight";
  if (left) return "left";
  if (right) return "right";
  if (top) return "top";
  return bottom ? "bottom" : "move";
}

function axisScale(size: number, change: number): number {
  return size > 0 ? (size + change) / size : 1;
}

export function boxPixelTransform(box: GraphBox, grip: BoxGrip, dx: number, dy: number): PixelTransform {
  const transform: PixelTransform = { pivotX: 0, scaleX: 1, offsetX: 0, pivotY: 0, scaleY: 1, offsetY: 0 };
  if (grip === "move") return { ...transform, offsetX: dx, offsetY: dy };
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  if (grip === "left" || grip === "topLeft" || grip === "bottomLeft") Object.assign(transform, { pivotX: box.right, scaleX: axisScale(width, -dx) });
  if (grip === "right" || grip === "topRight" || grip === "bottomRight") Object.assign(transform, { pivotX: box.left, scaleX: axisScale(width, dx) });
  if (grip === "top" || grip === "topLeft" || grip === "topRight") Object.assign(transform, { pivotY: box.bottom, scaleY: axisScale(height, -dy) });
  if (grip === "bottom" || grip === "bottomLeft" || grip === "bottomRight") Object.assign(transform, { pivotY: box.top, scaleY: axisScale(height, dy) });
  return { ...transform, scaleX: Math.max(MIN_BOX_SCALE, transform.scaleX) };
}

export function graphTransform(pixel: PixelTransform, scales: Partial<Record<AnimatedProperty, GraphScale>>, mode: GraphMode): KeyTransform {
  const entries = Object.entries(scales) as [AnimatedProperty, GraphScale][];
  const any = entries[0]?.[1];
  const time: AxisMap = any ? { pivot: msAtGraphX(any, pixel.pivotX), scale: pixel.scaleX, offset: msAtGraphX(any, pixel.offsetX) } : { pivot: 0, scale: 1, offset: 0 };
  if (mode === "speed") return { time };
  const values = Object.fromEntries(entries.filter(([property]) => graphable(property, "value")).map(([property, scale]) => [property, { pivot: valueAtGraphY(scale, pixel.pivotY), scale: pixel.scaleY, offset: -pixel.offsetY * valuePerPx(scale) }]));
  return { time, values };
}

export function axisLocked(dx: number, dy: number): { dx: number; dy: number } {
  return Math.abs(dx) >= Math.abs(dy) ? { dx, dy: 0 } : { dx: 0, dy };
}
