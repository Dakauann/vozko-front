import { hasSourceTime, localAtSource, sourceAt, SPEED_LIMITS } from "./clip-time";
import { STUDIO_LIMITS, type Clip, type ClipMarker } from "./document";
import { markerEndMs, markerListIssue } from "./markers";
import type { IssueCode } from "./validate";

export const MAX_CLIP_MARKER_MS = SPEED_LIMITS[1] * STUDIO_LIMITS.maxVideoMs;

type Timed = Pick<Clip, "type" | "durationMs" | "trimInMs" | "speed" | "reverse" | "freeze" | "keyframes">;

export interface PlacedClipMarker {
  marker: ClipMarker;
  startMs: number;
  endMs: number;
}

function onSourceTime(clip: Pick<Clip, "type" | "freeze">): boolean {
  return hasSourceTime(clip.type) && !clip.freeze;
}

export function markerContentMs(clip: Timed, localMs: number): number {
  return Math.round(onSourceTime(clip) ? sourceAt(clip, localMs) : localMs);
}

function markerLocalMs(clip: Timed, contentMs: number): number {
  return onSourceTime(clip) ? localAtSource(clip, contentMs) : contentMs;
}

export function contentRange(clip: Timed, localMs: number, durationMs: number): { atMs: number; durationMs: number } {
  const from = markerContentMs(clip, localMs);
  const to = markerContentMs(clip, localMs + durationMs);
  return { atMs: Math.min(from, to), durationMs: Math.abs(to - from) };
}

function localSpan(clip: Timed, marker: ClipMarker): [number, number] {
  const a = markerLocalMs(clip, marker.atMs);
  const b = markerLocalMs(clip, markerEndMs(marker));
  return [Math.min(a, b), Math.max(a, b)];
}

export function placedClipMarkers(clip: Clip): PlacedClipMarker[] {
  return (clip.markers ?? [])
    .flatMap((marker) => {
      const [from, to] = localSpan(clip, marker);
      if (to < 0 || from > clip.durationMs) return [];
      return [{ marker, startMs: clip.startMs + Math.round(from), endMs: clip.startMs + Math.round(to) }];
    })
    .sort((a, b) => a.startMs - b.startMs);
}

function listOrNothing(list: ClipMarker[]): ClipMarker[] | undefined {
  return list.length > 0 ? list : undefined;
}

function shifted(markers: readonly ClipMarker[], deltaMs: number): ClipMarker[] {
  return markers.flatMap((marker) => {
    const atMs = marker.atMs + deltaMs;
    const endMs = markerEndMs(marker) + deltaMs;
    if (endMs < 0) return [];
    const start = Math.max(0, atMs);
    const durationMs = endMs - start;
    const next: ClipMarker = { ...marker, atMs: start };
    delete next.durationMs;
    return [durationMs > 0 ? { ...next, durationMs } : next];
  });
}

export function shiftClipMarkers(clip: Pick<Clip, "type" | "freeze" | "markers">, deltaMs: number): ClipMarker[] | undefined {
  if (!clip.markers || deltaMs === 0 || onSourceTime(clip)) return clip.markers;
  return listOrNothing(shifted(clip.markers, deltaMs));
}

export function splitClipMarkers(clip: Clip, atLocalMs: number): { left?: ClipMarker[]; right?: ClipMarker[] } {
  const markers = clip.markers ?? [];
  const left = markers.filter((marker) => localSpan(clip, marker)[0] < atLocalMs);
  const right = markers.filter((marker) => localSpan(clip, marker)[1] >= atLocalMs);
  return { left: listOrNothing(left), right: listOrNothing(onSourceTime(clip) ? right : shifted(right, -atLocalMs)) };
}

export function clipMarkersIssue(clip: Pick<Clip, "markers">): IssueCode | null {
  return markerListIssue(clip.markers ?? [], MAX_CLIP_MARKER_MS);
}
