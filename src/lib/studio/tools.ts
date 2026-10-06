import { produce } from "immer";

import { msOfFrame, newStudioId, STUDIO_LIMITS, type Clip, type VideoDocument } from "./document";
import { clearRange, rearrange, shiftChanges, splitAt, trimChange, withLinked, type ClipChange, type ClipSource, type CreatedClip } from "./edits";
import { clipEnd, findClip, hasSourceTime, moveClipsBy, setClipTrimIn, trackAccepts } from "./timeline";
import { documentIssue } from "./validate";

export function selectForward(doc: VideoDocument, clipId: string, allTracks: boolean): string[] {
  const found = findClip(doc, clipId);
  if (!found) return [];
  const from = found.clip.startMs;
  const tracks = allTracks ? doc.tracks.filter((t) => !t.locked) : [found.track];
  return tracks.flatMap((t) => t.clips.filter((c) => c.startMs >= from).map((c) => c.id));
}

export function selectFromPlayhead(doc: VideoDocument, atMs: number, direction: "after" | "before", trackIds?: readonly string[]): string[] {
  const wanted = trackIds ? new Set(trackIds) : null;
  return doc.tracks
    .filter((t) => !wanted || wanted.has(t.id))
    .flatMap((t) => t.clips.filter((c) => (direction === "after" ? clipEnd(c) > atMs : c.startMs < atMs)).map((c) => c.id));
}

export function bladeTargets(doc: VideoDocument, trackId: string | null, atMs: number, options: { allTracks: boolean; linked: boolean }): string[] {
  const under = (clips: readonly Clip[]) => clips.filter((c) => c.startMs + STUDIO_LIMITS.minClipMs <= atMs && clipEnd(c) - STUDIO_LIMITS.minClipMs >= atMs).map((c) => c.id);
  const tracks = doc.tracks.filter((t) => !t.locked && (options.allTracks || t.id === trackId));
  const ids = tracks.flatMap((t) => under(t.clips));
  if (!options.linked) return ids;
  return withLinked(doc, ids).filter((id) => {
    const found = findClip(doc, id);
    return found !== null && !found.track.locked && under([found.clip]).length === 1;
  });
}

export function blade(doc: VideoDocument, trackId: string | null, atMs: number, options: { allTracks: boolean; linked: boolean }): VideoDocument {
  const ids = bladeTargets(doc, trackId, atMs, options);
  return ids.length === 0 ? doc : splitAt(doc, Math.round(atMs), ids);
}

export interface Gap {
  trackId: string;
  fromMs: number;
  toMs: number;
}

export function gapAt(doc: VideoDocument, trackId: string, atMs: number): Gap | null {
  const track = doc.tracks.find((t) => t.id === trackId);
  if (!track || atMs < 0) return null;
  const sorted = [...track.clips].sort((a, b) => a.startMs - b.startMs);
  let cursor = 0;
  for (const clip of sorted) {
    if (atMs < clip.startMs) return clip.startMs - cursor > 0 && atMs >= cursor ? { trackId, fromMs: cursor, toMs: clip.startMs } : null;
    cursor = Math.max(cursor, clipEnd(clip));
  }
  return null;
}

export function closeGap(doc: VideoDocument, gap: Gap): VideoDocument {
  const track = doc.tracks.find((t) => t.id === gap.trackId);
  if (!track || track.locked) return doc;
  const followers = withLinked(
    doc,
    track.clips.filter((c) => c.startMs >= gap.toMs).map((c) => c.id),
  );
  if (followers.length === 0) return doc;
  return rearrange(doc, shiftChanges(doc, followers, gap.fromMs - gap.toMs)) ?? doc;
}

