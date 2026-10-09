import type { Clip, Fit, Layer, Transform, VideoDocument } from "./document";
import { animatedBlur, animatedTransform } from "./keyframes";
import { motionOffset, movedTransform } from "./motion";
import { clipEnd } from "./timeline";

export const PREMOUNT_MS = 1500;
export const DRIFT_TOLERANCE_MS = 80;
export const PAUSED_TOLERANCE_MS = 17;
export const MAX_SHUTTLE_RATE = 8;
export const MAX_OUTPUT_LATENCY_SEC = 0.5;

export interface PlaybackClock {
  playing: boolean;
  rate: number;
  originMs: number;
  originSec: number;
}

export function idleClock(positionMs: number): PlaybackClock {
  return { playing: false, rate: 0, originMs: positionMs, originSec: 0 };
}

export function clampPosition(ms: number, durationMs: number): number {
  return Math.min(Math.max(0, ms), Math.max(0, durationMs));
}

function travelledMs(clock: PlaybackClock, nowSec: number): number {
  return Math.max(0, nowSec - clock.originSec) * 1000 * clock.rate;
}

export function clockPosition(clock: PlaybackClock, nowSec: number, durationMs: number): number {
  if (!clock.playing) return clampPosition(clock.originMs, durationMs);
  return clampPosition(clock.originMs + travelledMs(clock, nowSec), durationMs);
}

export function startClock(positionMs: number, nowSec: number, rate: number = 1): PlaybackClock {
  return { playing: rate !== 0, rate, originMs: positionMs, originSec: nowSec };
}

export function stopClock(clock: PlaybackClock, nowSec: number, durationMs: number): PlaybackClock {
  return idleClock(clockPosition(clock, nowSec, durationMs));
}

export function clockReachedEdge(clock: PlaybackClock, nowSec: number, durationMs: number): boolean {
  if (!clock.playing) return false;
  const position = clock.originMs + travelledMs(clock, nowSec);
  return clock.rate > 0 ? position >= durationMs : position <= 0;
}

export interface OutputLatency {
  outputLatency?: number;
  baseLatency?: number;
}

function seconds(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0;
}

export function outputLatencySec(context: OutputLatency): number {
  return Math.min(seconds(context.outputLatency) + seconds(context.baseLatency), MAX_OUTPUT_LATENCY_SEC);
}

export type ShuttleDirection = -1 | 0 | 1;

export function shuttleRate(current: number, playing: boolean, direction: ShuttleDirection): number {
  if (direction === 0) return 0;
  const sameWay = playing && Math.sign(current) === direction;
  if (!sameWay) return direction;
  return direction * Math.min(Math.abs(current) * 2, MAX_SHUTTLE_RATE);
}

export function fadeLevel(clip: Pick<Clip, "durationMs" | "fadeInMs" | "fadeOutMs">, localMs: number): number {
  if (localMs < 0 || localMs > clip.durationMs) return 0;
  let level = 1;
  if (clip.fadeInMs > 0 && localMs < clip.fadeInMs) level = Math.min(level, localMs / clip.fadeInMs);
  const remaining = clip.durationMs - localMs;
  if (clip.fadeOutMs > 0 && remaining < clip.fadeOutMs) level = Math.min(level, remaining / clip.fadeOutMs);
  return Math.max(0, Math.min(1, level));
}

export type VisualKind = "video" | "image" | "overlay";

export interface VisualItem {
  clipId: string;
  trackIndex: number;
  type: VisualKind;
  assetId?: string;
  layer?: Layer;
  transform: Transform;
  base: Transform;
  fit: Fit;
  active: boolean;
  opacity: number;
  blurPx: number;
  sourceMs: number;
  startMs: number;
  endMs: number;
}

export function visualPlan(doc: VideoDocument, ms: number, premountMs: number = PREMOUNT_MS): VisualItem[] {
  const items: VisualItem[] = [];
  doc.tracks.forEach((track, trackIndex) => {
    if (track.kind !== "visual" || track.hidden) return;
    for (const clip of track.clips) {
      const end = clipEnd(clip);
      if (ms >= end || ms < clip.startMs - premountMs) continue;
      if (clip.type === "audio" || clip.disabled) continue;
      const active = ms >= clip.startMs;
      const localMs = active ? ms - clip.startMs : 0;
      const transform = active ? animatedTransform(clip.transform, clip.keyframes, localMs) : clip.transform;
      items.push({
        clipId: clip.id,
        trackIndex,
        type: clip.type,
        assetId: clip.assetId,
        layer: clip.layer,
        transform: active ? movedTransform(transform, motionOffset(clip, localMs)) : clip.transform,
        base: clip.transform,
        fit: clip.type === "overlay" ? "contain" : (clip.fit ?? "cover"),
        active,
        opacity: active ? transform.opacity * fadeLevel(clip, localMs) : 0,
        blurPx: animatedBlur(clip.blur, clip.keyframes, localMs),
        sourceMs: clip.type === "video" ? clip.trimInMs + localMs : 0,
        startMs: clip.startMs,
        endMs: end,
      });
    }
  });
  return items;
}

export interface VideoCommand {
  seekToMs: number | null;
  play: boolean;
  playbackRate: number;
}

export interface VideoSyncState {
  playing: boolean;
  rate: number;
  active: boolean;
}

