import { produce, type Draft } from "immer";

import { keyframeCount, keyframesInRange, shiftKeyframes } from "./keyframes";
import { newStudioId, STUDIO_LIMITS, type Clip, type ClipType, type Track, type TrackKind, type VideoDocument } from "./document";

export type TrackPatch = Partial<Pick<Track, "name" | "hidden" | "locked" | "muted">>;

export type ClipPatch = Partial<Pick<Clip, "volume" | "fadeInMs" | "fadeOutMs" | "fit" | "transform" | "layer" | "motionIn" | "motionOut" | "linkId" | "keyframes">>;

export interface ClipLocation {
  track: Track;
  trackIndex: number;
  clip: Clip;
  clipIndex: number;
}

export interface ActiveClip {
  track: Track;
  clip: Clip;
  localMs: number;
}

const SOURCED: ReadonlySet<ClipType> = new Set<ClipType>(["video", "audio"]);

export function clipEnd(clip: Pick<Clip, "startMs" | "durationMs">): number {
  return clip.startMs + clip.durationMs;
}

export function hasSourceTime(type: ClipType): boolean {
  return SOURCED.has(type);
}

export function findClip(doc: VideoDocument, clipId: string): ClipLocation | null {
  for (let trackIndex = 0; trackIndex < doc.tracks.length; trackIndex++) {
    const track = doc.tracks[trackIndex];
    const clipIndex = track.clips.findIndex((c) => c.id === clipId);
    if (clipIndex >= 0) return { track, trackIndex, clip: track.clips[clipIndex], clipIndex };
  }
  return null;
}

export function isClipPickable(doc: VideoDocument, clipId: string): boolean {
  const found = findClip(doc, clipId);
  return found !== null && !found.track.locked;
}

export function timelineKeyframeCount(doc: VideoDocument): number {
  return doc.tracks.reduce((total, track) => track.clips.reduce((sum, c) => sum + keyframeCount(c.keyframes), total), 0);
}

export function clipCount(doc: VideoDocument): number {
  return doc.tracks.reduce((sum, track) => sum + track.clips.length, 0);
}

export function contentDuration(doc: VideoDocument): number {
  return doc.tracks.reduce((max, track) => track.clips.reduce((m, c) => Math.max(m, clipEnd(c)), max), 0);
}

export function trackAccepts(kind: TrackKind, type: ClipType): boolean {
  return kind === "audio" ? type === "audio" : type !== "audio";
}

function others(track: Track, ignore: ReadonlySet<string>): Clip[] {
  return track.clips.filter((c) => !ignore.has(c.id)).sort((a, b) => a.startMs - b.startMs);
}

export function isRangeFree(track: Track, startMs: number, durationMs: number, ignore: ReadonlySet<string> = new Set()): boolean {
  const end = startMs + durationMs;
  if (startMs < 0 || end > STUDIO_LIMITS.maxVideoMs) return false;
  return others(track, ignore).every((c) => end <= c.startMs || startMs >= clipEnd(c));
}

export function nearestFreeStart(track: Track, desiredMs: number, durationMs: number, ignore: ReadonlySet<string> = new Set()): number | null {
  const clips = others(track, ignore);
  const gaps: [number, number][] = [];
  let cursor = 0;
  for (const c of clips) {
    gaps.push([cursor, c.startMs]);
    cursor = Math.max(cursor, clipEnd(c));
  }
  gaps.push([cursor, STUDIO_LIMITS.maxVideoMs]);
  let best: number | null = null;
  for (const [from, to] of gaps) {
    if (to - from < durationMs) continue;
    const candidate = Math.min(Math.max(Math.round(desiredMs), from), to - durationMs);
    if (best === null || Math.abs(candidate - desiredMs) < Math.abs(best - desiredMs)) best = candidate;
  }
  return best;
}