export function rollEdit(doc: VideoDocument, leftId: string, rightId: string, atMs: number, source: ClipSource = () => undefined): VideoDocument {
  const left = findClip(doc, leftId);
  const right = findClip(doc, rightId);
  if (!left || !right || left.track.id !== right.track.id || clipEnd(left.clip) !== right.clip.startMs) return doc;
  const leftSource = source(leftId);
  const low = Math.max(left.clip.startMs + STUDIO_LIMITS.minClipMs, hasSourceTime(right.clip.type) ? right.clip.startMs - right.clip.trimInMs : 0);
  const high = Math.min(
    clipEnd(right.clip) - STUDIO_LIMITS.minClipMs,
    hasSourceTime(left.clip.type) && leftSource !== undefined ? left.clip.startMs + leftSource - left.clip.trimInMs : Infinity,
  );
  if (high < low) return doc;
  const cut = Math.min(Math.max(Math.round(atMs), low), high);
  if (cut === right.clip.startMs) return doc;
  const changes = new Map<string, ClipChange>([
    [leftId, trimChange(left.clip, "end", cut, source(leftId))],
    [rightId, trimChange(right.clip, "start", cut, source(rightId))],
  ]);
  return rearrange(doc, changes) ?? doc;
}

export function slipClip(doc: VideoDocument, clipId: string, deltaMs: number, sourceDurationMs?: number): VideoDocument {
  const found = findClip(doc, clipId);
  if (!found) return doc;
  return setClipTrimIn(doc, clipId, found.clip.trimInMs + deltaMs, sourceDurationMs);
}

export function slideClip(doc: VideoDocument, clipId: string, deltaMs: number, source: ClipSource = () => undefined): VideoDocument {
  const found = findClip(doc, clipId);
  if (!found || found.track.locked) return doc;
  const { clip, track } = found;
  const previous = track.clips.find((c) => clipEnd(c) === clip.startMs);
  const next = track.clips.find((c) => c.startMs === clipEnd(clip));
  let delta = Math.round(deltaMs);
  if (previous) {
    const change = trimChange(previous, "end", clipEnd(previous) + delta, source(previous.id));
    delta = previous.startMs + change.durationMs! - clipEnd(previous);
  }
  if (next) {
    const change = trimChange(next, "start", next.startMs + delta, source(next.id));
    delta = change.startMs! - next.startMs;
  }
  if (delta === 0) return doc;
  const changes = new Map<string, ClipChange>([[clipId, { startMs: clip.startMs + delta }]]);
  if (previous) changes.set(previous.id, trimChange(previous, "end", clipEnd(previous) + delta, source(previous.id)));
  if (next) changes.set(next.id, trimChange(next, "start", next.startMs + delta, source(next.id)));
  return rearrange(doc, changes) ?? doc;
}

export interface TimeRange {
  inMs: number;
  outMs: number;
}

function rangeTracks(doc: VideoDocument, trackIds?: readonly string[]) {
  const wanted = trackIds ? new Set(trackIds) : null;
  return doc.tracks.filter((t) => !t.locked && (!wanted || wanted.has(t.id)));
}

export function liftRange(doc: VideoDocument, range: TimeRange, trackIds?: readonly string[]): VideoDocument {
  const from = Math.min(range.inMs, range.outMs);
  const to = Math.max(range.inMs, range.outMs);
  if (to - from <= 0) return doc;
  let result: VideoDocument | null = doc;
  for (const track of rangeTracks(doc, trackIds)) result = result && clearRange(result, track.id, from, to);
  return result ?? doc;
}

export function extractRange(doc: VideoDocument, range: TimeRange, trackIds?: readonly string[]): VideoDocument {
  const from = Math.min(range.inMs, range.outMs);
  const to = Math.max(range.inMs, range.outMs);
  const lifted = liftRange(doc, range, trackIds);
  if (lifted === doc) return doc;
  const followers = rangeTracks(lifted, trackIds).flatMap((t) => t.clips.filter((c) => c.startMs >= to).map((c) => c.id));
  if (followers.length === 0) return lifted;
  return rearrange(lifted, shiftChanges(lifted, followers, from - to)) ?? doc;
}

export interface ClipboardItem {
  trackId: string;
  trackKind: "visual" | "audio";
  offsetMs: number;
  clip: Clip;
}

export interface ClipboardPayload {
  items: ClipboardItem[];
  spanMs: number;
}