export function syncVideo(currentMs: number, targetMs: number, state: VideoSyncState): VideoCommand {
  const flowing = state.playing && state.active && state.rate > 0;
  const tolerance = flowing ? DRIFT_TOLERANCE_MS : PAUSED_TOLERANCE_MS;
  const drift = Math.abs(currentMs - targetMs);
  return {
    seekToMs: drift > tolerance ? Math.max(0, targetMs) : null,
    play: flowing,
    playbackRate: flowing ? state.rate : 1,
  };
}

export interface GainPoint {
  atMs: number;
  value: number;
}

export interface AudioVoice {
  clipId: string;
  assetId: string;
  delayMs: number;
  offsetMs: number;
  durationMs: number;
  gain: GainPoint[];
}

export function gainEnvelope(clip: Pick<Clip, "durationMs" | "fadeInMs" | "fadeOutMs" | "volume">, fromLocalMs: number): GainPoint[] {
  const marks = [fromLocalMs];
  if (clip.fadeInMs > 0) marks.push(clip.fadeInMs);
  if (clip.fadeOutMs > 0) marks.push(clip.durationMs - clip.fadeOutMs);
  marks.push(clip.durationMs);
  const unique = [...new Set(marks.filter((mark) => mark >= fromLocalMs && mark <= clip.durationMs))].sort((a, b) => a - b);
  return unique.map((mark) => ({ atMs: mark - fromLocalMs, value: clip.volume * fadeLevel(clip, mark) }));
}

export interface AudioPlanOptions {
  soloTrackIds?: readonly string[];
}

type AudibleClip = Clip & { assetId: string };

function audibleClips(doc: VideoDocument, options: AudioPlanOptions): AudibleClip[] {
  const solo = new Set(options.soloTrackIds ?? []);
  return doc.tracks.flatMap((track) => {
    if (track.kind !== "audio" || track.hidden || track.muted || (solo.size > 0 && !solo.has(track.id))) return [];
    return track.clips.filter((clip): clip is AudibleClip => Boolean(clip.assetId) && !clip.disabled && clip.volume > 0);
  });
}

export function audioPlan(doc: VideoDocument, fromMs: number, options: AudioPlanOptions = {}): AudioVoice[] {
  const voices: AudioVoice[] = [];
  for (const clip of audibleClips(doc, options)) {
    const end = clipEnd(clip);
    if (end <= fromMs) continue;
    const playFrom = Math.max(fromMs, clip.startMs);
    const localMs = playFrom - clip.startMs;
    voices.push({
      clipId: clip.id,
      assetId: clip.assetId,
      delayMs: playFrom - fromMs,
      offsetMs: clip.trimInMs + localMs,
      durationMs: end - playFrom,
      gain: gainEnvelope(clip, localMs),
    });
  }
  return voices;
}

export function audioVoiceKeys(doc: VideoDocument, options: AudioPlanOptions = {}): Map<string, string> {
  return new Map(audibleClips(doc, options).map((clip) => [clip.id, JSON.stringify([clip.assetId, clip.startMs, clip.durationMs, clip.trimInMs, clip.volume, clip.fadeInMs, clip.fadeOutMs])]));
}

export interface AudioPlanChange {
  stop: string[];
  start: string[];
}

export function audioPlanChange(previous: ReadonlyMap<string, string>, next: ReadonlyMap<string, string>): AudioPlanChange {
  return {
    stop: [...previous].filter(([clipId, key]) => next.get(clipId) !== key).map(([clipId]) => clipId),
    start: [...next].filter(([clipId, key]) => previous.get(clipId) !== key).map(([clipId]) => clipId),
  };
}

export interface BoxStyle {
  left: string;
  top: string;
  width: string;
  height: string;
  transform: string;
  opacity: number;
  zIndex: number;
}

export function boxStyle(item: Pick<VisualItem, "transform" | "opacity" | "trackIndex">): BoxStyle {
  const t = item.transform;
  return {
    left: `${(t.x - t.w / 2) * 100}%`,
    top: `${(t.y - t.h / 2) * 100}%`,
    width: `${t.w * 100}%`,
    height: `${t.h * 100}%`,
    transform: t.rotation ? `rotate(${t.rotation}deg)` : "none",
    opacity: item.opacity,
    zIndex: item.trackIndex + 1,
  };
}

export const FRAME_MARGIN_PX = 24;

export function fitFrame(container: { width: number; height: number }, canvas: { width: number; height: number }, marginPx: number = FRAME_MARGIN_PX): { width: number; height: number } {
  const width = Math.max(0, container.width - marginPx * 2);
  const height = Math.max(0, container.height - marginPx * 2);
  const scale = Math.min(width / canvas.width, height / canvas.height);
  if (!Number.isFinite(scale) || scale <= 0) return { width: 0, height: 0 };
  return { width: Math.floor(canvas.width * scale), height: Math.floor(canvas.height * scale) };
}

export const FOCUS_DIM = 0.3;

export function focusedPlan(items: readonly VisualItem[], focusClipId: string | null, solo: boolean): VisualItem[] {
  if (!focusClipId) return [...items];
  return items
    .filter((item) => !solo || item.clipId === focusClipId)
    .map((item) => (item.clipId === focusClipId ? item : { ...item, opacity: item.opacity * FOCUS_DIM }));
}

export function zoomAround(transform: { x: number; y: number; w: number; h: number }, maxScale: number = 3, fill: number = 0.6): { scale: number; originX: number; originY: number } {
  const size = Math.max(transform.w, transform.h, 0.01);
  return { scale: Math.max(1, Math.min(maxScale, fill / size)), originX: Math.min(1, Math.max(0, transform.x)), originY: Math.min(1, Math.max(0, transform.y)) };
}
