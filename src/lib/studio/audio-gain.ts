import { windowLevel, type CrossfadeWindow } from "./audio-crossfade";
import { fadeLevel } from "./clip-time";
import type { Clip } from "./document";
import { KEYFRAME_RANGES, valueAt } from "./keyframes";

export const SILENCE_DB = KEYFRAME_RANGES.gainDb[0];
export const MAX_GAIN_DB = KEYFRAME_RANGES.gainDb[1];
export const GAIN_SAMPLE_MS = 10;
const FLAT = 1e-6;

export interface GainPoint {
  atMs: number;
  value: number;
}

export interface GainContext {
  trackGainDb: number;
  duckDb?: (timelineMs: number) => number;
  fadeIn?: CrossfadeWindow;
  fadeOut?: CrossfadeWindow;
}

type GainedClip = Pick<Clip, "startMs" | "durationMs" | "fadeInMs" | "fadeOutMs" | "volume" | "keyframes">;

export function dbToGain(db: number): number {
  return db <= SILENCE_DB ? 0 : 10 ** (db / 20);
}

export function gainToDb(gain: number): number {
  return gain <= dbToGain(SILENCE_DB + FLAT) ? SILENCE_DB : 20 * Math.log10(gain);
}

export function gainEnvelope(clip: Pick<Clip, "durationMs" | "fadeInMs" | "fadeOutMs" | "volume">, fromLocalMs: number): GainPoint[] {
  const marks = [fromLocalMs];
  if (clip.fadeInMs > 0) marks.push(clip.fadeInMs);
  if (clip.fadeOutMs > 0) marks.push(clip.durationMs - clip.fadeOutMs);
  marks.push(clip.durationMs);
  const unique = [...new Set(marks.filter((mark) => mark >= fromLocalMs && mark <= clip.durationMs))].sort((a, b) => a - b);
  return unique.map((mark) => ({ atMs: mark - fromLocalMs, value: clip.volume * fadeLevel(clip, mark) }));
}

function laneDb(clip: Pick<Clip, "keyframes">, localMs: number): number {
  const frames = clip.keyframes?.gainDb ?? [];
  return frames.length === 0 ? 0 : Math.min(MAX_GAIN_DB, Math.max(SILENCE_DB, valueAt(frames, localMs)));
}

export function withoutFlatRuns(points: readonly GainPoint[]): GainPoint[] {
  return points.filter((point, i) => i === 0 || i === points.length - 1 || Math.abs(point.value - points[i - 1].value) > FLAT || Math.abs(point.value - points[i + 1].value) > FLAT);
}

function edgeLevel(clip: GainedClip, localMs: number, context: GainContext): number {
  const inside = localMs >= 0 && localMs <= clip.durationMs ? fadeLevel(clip, localMs) : 1;
  const into = context.fadeIn ? windowLevel(context.fadeIn, localMs) : 1;
  const out = context.fadeOut ? windowLevel(context.fadeOut, localMs) : 1;
  return inside * into * out;
}

export function gainAt(clip: GainedClip, localMs: number, context: GainContext): number {
  const duck = context.duckDb ? context.duckDb(clip.startMs + localMs) : 0;
  return clip.volume * dbToGain(laneDb(clip, localMs)) * edgeLevel(clip, localMs, context) * dbToGain(-duck) * dbToGain(context.trackGainDb);
}

export function gainPoints(clip: GainedClip, fromLocalMs: number, context: GainContext, toLocalMs: number = clip.durationMs): GainPoint[] {
  const lane = clip.keyframes?.gainDb ?? [];
  const automated = lane.length > 0 || context.duckDb !== undefined || context.fadeIn !== undefined || context.fadeOut !== undefined;
  if (!automated) return gainEnvelope(clip, fromLocalMs).map((point) => ({ ...point, value: point.value * dbToGain(context.trackGainDb) }));
  const points: GainPoint[] = [];
  for (let local = fromLocalMs; ; local = Math.min(local + GAIN_SAMPLE_MS, toLocalMs)) {
    points.push({ atMs: local - fromLocalMs, value: gainAt(clip, local, context) });
    if (local >= toLocalMs) break;
  }
  return withoutFlatRuns(points);
}