export function copyClips(doc: VideoDocument, ids: readonly string[]): ClipboardPayload | null {
  const found = ids.map((id) => findClip(doc, id)).filter((f) => f !== null);
  if (found.length === 0) return null;
  const base = Math.min(...found.map((f) => f.clip.startMs));
  const end = Math.max(...found.map((f) => clipEnd(f.clip)));
  return {
    items: found.map(({ clip, track }) => ({ trackId: track.id, trackKind: track.kind, offsetMs: clip.startMs - base, clip })),
    spanMs: end - base,
  };
}

function pastedClips(doc: VideoDocument, payload: ClipboardPayload, atMs: number): CreatedClip[] | null {
  const links = new Map<string, string>();
  const created: CreatedClip[] = [];
  for (const item of payload.items) {
    const original = doc.tracks.find((t) => t.id === item.trackId && !t.locked && trackAccepts(t.kind, item.clip.type));
    const track = original ?? doc.tracks.find((t) => !t.locked && t.kind === item.trackKind && trackAccepts(t.kind, item.clip.type));
    if (!track) return null;
    const linkId = item.clip.linkId ? (links.get(item.clip.linkId) ?? links.set(item.clip.linkId, newStudioId("k")).get(item.clip.linkId)!) : undefined;
    const clip: Clip = { ...item.clip, id: newStudioId("c"), startMs: Math.round(atMs + item.offsetMs), linkId };
    if (!linkId) delete clip.linkId;
    if (item.clip.layer) clip.layer = { ...item.clip.layer, id: newStudioId("l") };
    created.push({ trackId: track.id, clip });
  }
  return created;
}

export function pasteClips(doc: VideoDocument, payload: ClipboardPayload, atMs: number, mode: "overwrite" | "insert"): { document: VideoDocument; ids: string[] } | null {
  const created = pastedClips(doc, payload, atMs);
  if (!created || created.length === 0) return null;
  let base: VideoDocument | null = doc;
  if (mode === "overwrite") {
    for (const { trackId, clip } of created) base = base && clearRange(base, trackId, clip.startMs, clipEnd(clip));
  } else {
    const tracks = new Set(created.map((c) => c.trackId));
    const followers = doc.tracks.filter((t) => tracks.has(t.id)).flatMap((t) => t.clips.filter((c) => c.startMs >= atMs).map((c) => c.id));
    base = followers.length > 0 ? rearrange(doc, shiftChanges(doc, withLinked(doc, followers), payload.spanMs)) : doc;
  }
  if (!base) return null;
  const document = rearrange(base, new Map(), created);
  if (!document || documentIssue("video", document)) return null;
  return { document, ids: created.map((c) => c.clip.id) };
}

export function nudgeClips(doc: VideoDocument, ids: readonly string[], frames: number): VideoDocument {
  if (ids.length === 0 || frames === 0) return doc;
  return moveClipsBy(doc, ids, Math.sign(frames) * msOfFrame(Math.abs(frames)));
}

export function relinkClips(doc: VideoDocument, ids: readonly string[]): VideoDocument {
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const found = findClip(doc, id);
    if (!found?.clip.assetId) continue;
    const partners = doc.tracks.flatMap((t) => t.clips.filter((c) => c.assetId === found.clip.assetId && c.startMs === found.clip.startMs).map((c) => c.id));
    if (partners.length > 1) groups.set(`${found.clip.assetId}@${found.clip.startMs}`, partners);
  }
  if (groups.size === 0) return doc;
  return produce(doc, (draft) => {
    for (const members of groups.values()) {
      const linkId = newStudioId("k");
      for (const track of draft.tracks) {
        if (track.locked) continue;
        for (const clip of track.clips) if (members.includes(clip.id)) clip.linkId = linkId;
      }
    }
  });
}

export function toggleDisabled(doc: VideoDocument, ids: readonly string[]): VideoDocument {
  const found = ids.map((id) => findClip(doc, id)).filter((f) => f !== null && !f.track.locked);
  if (found.length === 0) return doc;
  const disable = found.some((f) => !f!.clip.disabled);
  return produce(doc, (draft) => {
    for (const track of draft.tracks) {
      if (track.locked) continue;
      for (const clip of track.clips) {
        if (!ids.includes(clip.id)) continue;
        if (disable) clip.disabled = true;
        else delete clip.disabled;
      }
    }
  });
}
