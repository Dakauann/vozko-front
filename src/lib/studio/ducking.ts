import { produce } from "immer";

import { MAX_GAIN_DB, SILENCE_DB } from "./audio-gain";
import { localAtSource, sourceSpanMs } from "./clip-time";
import type { Clip, Track, VideoDocument } from "./document";
import { valueAt, type Keyframe } from "./keyframes";
import { nestedTracks } from "./group-scope";
import type { IssueCode } from "./validate";

export interface DuckingRule {
  triggerTrackIds: string[];
  reduceDb: number;
  attackMs: number;
  releaseMs: number;
  holdMs: number;
  sensitivity: number;
}

type DuckingSettings = Omit<DuckingRule, "triggerTrackIds">;

export const DUCKING_DEFAULTS: DuckingSettings = { reduceDb: 12, attackMs: 250, releaseMs: 500, holdMs: 300, sensitivity: 0.5 };

export const DUCKING_RANGES: Record<keyof DuckingSettings, readonly [number, number]> = {
  reduceDb: [1, 40],
  attackMs: [0, 2000],
  releaseMs: [0, 3000],
  holdMs: [0, 2000],
  sensitivity: [0, 1],
};

export const TRACK_GAIN_RANGE = [SILENCE_DB, MAX_GAIN_DB] as const;

export interface SpeechAnalysis {
  windowMs: number;
  levelsDb: Float32Array;
}

export interface TimeRegion {
  fromMs: number;
  toMs: number;
}

export type SpeechSource = (assetId: string) => SpeechAnalysis | undefined;

const WINDOW_MS = 20;
const HIGH_PASS_HZ = 100;
const SILENT_DB = -120;
const FLOOR_DB = -55;
const HYSTERESIS_DB = 3;
const MIN_REGION_MS = 120;
const PERCENTILE = 0.95;
const BASE_MARGIN_DB = 6;
const SENSITIVITY_MARGIN_DB = 24;
const EASED_SAMPLE_MS = 100;

export function analyzeSpeech(samples: Float32Array, sampleRate: number): SpeechAnalysis {
  const window = Math.max(1, Math.round((WINDOW_MS * sampleRate) / 1000));
  const rc = 1 / (2 * Math.PI * HIGH_PASS_HZ);
  const alpha = rc / (rc + 1 / sampleRate);
  const levels = new Float32Array(Math.ceil(samples.length / window));
  let previousIn = 0;
  let previousOut = 0;
  for (let w = 0; w < levels.length; w++) {
    let energy = 0;
    const end = Math.min(samples.length, (w + 1) * window);
    for (let i = w * window; i < end; i++) {
      const out = alpha * (previousOut + samples[i] - previousIn);
      previousIn = samples[i];
      previousOut = out;
      energy += out * out;
    }
    const rms = Math.sqrt(energy / Math.max(1, end - w * window));
    levels[w] = rms > 0 ? Math.max(SILENT_DB, 20 * Math.log10(rms)) : SILENT_DB;
  }
  return { windowMs: WINDOW_MS, levelsDb: levels };
}

export function mergeRegions(regions: readonly TimeRegion[], gapMs: number): TimeRegion[] {
  const sorted = [...regions].sort((a, b) => a.fromMs - b.fromMs);
  const merged: TimeRegion[] = [];
  for (const region of sorted) {
    const last = merged[merged.length - 1];
    if (last && region.fromMs - last.toMs < gapMs) last.toMs = Math.max(last.toMs, region.toMs);
    else merged.push({ ...region });
  }
  return merged;
}

function percentile(levels: Float32Array, share: number): number {
  const sorted = Float32Array.from(levels).sort();
  return sorted.length === 0 ? SILENT_DB : sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))];
}

export function speechRegions(analysis: SpeechAnalysis, sensitivity: number, holdMs: number): TimeRegion[] {
  const threshold = Math.max(FLOOR_DB, percentile(analysis.levelsDb, PERCENTILE) - (BASE_MARGIN_DB + SENSITIVITY_MARGIN_DB * sensitivity));
  const found: TimeRegion[] = [];
  let open: number | null = null;
  analysis.levelsDb.forEach((level, w) => {
    if (open === null && level > threshold) open = w;
    else if (open !== null && level < threshold - HYSTERESIS_DB) {
      found.push({ fromMs: open * analysis.windowMs, toMs: w * analysis.windowMs });
      open = null;
    }
  });
  if (open !== null) found.push({ fromMs: open * analysis.windowMs, toMs: analysis.levelsDb.length * analysis.windowMs });
  return mergeRegions(
    found.filter((region) => region.toMs - region.fromMs >= MIN_REGION_MS),
    holdMs,
  );
}

function audibleTrigger(track: Track): boolean {
  return track.kind === "audio" && !track.muted && !track.hidden;
}

function clipSpeech(clip: Clip, analysis: SpeechAnalysis, rule: DuckingRule): TimeRegion[] {
  const windowFrom = clip.trimInMs;
  const windowTo = clip.trimInMs + sourceSpanMs(clip);
  return speechRegions(analysis, rule.sensitivity, rule.holdMs).flatMap((region) => {
    const from = Math.max(region.fromMs, windowFrom);
    const to = Math.min(region.toMs, windowTo);
    if (to <= from) return [];
    const a = clip.startMs + localAtSource(clip, from);
    const b = clip.startMs + localAtSource(clip, to);
    return [{ fromMs: Math.max(clip.startMs, Math.min(a, b)), toMs: Math.min(clip.startMs + clip.durationMs, Math.max(a, b)) }];
  });
}