function clampFades(clip: Draft<Clip>) {
  clip.fadeInMs = Math.max(0, Math.min(Math.round(clip.fadeInMs), clip.durationMs));
  clip.fadeOutMs = Math.max(0, Math.min(Math.round(clip.fadeOutMs), clip.durationMs - clip.fadeInMs));
  clampMotions(clip);
}

function clampMotions(clip: Draft<Clip>) {
  let room = clip.durationMs;
  for (const key of ["motionIn", "motionOut"] as const) {
    const motion = clip[key];
    if (!motion) {
      delete clip[key];
      continue;
    }
    const durationMs = Math.min(Math.round(motion.durationMs), room);
    if (durationMs < STUDIO_LIMITS.minClipMs) {
      delete clip[key];
      continue;
    }
    if (motion.durationMs !== durationMs) clip[key] = { ...motion, durationMs };
    room -= durationMs;
  }
}

function settle(doc: Draft<VideoDocument>) {
  for (const track of doc.tracks) track.clips.sort((a, b) => a.startMs - b.startMs);
  doc.durationMs = Math.min(contentDuration(doc as VideoDocument), STUDIO_LIMITS.maxVideoMs);
}

function locate(doc: Draft<VideoDocument>, clipId: string): { track: Draft<Track>; clip: Draft<Clip>; index: number } | null {
  for (const track of doc.tracks) {
    const index = track.clips.findIndex((c) => c.id === clipId);
    if (index >= 0) return { track, clip: track.clips[index], index };
  }
  return null;
}

function neighbours(track: Track, clip: Clip): { previousEnd: number; nextStart: number } {
  const sorted = others(track, new Set([clip.id]));
  const previous = sorted.filter((c) => c.startMs < clip.startMs).at(-1);
  const next = sorted.find((c) => c.startMs >= clip.startMs);
  return { previousEnd: previous ? clipEnd(previous) : 0, nextStart: next ? next.startMs : STUDIO_LIMITS.maxVideoMs };
}

function freshClip(clip: Clip): Clip {
  const copy: Clip = { ...clip, id: newStudioId("c") };
  if (clip.layer) copy.layer = { ...clip.layer, id: newStudioId("l") };
  return copy;
}

export function addTrack(doc: VideoDocument, kind: TrackKind, atIndex: number = doc.tracks.length): { document: VideoDocument; trackId: string } {
  const trackId = newStudioId("t");
  const document = produce(doc, (draft) => {
    draft.tracks.splice(Math.max(0, Math.min(atIndex, draft.tracks.length)), 0, { id: trackId, kind, clips: [] });
  });
  return { document, trackId };
}

export function removeTrack(doc: VideoDocument, trackId: string): VideoDocument {
  return produce(doc, (draft) => {
    const index = draft.tracks.findIndex((t) => t.id === trackId);
    if (index < 0 || draft.tracks[index].locked) return;
    draft.tracks.splice(index, 1);
    settle(draft);
  });
}

export function moveTrack(doc: VideoDocument, trackId: string, toIndex: number): VideoDocument {
  return produce(doc, (draft) => {
    const from = draft.tracks.findIndex((t) => t.id === trackId);
    const to = Math.max(0, Math.min(toIndex, draft.tracks.length - 1));
    if (from < 0 || from === to) return;
    const [track] = draft.tracks.splice(from, 1);
    draft.tracks.splice(to, 0, track);
  });
}

export type LaneDirection = "up" | "down";

function laneStep(kind: TrackKind, direction: LaneDirection): 1 | -1 {
  return (kind === "visual") === (direction === "up") ? 1 : -1;
}

export function shiftTarget(tracks: readonly Track[], trackId: string, direction: LaneDirection): number | null {
  const index = tracks.findIndex((t) => t.id === trackId);
  if (index < 0) return null;
  const { kind } = tracks[index];
  const step = laneStep(kind, direction);
  let target = index + step;
  while (target >= 0 && target < tracks.length && tracks[target].kind !== kind) target += step;
  return target < 0 || target >= tracks.length ? null : target;
}

