import { produce } from "immer";

import { SILENCE_DB } from "../audio-gain";
import { SILENT_DB, type Levels } from "../audio-meter";
import type { VideoDocument } from "../document";
import type { TimeRegion } from "../ducking";
import { audioPlan } from "../playback";
import { argsOf, defined, numberField, textList } from "./args";

const DEFAULT_LISTEN_WINDOW_MS = 1000;
const LISTEN_WINDOW_RANGE = [250, 10_000] as const;
export const MAX_LISTEN_WINDOWS = 120;
const VOICE_OVER_MUSIC_DB = 10;
const SILENCE_LUFS = -60;
const WINDOW_STEP_MS = 250;
const SPEECH_SHARE = 0.25;
const MAX_LISTED_RANGES = 30;
const BALANCE_SHOWN_DB = 1;

interface ListenRequest {
  from_ms?: number;
  to_ms?: number;
  window_ms?: number;
  voice_track_ids?: string[];
}

export function listenRequestOf(value: unknown): ListenRequest {
  const args = argsOf(value);
  return defined({ from_ms: numberField(args.from_ms), to_ms: numberField(args.to_ms), window_ms: numberField(args.window_ms), voice_track_ids: textList(args.voice_track_ids) });
}

export interface ListenRange {
  fromMs: number;
  toMs: number;
  windowMs: number;
}

export type ListenPlan = ({ ok: true; voiceTrackIds: string[] } & ListenRange) | { ok: false; code: string; reason: string };

export function audibleTrackIds(doc: VideoDocument): string[] {
  const trackOf = new Map(doc.tracks.flatMap((track) => track.clips.map((clip) => [clip.id, track.id] as const)));
  const heard = new Set(audioPlan(doc, 0).map((voice) => trackOf.get(voice.clipId)));
  return doc.tracks.filter((track) => heard.has(track.id)).map((track) => track.id);
}

function duckingTriggers(doc: VideoDocument, audible: readonly string[]): string[] {
  const triggers = new Set(doc.tracks.flatMap((track) => track.ducking?.triggerTrackIds ?? []));
  return audible.filter((id) => triggers.has(id));
}

function windowFor(rangeMs: number, requested: number | undefined): number {
  const [low, high] = LISTEN_WINDOW_RANGE;
  const wanted = Math.min(high, Math.max(low, Math.round(requested ?? DEFAULT_LISTEN_WINDOW_MS)));
  const smallest = Math.ceil(rangeMs / MAX_LISTEN_WINDOWS / WINDOW_STEP_MS) * WINDOW_STEP_MS;
  return Math.max(wanted, smallest);
}

export function listenPlan(doc: VideoDocument, request: ListenRequest): ListenPlan {
  const audible = audibleTrackIds(doc);
  if (audible.length === 0) return { ok: false, code: "no_audio", reason: "o vídeo não tem som audível: nenhuma faixa de áudio com clipe, ou todas mudas ou ocultas" };
  const fromMs = Math.max(0, Math.round(request.from_ms ?? 0));
  const toMs = Math.min(doc.durationMs, Math.round(request.to_ms ?? doc.durationMs));
  if (toMs <= fromMs) return { ok: false, code: "invalid_range", reason: "to_ms precisa ser maior que from_ms e cair dentro do vídeo" };
  const named = request.voice_track_ids ?? [];
  const unknown = named.filter((id) => !audible.includes(id));
  if (unknown.length > 0) return { ok: false, code: "invalid_voice", reason: `voice_track_ids aceita só faixas de áudio que tocam: ${unknown.join(", ")} não serve; as faixas com som são ${audible.join(", ")}` };
  const voiceTrackIds = named.length > 0 ? [...new Set(named)] : duckingTriggers(doc, audible);
  return { ok: true, fromMs, toMs, windowMs: windowFor(toMs - fromMs, request.window_ms), voiceTrackIds };
}

export function stemDocument(doc: VideoDocument, trackId: string): VideoDocument {
  return produce(doc, (draft) => {
    for (const track of draft.tracks) if (track.kind === "audio" && track.id !== trackId) track.gainDb = SILENCE_DB;
  });
}

export function windowSpans(range: ListenRange): TimeRegion[] {
  const spans: TimeRegion[] = [];
  for (let from = range.fromMs; from < range.toMs; from += range.windowMs) spans.push({ fromMs: from, toMs: Math.min(range.toMs, from + range.windowMs) });
  return spans;
}

export interface MeasuredMix {
  integrated: number | null;
  windows: Levels[];
  limiterMs: number[];
}

export interface MeasuredStem {
  trackId: string;
  name?: string;
  integrated: number | null;
  windows: Levels[];
}

interface ListenInput {
  plan: { voiceTrackIds: string[] } & ListenRange;
  mix: MeasuredMix;
  stems: MeasuredStem[];
  speech: TimeRegion[];
}

export interface ListenWindow {
  from_ms: number;
  lufs: number;
  rms_db: number;
  peak_db: number;
  speech?: true;
  voice_minus_music_db?: number;
  limiter_ms?: number;
  balance_db?: number;
  tracks: Record<string, number>;
}