export function timelineSpeech(doc: VideoDocument, rule: DuckingRule, speechOf: SpeechSource): TimeRegion[] {
  const triggers = doc.tracks.filter((track) => rule.triggerTrackIds.includes(track.id) && audibleTrigger(track));
  const regions = triggers.flatMap((track) =>
    track.clips.flatMap((clip) => {
      const analysis = clip.assetId && !clip.disabled && clip.volume > 0 ? speechOf(clip.assetId) : undefined;
      return analysis ? clipSpeech(clip, analysis, rule) : [];
    }),
  );
  return mergeRegions(regions, rule.holdMs);
}

export function duckDb(regions: readonly TimeRegion[], rule: Pick<DuckingRule, "reduceDb" | "attackMs" | "releaseMs">, ms: number): number {
  let depth = 0;
  for (const region of regions) {
    if (ms >= region.fromMs && ms <= region.toMs) return rule.reduceDb;
    if (ms < region.fromMs && rule.attackMs > 0 && ms >= region.fromMs - rule.attackMs) depth = Math.max(depth, (rule.reduceDb * (ms - (region.fromMs - rule.attackMs))) / rule.attackMs);
    if (ms > region.toMs && rule.releaseMs > 0 && ms <= region.toMs + rule.releaseMs) depth = Math.max(depth, rule.reduceDb * (1 - (ms - region.toMs) / rule.releaseMs));
  }
  return depth;
}

function within(value: number, [low, high]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= low && value <= high;
}

function ducksUnder(doc: VideoDocument, trackId: string, target: string, seen: Set<string>): boolean {
  const triggers = doc.tracks.find((track) => track.id === trackId)?.ducking?.triggerTrackIds ?? [];
  return triggers.some((id) => {
    if (id === target) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return ducksUnder(doc, id, target, seen);
  });
}

export function duckingIssue(track: Track, doc: VideoDocument): IssueCode | null {
  const rule = track.ducking;
  if (!rule) return null;
  if (track.kind !== "audio") return "invalid";
  const ids = rule.triggerTrackIds;
  const audio = new Set(doc.tracks.filter((t) => t.kind === "audio" && t.id !== track.id).map((t) => t.id));
  if (ids.length === 0 || new Set(ids).size !== ids.length || ids.some((id) => !audio.has(id))) return "invalid";
  if ((Object.keys(DUCKING_RANGES) as (keyof DuckingSettings)[]).some((key) => !within(rule[key], DUCKING_RANGES[key]))) return "out_of_range";
  return ducksUnder(doc, track.id, track.id, new Set()) ? "invalid" : null;
}

export function trackGainIssue(track: Track): IssueCode | null {
  if (track.gainDb === undefined) return null;
  if (track.kind !== "audio") return "invalid";
  return within(track.gainDb, TRACK_GAIN_RANGE) ? null : "out_of_range";
}

function bakedLane(clip: Clip, regions: readonly TimeRegion[], rule: DuckingRule): Keyframe[] {
  const existing = clip.keyframes?.gainDb ?? [];
  const local = (ms: number) => Math.round(ms - clip.startMs);
  const inside = (ms: number) => ms >= 0 && ms <= clip.durationMs;
  const times = new Set<number>([0, clip.durationMs, ...existing.map((key) => key.atMs)]);
  for (const region of regions) for (const ms of [region.fromMs - rule.attackMs, region.fromMs, region.toMs, region.toMs + rule.releaseMs]) if (inside(local(ms))) times.add(local(ms));
  if (existing.some((key) => key.easing !== "linear")) for (let ms = 0; ms < clip.durationMs; ms += EASED_SAMPLE_MS) times.add(ms);
  return [...times]
    .sort((a, b) => a - b)
    .map((atMs) => {
      const lane = existing.length > 0 ? valueAt(existing, atMs) : 0;
      return { atMs, value: Math.min(MAX_GAIN_DB, Math.max(SILENCE_DB, lane - duckDb(regions, rule, clip.startMs + atMs))), easing: "linear" as const };
    });
}

type BakeResult = { ok: true; document: VideoDocument; keys: number } | { ok: false; reason: "missing" };

export function bakeDucking(doc: VideoDocument, trackId: string, speechOf: SpeechSource): BakeResult {
  const track = doc.tracks.find((t) => t.id === trackId);
  if (!track?.ducking) return { ok: false, reason: "missing" };
  const rule = track.ducking;
  const regions = timelineSpeech(doc, rule, speechOf);
  const lanes = new Map(track.clips.map((clip) => [clip.id, regions.length > 0 ? bakedLane(clip, regions, rule) : null]));
  const document = produce(doc, (draft) => {
    const target = draft.tracks.find((t) => t.id === trackId)!;
    delete target.ducking;
    for (const clip of target.clips) {
      const lane = lanes.get(clip.id);
      if (lane) clip.keyframes = { ...clip.keyframes, gainDb: lane };
    }
  });
  return { ok: true, document, keys: [...lanes.values()].reduce((sum, lane) => sum + (lane?.length ?? 0), 0) };
}

export function triggerAssetIds(doc: VideoDocument): string[] {
  const tracks = [...nestedTracks(doc.tracks)].map(({ track }) => track);
  const triggers = new Set(tracks.flatMap((track) => track.ducking?.triggerTrackIds ?? []));
  const ids = tracks.filter((track) => triggers.has(track.id)).flatMap((track) => track.clips.flatMap((clip) => (clip.assetId ? [clip.assetId] : [])));
  return [...new Set(ids)];
}

export function withDucking(current: DuckingRule | undefined, change: Partial<DuckingRule>): DuckingRule {
  return { triggerTrackIds: current?.triggerTrackIds ?? [], ...DUCKING_DEFAULTS, ...current, ...Object.fromEntries(Object.entries(change).filter(([, value]) => value !== undefined)) };
}