export function shiftTrack(doc: VideoDocument, trackId: string, direction: LaneDirection): VideoDocument {
  const target = shiftTarget(doc.tracks, trackId, direction);
  return target === null ? doc : moveTrack(doc, trackId, target);
}

export function addTrackNextTo(doc: VideoDocument, trackId: string, direction: LaneDirection): { document: VideoDocument; trackId: string } | null {
  const index = doc.tracks.findIndex((t) => t.id === trackId);
  if (index < 0) return null;
  const { kind } = doc.tracks[index];
  return addTrack(doc, kind, laneStep(kind, direction) > 0 ? index + 1 : index);
}

export function updateTrack(doc: VideoDocument, trackId: string, patch: TrackPatch): VideoDocument {
  return produce(doc, (draft) => {
    const track = draft.tracks.find((t) => t.id === trackId);
    if (track) Object.assign(track, patch);
  });
}

export function insertClip(doc: VideoDocument, trackId: string, clip: Clip): { document: VideoDocument; clipId: string | null } {
  const track = doc.tracks.find((t) => t.id === trackId);
  const fits =
    track &&
    !track.locked &&
    trackAccepts(track.kind, clip.type) &&
    clip.durationMs >= STUDIO_LIMITS.minClipMs &&
    isRangeFree(track, clip.startMs, clip.durationMs);
  if (!fits) return { document: doc, clipId: null };
  const document = produce(doc, (draft) => {
    const target = draft.tracks.find((t) => t.id === trackId)!;
    const placed = { ...clip, startMs: Math.round(clip.startMs), durationMs: Math.round(clip.durationMs) };
    target.clips.push(placed);
    clampFades(target.clips[target.clips.length - 1]);
    settle(draft);
  });
  return { document, clipId: clip.id };
}

export function moveClip(doc: VideoDocument, clipId: string, toTrackId: string, startMs: number): VideoDocument {
  const from = findClip(doc, clipId);
  const to = doc.tracks.find((t) => t.id === toTrackId);
  if (!from || !to || from.track.locked || to.locked || !trackAccepts(to.kind, from.clip.type)) return doc;
  const start = nearestFreeStart(to, startMs, from.clip.durationMs, new Set([clipId]));
  if (start === null) return doc;
  return produce(doc, (draft) => {
    const source = draft.tracks[from.trackIndex];
    const [clip] = source.clips.splice(from.clipIndex, 1);
    clip.startMs = start;
    draft.tracks.find((t) => t.id === toTrackId)!.clips.push(clip);
    settle(draft);
  });
}

export function moveClipToward(doc: VideoDocument, clipId: string, hoveredTrackId: string | null, startMs: number): VideoDocument {
  const found = findClip(doc, clipId);
  if (!found) return doc;
  const hovered = doc.tracks.find((t) => t.id === hoveredTrackId);
  const trackId = hovered && !hovered.locked && trackAccepts(hovered.kind, found.clip.type) ? hovered.id : found.track.id;
  return moveClip(doc, clipId, trackId, startMs);
}

export type EdgeBlock =
  | { kind: "neighbour"; clipId: string; ms: number }
  | { kind: "source"; ms: number }
  | { kind: "video"; ms: number }
  | { kind: "minimum"; ms: number }
  | { kind: "locked"; trackId: string };

