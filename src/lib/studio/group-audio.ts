import { GAIN_SAMPLE_MS, withoutFlatRuns, type GainPoint } from "./audio-gain";
import { clipSpeed, fadeLevel, sourceAt } from "./clip-time";
import type { Track, VideoDocument } from "./document";
import { groupTimeline, isGroupClip, type GroupClip } from "./group-scope";
import { valueAt } from "./keyframes";

export interface GroupAudioOptions {
  soloTrackIds?: readonly string[];
  rate?: number;
}

export interface TimedVoice {
  delayMs: number;
  durationMs: number;
  gain: GainPoint[];
}

export interface HeardGroup {
  group: GroupClip;
  track: Track;
  inner: VideoDocument;
}

export function heardGroups(doc: VideoDocument, options: GroupAudioOptions): HeardGroup[] {
  if ((options.soloTrackIds ?? []).length > 0) return [];
  return doc.tracks.flatMap((track) => {
    if (track.kind !== "visual" || track.hidden || track.muted) return [];
    return track.clips.flatMap((clip) => (isGroupClip(clip) && !clip.disabled && clip.volume > 0 ? [{ group: clip, track, inner: groupTimeline(doc, clip) }] : []));
  });
}

function levelAt(group: GroupClip, localMs: number): number {
  return group.volume * fadeLevel(group, localMs);
}

function levelled(points: readonly GainPoint[], group: GroupClip, startLocalMs: number, durationMs: number, rate: number): GainPoint[] {
  const constant = group.fadeInMs === 0 && group.fadeOutMs === 0;
  if (constant) return points.map((point) => ({ ...point, value: point.value * group.volume }));
  const frames = points.map((point) => ({ atMs: point.atMs, value: point.value, easing: "linear" as const }));
  const own = (atMs: number) => (frames.length === 0 ? 1 : valueAt(frames, atMs));
  const times = new Set(points.map((point) => point.atMs).filter((atMs) => atMs <= durationMs));
  for (let atMs = 0; atMs < durationMs; atMs += GAIN_SAMPLE_MS) times.add(atMs);
  times.add(durationMs);
  return withoutFlatRuns([...times].sort((x, y) => x - y).map((atMs) => ({ atMs, value: own(atMs) * levelAt(group, startLocalMs + atMs * rate) })));
}

export function groupedVoices<V extends TimedVoice>(heard: HeardGroup, fromMs: number, rate: number, plan: (inner: VideoDocument, innerFromMs: number, innerRate: number) => V[]): V[] {
  const { group } = heard;
  const endMs = group.startMs + group.durationMs;
  if (endMs <= fromMs) return [];
  const outerStart = Math.max(fromMs, group.startMs);
  const leadMs = (outerStart - fromMs) / rate;
  const spanMs = (endMs - fromMs) / rate;
  return plan(heard.inner, sourceAt(group, outerStart - group.startMs), rate * clipSpeed(group)).flatMap((voice) => {
    const delayMs = voice.delayMs + leadMs;
    const durationMs = Math.min(voice.durationMs, spanMs - delayMs);
    if (durationMs <= 0) return [];
    return [{ ...voice, delayMs, durationMs, gain: levelled(voice.gain, group, outerStart - group.startMs + (delayMs - leadMs) * rate, durationMs, rate) }];
  });
}

export function groupKey(heard: HeardGroup): string {
  const { group, track } = heard;
  return JSON.stringify([group.id, track.id, group.startMs, group.durationMs, group.trimInMs, group.speed, group.volume, group.fadeInMs, group.fadeOutMs]);
}
