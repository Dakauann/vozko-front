import type { Clip, ClipType } from "./document";
import type { IssueCode } from "./validate";
import { curveExtent, ease, valueAt, type Keyframe } from "./keyframes";
import { SPEED_LIMITS } from "./speed-range";

export { SPEED_LIMITS };

export function clipTime(clip: Pick<Clip, "startMs" | "durationMs">, playheadMs: number): number {
  return Math.min(Math.max(0, playheadMs - clip.startMs), clip.durationMs);
}

export const REVERSE_INSET_MS = 2;

const SOURCED: ReadonlySet<ClipType> = new Set(["video", "audio", "group"]);

type Timed = Pick<Clip, "type" | "durationMs" | "trimInMs" | "speed" | "reverse" | "freeze" | "keyframes">;

type Paced = Pick<Clip, "speed" | "freeze" | "keyframes">;

const GAUSS_NODES = [0.0694318442029737, 0.3300094782075719, 0.6699905217924281, 0.9305681557970263] as const;
const GAUSS_WEIGHTS = [0.1739274225687269, 0.3260725774312731, 0.3260725774312731, 0.1739274225687269] as const;
const GAUSS_PIECES = 24;
const SOLVE_STEPS = 60;
const SOLVE_TOLERANCE_MS = 1e-7;

export function speedKeys(clip: Pick<Clip, "keyframes">): readonly Keyframe[] {
  return clip.keyframes?.speed ?? [];
}

export function hasSpeedCurve(clip: Pick<Clip, "keyframes">): boolean {
  return speedKeys(clip).length > 0;
}

export function speedAt(clip: Paced, localMs: number): number {
  if (clip.freeze) return 0;
  const keys = speedKeys(clip);
  return keys.length > 0 ? valueAt(keys, localMs) : clipSpeed(clip);
}

function easedArea(from: Keyframe, u0: number, u1: number): number {
  if (u1 <= u0) return 0;
  if (from.easing === "linear") return (u1 * u1 - u0 * u0) / 2;
  if (from.easing === "hold") return 0;
  const pieces = Math.max(1, Math.ceil(GAUSS_PIECES * (u1 - u0)));
  const width = (u1 - u0) / pieces;
  let area = 0;
  for (let p = 0; p < pieces; p++) {
    const start = u0 + p * width;
    for (let n = 0; n < GAUSS_NODES.length; n++) area += GAUSS_WEIGHTS[n] * ease(from.easing, start + GAUSS_NODES[n] * width);
  }
  return area * width;
}

function segmentArea(keys: readonly Keyframe[], index: number, fromMs: number, toMs: number): number {
  const from = keys[index];
  const to = keys[index + 1];
  const length = to.atMs - from.atMs;
  const u0 = (fromMs - from.atMs) / length;
  const u1 = (toMs - from.atMs) / length;
  return (toMs - fromMs) * from.value + (to.value - from.value) * length * easedArea(from, u0, u1);
}

const totalsCache = new WeakMap<readonly Keyframe[], number[]>();

function totalsOf(keys: readonly Keyframe[]): number[] {
  const known = totalsCache.get(keys);
  if (known) return known;
  const totals = [0];
  for (let i = 0; i < keys.length - 1; i++) totals.push(totals[i] + segmentArea(keys, i, keys[i].atMs, keys[i + 1].atMs));
  totalsCache.set(keys, totals);
  return totals;
}

function segmentAt(keys: readonly Keyframe[], atMs: number): number {
  let low = 0;
  let high = keys.length - 2;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (keys[middle].atMs <= atMs) low = middle;
    else high = middle - 1;
  }
  return low;
}

function areaTo(keys: readonly Keyframe[], atMs: number): number {
  const first = keys[0];
  const last = keys[keys.length - 1];
  const totals = totalsOf(keys);
  if (atMs <= first.atMs) return (atMs - first.atMs) * first.value;
  if (atMs >= last.atMs) return totals[totals.length - 1] + (atMs - last.atMs) * last.value;
  const index = segmentAt(keys, atMs);
  return totals[index] + segmentArea(keys, index, keys[index].atMs, atMs);
}

export function travelAlong(keys: readonly Keyframe[], fromMs: number, toMs: number): number {
  return areaTo(keys, toMs) - areaTo(keys, fromMs);
}