export function edgeBlock(doc: VideoDocument, clipId: string, edge: "start" | "end", requestedMs: number, sourceDurationMs?: number): EdgeBlock | null {
  const found = findClip(doc, clipId);
  if (!found) return null;
  const { clip, track } = found;
  if (track.locked) return { kind: "locked", trackId: track.id };
  const others = track.clips.filter((c) => c.id !== clip.id);
  if (edge === "end") {
    if (requestedMs < clip.startMs + STUDIO_LIMITS.minClipMs) return { kind: "minimum", ms: clip.startMs + STUDIO_LIMITS.minClipMs };
    const next = others.filter((c) => c.startMs >= clipEnd(clip)).sort((a, b) => a.startMs - b.startMs)[0];
    const limits: Exclude<EdgeBlock, { kind: "locked" | "minimum" }>[] = [{ kind: "video", ms: STUDIO_LIMITS.maxVideoMs }];
    if (next) limits.push({ kind: "neighbour", clipId: next.id, ms: next.startMs });
    if (hasSourceTime(clip.type) && sourceDurationMs !== undefined) limits.push({ kind: "source", ms: clip.startMs + sourceDurationMs - clip.trimInMs });
    const tightest = limits.reduce((best, limit) => (limit.ms < best.ms ? limit : best));
    return tightest.ms < requestedMs ? tightest : null;
  }
  if (requestedMs > clipEnd(clip) - STUDIO_LIMITS.minClipMs) return { kind: "minimum", ms: clipEnd(clip) - STUDIO_LIMITS.minClipMs };
  const previous = others.filter((c) => clipEnd(c) <= clip.startMs).sort((a, b) => clipEnd(b) - clipEnd(a))[0];
  const limits: Exclude<EdgeBlock, { kind: "locked" | "minimum" }>[] = [{ kind: "video", ms: 0 }];
  if (previous) limits.push({ kind: "neighbour", clipId: previous.id, ms: clipEnd(previous) });
  if (hasSourceTime(clip.type)) limits.push({ kind: "source", ms: clip.startMs - clip.trimInMs });
  const tightest = limits.reduce((best, limit) => (limit.ms > best.ms ? limit : best));
  return tightest.ms > requestedMs ? tightest : null;
}

export function trimClipStart(doc: VideoDocument, clipId: string, startMs: number): VideoDocument {
  const found = findClip(doc, clipId);
  if (!found || found.track.locked) return doc;
  const { clip, track } = found;
  const end = clipEnd(clip);
  const { previousEnd } = neighbours(track, clip);
  const lowest = hasSourceTime(clip.type) ? Math.max(previousEnd, clip.startMs - clip.trimInMs) : previousEnd;
  const next = Math.min(Math.max(Math.round(startMs), lowest), end - STUDIO_LIMITS.minClipMs);
  if (next === clip.startMs) return doc;
  return produce(doc, (draft) => {
    const target = locate(draft, clipId)!.clip;
    if (hasSourceTime(target.type)) target.trimInMs += next - target.startMs;
    if (target.keyframes) target.keyframes = shiftKeyframes(target.keyframes, target.startMs - next);
    target.startMs = next;
    target.durationMs = end - next;
    clampFades(target);
    settle(draft);
  });
}

export function trimClipEnd(doc: VideoDocument, clipId: string, endMs: number, sourceDurationMs?: number): VideoDocument {
  const found = findClip(doc, clipId);
  if (!found || found.track.locked) return doc;
  const { clip, track } = found;
  const { nextStart } = neighbours(track, clip);
  const sourceLimit = hasSourceTime(clip.type) && sourceDurationMs !== undefined ? clip.startMs + sourceDurationMs - clip.trimInMs : Infinity;
  const highest = Math.min(nextStart, STUDIO_LIMITS.maxVideoMs, sourceLimit);
  const lowest = clip.startMs + STUDIO_LIMITS.minClipMs;
  if (highest < lowest) return doc;
  const next = Math.min(Math.max(Math.round(endMs), lowest), highest);
  if (next === clipEnd(clip)) return doc;
  return produce(doc, (draft) => {
    const target = locate(draft, clipId)!.clip;
    target.durationMs = next - target.startMs;
    clampFades(target);
    settle(draft);
  });
}