export interface ListenReadout {
  range_ms: [number, number];
  window_ms: number;
  summary: {
    integrated_lufs: number | null;
    max_peak_db: number;
    max_peak_at_ms: number;
    limiter_ms: number;
    music_close_to_voice: { from_ms: number; to_ms: number; min_db: number }[];
    silent: { from_ms: number; to_ms: number }[];
    speech: { from_ms: number; to_ms: number }[];
  };
  tracks: { track_id: string; name?: string; role: "voice" | "other"; integrated_lufs: number | null }[];
  windows: ListenWindow[];
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function powerSum(values: readonly number[]): number {
  const heard = values.filter((value) => value > SILENCE_LUFS);
  if (heard.length === 0) return SILENT_DB;
  return 10 * Math.log10(heard.reduce((sum, value) => sum + 10 ** (value / 10), 0));
}

function overlap(a: TimeRegion, b: TimeRegion): number {
  return Math.max(0, Math.min(a.toMs, b.toMs) - Math.max(a.fromMs, b.fromMs));
}

function spoken(span: TimeRegion, speech: readonly TimeRegion[]): boolean {
  return speech.reduce((sum, region) => sum + overlap(span, region), 0) >= SPEECH_SHARE * (span.toMs - span.fromMs);
}

function runs<T>(spans: readonly TimeRegion[], value: (index: number) => T | null): { span: TimeRegion; values: T[] }[] {
  const found: { span: TimeRegion; values: T[] }[] = [];
  spans.forEach((span, index) => {
    const v = value(index);
    if (v === null) return;
    const last = found[found.length - 1];
    if (last && last.span.toMs === span.fromMs) {
      last.span = { ...last.span, toMs: span.toMs };
      last.values.push(v);
    } else found.push({ span: { ...span }, values: [v] });
  });
  return found.slice(0, MAX_LISTED_RANGES);
}

function voiceMargin(input: ListenInput, index: number, span: TimeRegion): number | null {
  const { voiceTrackIds } = input.plan;
  if (voiceTrackIds.length === 0 || !spoken(span, input.speech)) return null;
  const voice = powerSum(input.stems.filter((s) => voiceTrackIds.includes(s.trackId)).map((s) => s.windows[index].lufs));
  const rest = powerSum(input.stems.filter((s) => !voiceTrackIds.includes(s.trackId)).map((s) => s.windows[index].lufs));
  return voice > SILENCE_LUFS && rest > SILENCE_LUFS ? round(voice - rest) : null;
}

export function listenReport(input: ListenInput): ListenReadout {
  const spans = windowSpans(input.plan);
  const margins = spans.map((span, index) => voiceMargin(input, index, span));
  const windows = spans.map((span, index): ListenWindow => {
    const mix = input.mix.windows[index];
    const limited = input.mix.limiterMs[index] ?? 0;
    const margin = margins[index];
    return {
      from_ms: span.fromMs,
      lufs: round(mix.lufs),
      rms_db: round(mix.rmsDb),
      peak_db: round(mix.peakDb),
      ...(spoken(span, input.speech) ? { speech: true as const } : {}),
      ...(margin !== null ? { voice_minus_music_db: margin } : {}),
      ...(limited > 0 ? { limiter_ms: Math.round(limited) } : {}),
      ...(mix.balanceDb !== undefined && Math.abs(mix.balanceDb) >= BALANCE_SHOWN_DB ? { balance_db: round(mix.balanceDb) } : {}),
      tracks: Object.fromEntries(input.stems.map((stem) => [stem.trackId, round(stem.windows[index].lufs)])),
    };
  });
  const loudest = windows.reduce((best, w) => (w.peak_db > best.peak_db ? w : best), windows[0]);
  const close = runs(spans, (i) => (margins[i] !== null && margins[i]! < VOICE_OVER_MUSIC_DB ? margins[i]! : null));
  const silent = runs(spans, (i) => (input.mix.windows[i].lufs <= SILENCE_LUFS ? true : null));
  return {
    range_ms: [input.plan.fromMs, input.plan.toMs],
    window_ms: input.plan.windowMs,
    summary: {
      integrated_lufs: input.mix.integrated === null ? null : round(input.mix.integrated),
      max_peak_db: loudest.peak_db,
      max_peak_at_ms: loudest.from_ms,
      limiter_ms: Math.round(input.mix.limiterMs.reduce((sum, ms) => sum + ms, 0)),
      music_close_to_voice: close.map((run) => ({ from_ms: run.span.fromMs, to_ms: run.span.toMs, min_db: Math.min(...run.values) })),
      silent: silent.map((run) => ({ from_ms: run.span.fromMs, to_ms: run.span.toMs })),
      speech: input.speech
        .map((region) => ({ from_ms: Math.max(region.fromMs, input.plan.fromMs), to_ms: Math.min(region.toMs, input.plan.toMs) }))
        .filter((region) => region.to_ms > region.from_ms)
        .slice(0, MAX_LISTED_RANGES),
    },
    tracks: input.stems.map((stem) => ({
      track_id: stem.trackId,
      ...(stem.name ? { name: stem.name } : {}),
      role: input.plan.voiceTrackIds.includes(stem.trackId) ? "voice" : "other",
      integrated_lufs: stem.integrated === null ? null : round(stem.integrated),
    })),
    windows,
  };
}
