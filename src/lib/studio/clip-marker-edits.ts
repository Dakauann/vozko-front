import { newStudioId, type Clip, type ClipMarker, type VideoDocument } from "./document";
import { contentRange, MAX_CLIP_MARKER_MS, markerContentMs, placedClipMarkers } from "./clip-markers";
import { detectBeats } from "./beats";
import type { LabelColor } from "./labels";
import type { LoudnessProfile } from "./loudness";
import { editMarkerIn, insertMarkerInto, type MarkerFields, type MarkerPatch, type MarkerRefusal } from "./markers";
import { findClip, updateClip } from "./timeline";

export type ClipMarkerRefusal = MarkerRefusal | "locked" | "outside";

export type ClipMarkerResult = { ok: true; document: VideoDocument; markerId: string } | { ok: false; reason: ClipMarkerRefusal };

type Located = { ok: true; clip: Clip } | { ok: false; reason: ClipMarkerRefusal };

function locate(doc: VideoDocument, clipId: string): Located {
  const found = findClip(doc, clipId);
  if (!found) return { ok: false, reason: "missing" };
  if (found.track.locked) return { ok: false, reason: "locked" };
  return { ok: true, clip: found.clip };
}

function inside(clip: Clip, localMs: number): boolean {
  return localMs >= 0 && localMs <= clip.durationMs;
}

function withList(doc: VideoDocument, clipId: string, list: ClipMarker[]): VideoDocument {
  return updateClip(doc, clipId, { markers: list.length > 0 ? list : undefined });
}

export function addClipMarker(doc: VideoDocument, clipId: string, timelineMs: number, fields: MarkerFields & { beat?: boolean }): ClipMarkerResult {
  const located = locate(doc, clipId);
  if (!located.ok) return located;
  const { clip } = located;
  const localMs = Math.round(timelineMs) - clip.startMs;
  if (!inside(clip, localMs)) return { ok: false, reason: "outside" };
  const range = contentRange(clip, localMs, fields.durationMs ?? 0);
  const marker: ClipMarker = { ...fields, id: newStudioId("k"), ...range };
  const result = insertMarkerInto(clip.markers ?? [], marker, MAX_CLIP_MARKER_MS);
  if (!result.ok) return result;
  return { ok: true, document: withList(doc, clipId, result.list), markerId: marker.id };
}

export function updateClipMarker(doc: VideoDocument, clipId: string, markerId: string, patch: MarkerPatch): ClipMarkerResult {
  const located = locate(doc, clipId);
  if (!located.ok) return located;
  const { clip } = located;
  const marker = (clip.markers ?? []).find((m) => m.id === markerId);
  if (!marker) return { ok: false, reason: "missing" };
  const content: MarkerPatch = { ...patch };
  if (patch.atMs !== undefined || patch.durationMs !== undefined) {
    const placed = placedClipMarkers(clip).find((entry) => entry.marker.id === markerId);
    const localMs = patch.atMs !== undefined ? Math.round(patch.atMs) - clip.startMs : placed ? placed.startMs - clip.startMs : null;
    if (localMs === null || !inside(clip, localMs)) return { ok: false, reason: "outside" };
    const span = patch.durationMs ?? (placed ? placed.endMs - placed.startMs : 0);
    Object.assign(content, contentRange(clip, localMs, span));
  }
  const result = editMarkerIn(clip.markers ?? [], markerId, content, MAX_CLIP_MARKER_MS);
  if (!result.ok) return result;
  return { ok: true, document: withList(doc, clipId, result.list), markerId };
}

export function removeClipMarker(doc: VideoDocument, clipId: string, markerId: string): ClipMarkerResult {
  const located = locate(doc, clipId);
  if (!located.ok) return located;
  const list = located.clip.markers ?? [];
  if (!list.some((m) => m.id === markerId)) return { ok: false, reason: "missing" };
  return { ok: true, document: withList(doc, clipId, list.filter((m) => m.id !== markerId)), markerId };
}

interface BeatPlacement {
  every?: number;
  color?: LabelColor;
}

type BeatResult = { ok: true; document: VideoDocument; placed: number } | { ok: false; reason: Exclude<ClipMarkerRefusal, "taken" | "outside"> };

export function placeBeatMarkers(doc: VideoDocument, clipId: string, beatsMs: readonly number[], placement: BeatPlacement = {}): BeatResult {
  const located = locate(doc, clipId);
  if (!located.ok) return { ok: false, reason: located.reason === "locked" ? "locked" : "missing" };
  const { clip } = located;
  const every = Math.max(1, Math.round(placement.every ?? 1));
  const kept = (clip.markers ?? []).filter((m) => !m.beat);
  const from = markerContentMs(clip, 0);
  const to = markerContentMs(clip, clip.durationMs);
  const window = beatsMs.filter((ms) => ms >= Math.min(from, to) && ms <= Math.max(from, to)).filter((_, index) => index % every === 0);
  let list = kept;
  let placed = 0;
  for (const atMs of window) {
    const result = insertMarkerInto(list, { id: newStudioId("k"), atMs: Math.round(atMs), beat: true, ...(placement.color ? { color: placement.color } : {}) }, MAX_CLIP_MARKER_MS);
    if (!result.ok) continue;
    list = result.list;
    placed += 1;
  }
  return { ok: true, document: withList(doc, clipId, list), placed };
}

export type BeatMarkRefusal = "missing" | "locked" | "notAudio" | "noPulse" | "outside";

type BeatMarkResult = { ok: true; document: VideoDocument; placed: number; bpm: number } | { ok: false; reason: BeatMarkRefusal };

export function beatSource(doc: VideoDocument, clipId: string): { ok: true; assetId: string } | { ok: false; reason: BeatMarkRefusal } {
  const found = findClip(doc, clipId);
  if (!found) return { ok: false, reason: "missing" };
  if (found.clip.type !== "audio" || !found.clip.assetId) return { ok: false, reason: "notAudio" };
  return { ok: true, assetId: found.clip.assetId };
}

export function markBeats(doc: VideoDocument, clipId: string, profile: LoudnessProfile, placement: BeatPlacement = {}): BeatMarkResult {
  const source = beatSource(doc, clipId);
  if (!source.ok) return source;
  const analysis = detectBeats(profile);
  if (!analysis) return { ok: false, reason: "noPulse" };
  const result = placeBeatMarkers(doc, clipId, analysis.beatsMs, placement);
  if (!result.ok) return result;
  if (result.placed === 0) return { ok: false, reason: "outside" };
  return { ok: true, document: result.document, placed: result.placed, bpm: analysis.bpm };
}