export function splitClip(doc: VideoDocument, clipId: string, atMs: number): { document: VideoDocument; clipId: string | null } {
  const found = findClip(doc, clipId);
  const at = Math.round(atMs);
  if (!found || found.track.locked) return { document: doc, clipId: null };
  const { clip } = found;
  if (at - clip.startMs < STUDIO_LIMITS.minClipMs || clipEnd(clip) - at < STUDIO_LIMITS.minClipMs) return { document: doc, clipId: null };
  const right: Clip = {
    ...freshClip(clip),
    startMs: at,
    durationMs: clipEnd(clip) - at,
    trimInMs: hasSourceTime(clip.type) ? clip.trimInMs + (at - clip.startMs) : clip.trimInMs,
    fadeInMs: 0,
    motionIn: undefined,
    keyframes: keyframesInRange(shiftKeyframes(clip.keyframes, clip.startMs - at), 0, clipEnd(clip) - at),
  };
  const leftKeyframes = keyframesInRange(clip.keyframes, 0, at - clip.startMs);
  if (!right.keyframes) delete right.keyframes;
  const document = produce(doc, (draft) => {
    const { track, clip: left } = locate(draft, clipId)!;
    if (leftKeyframes) left.keyframes = leftKeyframes;
    else delete left.keyframes;
    left.durationMs = at - left.startMs;
    left.fadeOutMs = 0;
    delete left.motionOut;
    clampFades(left);
    track.clips.push(right);
    clampFades(track.clips[track.clips.length - 1]);
    settle(draft);
  });
  return { document, clipId: right.id };
}

export function splitClipsAt(doc: VideoDocument, atMs: number, clipIds?: readonly string[]): VideoDocument {
  const wanted = clipIds ? new Set(clipIds) : null;
  const targets = doc.tracks
    .filter((t) => !t.locked)
    .flatMap((t) => t.clips)
    .filter((c) => (!wanted || wanted.has(c.id)) && c.startMs < atMs && clipEnd(c) > atMs);
  return targets.reduce((current, clip) => splitClip(current, clip.id, atMs).document, doc);
}

export function deleteClips(doc: VideoDocument, clipIds: readonly string[]): VideoDocument {
  const ids = new Set(clipIds);
  return produce(doc, (draft) => {
    for (const track of draft.tracks) {
      if (track.locked) continue;
      track.clips = track.clips.filter((c) => !ids.has(c.id));
    }
    settle(draft);
  });
}

export function rippleDeleteClips(doc: VideoDocument, clipIds: readonly string[]): VideoDocument {
  const ids = new Set(clipIds);
  return produce(doc, (draft) => {
    for (const track of draft.tracks) {
      if (track.locked || !track.clips.some((c) => ids.has(c.id))) continue;
      const removed = track.clips.filter((c) => ids.has(c.id));
      track.clips = track.clips
        .filter((c) => !ids.has(c.id))
        .map((c) => {
          const shift = removed.filter((r) => clipEnd(r) <= c.startMs).reduce((sum, r) => sum + r.durationMs, 0);
          return shift === 0 ? c : { ...c, startMs: c.startMs - shift };
        });
    }
    settle(draft);
  });
}

export function duplicateClips(doc: VideoDocument, clipIds: readonly string[]): { document: VideoDocument; clipIds: string[] } {
  let document = doc;
  const created: string[] = [];
  for (const id of clipIds) {
    const found = findClip(document, id);
    if (!found) continue;
    const start = nearestFreeStart(found.track, clipEnd(found.clip), found.clip.durationMs);
    if (start === null) continue;
    const copy = { ...freshClip(found.clip), startMs: start };
    const result = insertClip(document, found.track.id, copy);
    if (result.clipId) {
      document = result.document;
      created.push(result.clipId);
    }
  }
  return { document, clipIds: created };
}

export function updateClip(doc: VideoDocument, clipId: string, patch: ClipPatch): VideoDocument {
  const found = findClip(doc, clipId);
  if (!found || found.track.locked) return doc;
  return produce(doc, (draft) => {
    const target = locate(draft, clipId)!.clip;
    Object.assign(target, patch);
    if (!target.keyframes) delete target.keyframes;
    target.volume = Math.max(0, Math.min(target.volume, STUDIO_LIMITS.maxVolume));
    clampFades(target);
  });
}