export function timeAfterTravel(keys: readonly Keyframe[], fromMs: number, distance: number): number {
  const target = areaTo(keys, fromMs) + distance;
  const first = keys[0];
  const last = keys[keys.length - 1];
  const totals = totalsOf(keys);
  const total = totals[totals.length - 1];
  if (target <= 0) return first.atMs + target / first.value;
  if (target >= total) return last.atMs + (target - total) / last.value;
  let index = 0;
  while (index < totals.length - 2 && totals[index + 1] <= target) index++;
  let low = keys[index].atMs;
  let high = keys[index + 1].atMs;
  for (let step = 0; step < SOLVE_STEPS && high - low > SOLVE_TOLERANCE_MS; step++) {
    const middle = (low + high) / 2;
    if (totals[index] + segmentArea(keys, index, keys[index].atMs, middle) < target) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

export function travelMs(clip: Paced, fromMs: number, toMs: number): number {
  if (clip.freeze) return 0;
  const keys = speedKeys(clip);
  return keys.length > 0 ? travelAlong(keys, fromMs, toMs) : (toMs - fromMs) * clipSpeed(clip);
}

export function localAfterTravel(clip: Paced, fromMs: number, distance: number): number {
  if (clip.freeze) return fromMs;
  const keys = speedKeys(clip);
  return keys.length > 0 ? timeAfterTravel(keys, fromMs, distance) : fromMs + distance / clipSpeed(clip);
}

export function stretchedCurve(keys: readonly Keyframe[], ratio: number): Keyframe[] {
  return keys.map((key) => ({ ...key, atMs: Math.round(key.atMs * ratio), value: key.value / ratio })).filter((key, i, all) => i === all.length - 1 || all[i + 1].atMs > key.atMs);
}

export function sameFootage(before: Paced, after: Paced): (atMs: number) => number {
  return (atMs) => localAfterTravel(after, 0, travelMs(before, 0, atMs));
}

export function sourceTable(clip: Paced, fromMs: number, toMs: number, stepMs: number): Float64Array {
  const count = Math.max(1, Math.ceil((toMs - fromMs) / stepMs)) + 1;
  const table = new Float64Array(count);
  for (let i = 1; i < count; i++) table[i] = table[i - 1] + travelMs(clip, fromMs + (i - 1) * stepMs, fromMs + i * stepMs);
  return table;
}

export function hasSourceTime(type: ClipType): boolean {
  return SOURCED.has(type);
}

export function fadeLevel(clip: Pick<Clip, "durationMs" | "fadeInMs" | "fadeOutMs">, localMs: number): number {
  if (localMs < 0 || localMs > clip.durationMs) return 0;
  let level = 1;
  if (clip.fadeInMs > 0 && localMs < clip.fadeInMs) level = Math.min(level, localMs / clip.fadeInMs);
  const remaining = clip.durationMs - localMs;
  if (clip.fadeOutMs > 0 && remaining < clip.fadeOutMs) level = Math.min(level, remaining / clip.fadeOutMs);
  return Math.max(0, Math.min(1, level));
}

export function clipSpeed(clip: Pick<Clip, "speed">): number {
  return clip.speed ?? 1;
}

export function retimed(clip: Pick<Clip, "speed" | "reverse" | "freeze" | "keyframes">): boolean {
  return clipSpeed(clip) !== 1 || Boolean(clip.reverse) || Boolean(clip.freeze) || hasSpeedCurve(clip);
}

export function sourceSpanMs(clip: Pick<Clip, "durationMs" | "speed" | "freeze" | "keyframes">): number {
  return clip.freeze ? 0 : Math.round(travelMs(clip, 0, clip.durationMs));
}

export function sourceAt(clip: Timed, localMs: number): number {
  if (!hasSourceTime(clip.type) || clip.freeze) return clip.trimInMs;
  const travelled = travelMs(clip, 0, localMs);
  if (!clip.reverse) return clip.trimInMs + travelled;
  return clip.trimInMs + Math.max(0, sourceSpanMs(clip) - REVERSE_INSET_MS - travelled);
}

export function localAtSource(clip: Pick<Clip, "durationMs" | "trimInMs" | "speed" | "reverse" | "freeze" | "keyframes">, sourceMs: number): number {
  if (!clip.reverse) return localAfterTravel(clip, 0, sourceMs - clip.trimInMs);
  return localAfterTravel(clip, 0, clip.trimInMs + sourceSpanMs(clip) - sourceMs);
}

function roomBefore(clip: Timed, sourceMs: number): number {
  return sourceMs === Infinity ? Infinity : -localAfterTravel(clip, 0, -Math.max(0, sourceMs));
}

function roomAfter(clip: Timed, sourceMs: number): number {
  return sourceMs === Infinity ? Infinity : localAfterTravel(clip, clip.durationMs, Math.max(0, sourceMs)) - clip.durationMs;
}

function afterWindow(clip: Timed, sourceDurationMs: number | undefined): number {
  return sourceDurationMs === undefined ? Infinity : sourceDurationMs - clip.trimInMs - sourceSpanMs(clip);
}

export function headroomMs(clip: Timed, sourceDurationMs: number | undefined): number {
  if (!hasSourceTime(clip.type) || clip.freeze) return Infinity;
  return roomBefore(clip, clip.reverse ? afterWindow(clip, sourceDurationMs) : clip.trimInMs);
}

export function tailroomMs(clip: Timed, sourceDurationMs: number | undefined): number {
  if (!hasSourceTime(clip.type) || clip.freeze) return Infinity;
  return roomAfter(clip, clip.reverse ? clip.trimInMs : afterWindow(clip, sourceDurationMs));
}

export function trimInAfterEdge(clip: Timed, edge: "start" | "end", removedMs: number): number {
  if (!hasSourceTime(clip.type) || clip.freeze) return clip.trimInMs;
  if (edge === "start") return clip.reverse ? clip.trimInMs : Math.round(clip.trimInMs + travelMs(clip, 0, removedMs));
  return clip.reverse ? Math.round(clip.trimInMs + travelMs(clip, clip.durationMs - removedMs, clip.durationMs)) : clip.trimInMs;
}

export function splitTrimIns(clip: Timed, atLocalMs: number): { left: number; right: number } {
  if (!hasSourceTime(clip.type) || clip.freeze) return { left: clip.trimInMs, right: clip.trimInMs };
  if (!clip.reverse) return { left: clip.trimInMs, right: trimInAfterEdge(clip, "start", atLocalMs) };
  return { left: trimInAfterEdge(clip, "end", clip.durationMs - atLocalMs), right: clip.trimInMs };
}

export function speedCurveIssue(clip: Pick<Clip, "type" | "speed" | "freeze" | "keyframes">): IssueCode | null {
  const keys = speedKeys(clip);
  if (keys.length === 0) return null;
  if ((clip.type !== "video" && clip.type !== "audio") || clip.speed !== undefined || clip.freeze) return "invalid";
  const [low, high] = curveExtent(keys);
  return low >= SPEED_LIMITS[0] && high <= SPEED_LIMITS[1] ? null : "out_of_range";
}

export function frameMixIssue(clip: Pick<Clip, "type" | "freeze" | "frameMix">): IssueCode | null {
  return clip.frameMix && (clip.type !== "video" || clip.freeze) ? "invalid" : null;
}

export function speedIssue(clip: Pick<Clip, "type" | "speed" | "reverse" | "freeze" | "preservePitch" | "keyframes" | "frameMix">): IssueCode | null {
  const curve = speedCurveIssue(clip) ?? frameMixIssue(clip);
  if (curve) return curve;
  const touched = clip.speed !== undefined || Boolean(clip.reverse) || Boolean(clip.freeze) || clip.preservePitch !== undefined;
  if (!touched) return null;
  if (!hasSourceTime(clip.type)) return "invalid";
  if (clip.speed !== undefined && !(Number.isFinite(clip.speed) && clip.speed >= SPEED_LIMITS[0] && clip.speed <= SPEED_LIMITS[1])) return "out_of_range";
  if (clip.freeze && (clip.type !== "video" || clip.speed !== undefined || clip.reverse)) return "invalid";
  if (clip.type === "group" && (clip.reverse || clip.freeze || clip.preservePitch !== undefined)) return "invalid";
  return null;
}