export interface SnapOptions {
  playheadMs?: number;
  exclude?: readonly string[];
}

export function snapCandidates(doc: VideoDocument, options: SnapOptions = {}): number[] {
  const exclude = new Set(options.exclude ?? []);
  const points = new Set<number>([0]);
  if (options.playheadMs !== undefined) points.add(Math.round(options.playheadMs));
  for (const track of doc.tracks) {
    for (const c of track.clips) {
      if (exclude.has(c.id)) continue;
      points.add(c.startMs);
      points.add(clipEnd(c));
    }
  }
  for (const marker of doc.markers ?? []) points.add(marker.atMs);
  return [...points].sort((a, b) => a - b);
}

export function snapMs(ms: number, candidates: readonly number[], thresholdMs: number): { ms: number; snapped: number | null } {
  let best: number | null = null;
  for (const point of candidates) {
    if (Math.abs(point - ms) <= thresholdMs && (best === null || Math.abs(point - ms) < Math.abs(best - ms))) best = point;
  }
  return best === null ? { ms, snapped: null } : { ms: best, snapped: best };
}

export function snapRangeStart(startMs: number, durationMs: number, candidates: readonly number[], thresholdMs: number): { ms: number; snapped: number | null } {
  const byStart = snapMs(startMs, candidates, thresholdMs);
  const byEnd = snapMs(startMs + durationMs, candidates, thresholdMs);
  if (byStart.snapped === null && byEnd.snapped === null) return { ms: startMs, snapped: null };
  if (byEnd.snapped === null || (byStart.snapped !== null && Math.abs(byStart.ms - startMs) <= Math.abs(byEnd.ms - startMs - durationMs))) return byStart;
  return { ms: byEnd.ms - durationMs, snapped: byEnd.snapped };
}

export function clipsAt(doc: VideoDocument, ms: number): ActiveClip[] {
  const active: ActiveClip[] = [];
  for (const track of doc.tracks) {
    if (track.hidden) continue;
    const clip = track.clips.find((c) => c.startMs <= ms && ms < clipEnd(c));
    if (clip) active.push({ track, clip, localMs: ms - clip.startMs });
  }
  return active;
}

export interface PlaceOptions {
  preferTrackId?: string;
}

export interface Placement {
  document: VideoDocument;
  clipId: string | null;
  trackId: string | null;
}

function placementOrder(doc: VideoDocument, clip: Clip, preferTrackId?: string): Track[] {
  const compatible = doc.tracks.filter((t) => !t.locked && trackAccepts(t.kind, clip.type));
  const ordered = clip.type === "overlay" ? [...compatible].reverse() : compatible;
  const preferred = ordered.find((t) => t.id === preferTrackId);
  return preferred ? [preferred, ...ordered.filter((t) => t !== preferred)] : ordered;
}

export function placeClip(doc: VideoDocument, clip: Clip, options: PlaceOptions = {}): Placement {
  const startMs = Math.max(0, Math.round(clip.startMs));
  const durationMs = Math.min(Math.round(clip.durationMs), STUDIO_LIMITS.maxVideoMs - startMs);
  const rejected: Placement = { document: doc, clipId: null, trackId: null };
  if (durationMs < STUDIO_LIMITS.minClipMs) return rejected;
  const placed = { ...clip, startMs, durationMs };
  const target = placementOrder(doc, placed, options.preferTrackId).find((t) => isRangeFree(t, startMs, durationMs));
  if (target) {
    const result = insertClip(doc, target.id, placed);
    return result.clipId ? { document: result.document, clipId: result.clipId, trackId: target.id } : rejected;
  }
  const added = addTrack(doc, trackAccepts("audio", placed.type) ? "audio" : "visual");
  const result = insertClip(added.document, added.trackId, placed);
  return result.clipId ? { document: result.document, clipId: result.clipId, trackId: added.trackId } : rejected;
}

export function placeClips(doc: VideoDocument, clips: readonly Clip[], preferTrackId?: string): { document: VideoDocument; ids: string[] } | null {
  let document = doc;
  const ids: string[] = [];
  for (const [index, clip] of clips.entries()) {
    const placed = placeClip(document, clip, index === 0 ? { preferTrackId } : {});
    if (!placed.clipId) return null;
    document = placed.document;
    ids.push(placed.clipId);
  }
  return { document, ids };
}

export function moveClipsBy(doc: VideoDocument, clipIds: readonly string[], deltaMs: number): VideoDocument {
  const ids = new Set(clipIds);
  const found = clipIds.map((id) => findClip(doc, id)).filter((f): f is ClipLocation => f !== null);
  if (found.length === 0 || found.some((f) => f.track.locked)) return doc;
  const earliest = Math.min(...found.map((f) => f.clip.startMs));
  const delta = Math.max(Math.round(deltaMs), -earliest);
  if (delta === 0) return doc;
  const fits = found.every((f) => isRangeFree(f.track, f.clip.startMs + delta, f.clip.durationMs, ids));
  if (!fits) return doc;
  return produce(doc, (draft) => {
    for (const f of found) locate(draft, f.clip.id)!.clip.startMs += delta;
    settle(draft);
  });
}

export function setClipTrimIn(doc: VideoDocument, clipId: string, trimInMs: number, sourceDurationMs?: number): VideoDocument {
  const found = findClip(doc, clipId);
  if (!found || found.track.locked || !hasSourceTime(found.clip.type)) return doc;
  const highest = sourceDurationMs === undefined ? Infinity : Math.max(0, sourceDurationMs - found.clip.durationMs);
  const next = Math.min(Math.max(0, Math.round(trimInMs)), highest);
  if (next === found.clip.trimInMs) return doc;
  return produce(doc, (draft) => {
    locate(draft, clipId)!.clip.trimInMs = next;
  });
}

export function replaceClipAsset(doc: VideoDocument, clipId: string, assetId: string): VideoDocument {
  const found = findClip(doc, clipId);
  const clean = assetId.trim();
  if (!found || found.track.locked || found.clip.type === "overlay" || clean === "" || found.clip.assetId === clean) return doc;
  return produce(doc, (draft) => {
    locate(draft, clipId)!.clip.assetId = clean;
  });
}

export interface TimedText {
  startMs: number;
  endMs: number;
  text: string;
}

export function insertCaptionTrack(
  doc: VideoDocument,
  cues: readonly TimedText[],
  makeClip: (cue: TimedText) => Clip,
  name?: string,
): { document: VideoDocument; trackId: string | null } {
  const clips: Clip[] = [];
  let cursor = 0;
  for (const cue of [...cues].sort((a, b) => a.startMs - b.startMs)) {
    const startMs = Math.max(cursor, Math.round(cue.startMs));
    const endMs = Math.min(Math.round(cue.endMs), STUDIO_LIMITS.maxVideoMs);
    if (endMs - startMs < STUDIO_LIMITS.minClipMs) continue;
    clips.push({ ...makeClip(cue), startMs, durationMs: endMs - startMs });
    cursor = endMs;
  }
  const rejected = { document: doc, trackId: null };
  if (clips.length === 0) return rejected;
  const added = addTrack(doc, "visual");
  const trackId = added.trackId;
  const document = produce(added.document, (draft) => {
    const track = draft.tracks.find((t) => t.id === trackId)!;
    if (name) track.name = name;
    for (const clip of clips) {
      track.clips.push(clip);
      clampFades(track.clips[track.clips.length - 1]);
    }
    settle(draft);
  });
  return { document, trackId };
}

export { clampFades as clampClipTiming, settle as settleTimeline };
