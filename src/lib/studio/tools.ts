import { produce } from "immer";

import { msOfFrame, newStudioId, STUDIO_LIMITS, type Clip, type VideoDocument } from "./document";
import { clearRange, rearrange, shiftChanges, splitAt, withLinked, type CreatedClip } from "./edits";
import { clipEnd, findClip, moveClipsBy, setClipTrimIn, trackAccepts } from "./timeline";
import { clipLookup, remappedParents } from "./parenting";
import { audioTrackIds, withHeardTracks } from "./behaviors";
import { freshClip } from "./clip-copy";
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

export function slipClip(doc: VideoDocument, clipId: string, deltaMs: number, sourceDurationMs?: number): VideoDocument {
  const found = findClip(doc, clipId);
  if (!found) return doc;
  return setClipTrimIn(doc, clipId, found.clip.trimInMs + deltaMs, sourceDurationMs);
}

interface TimeRange {
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

function pastedParents(doc: VideoDocument, created: readonly CreatedClip[], renamed: ReadonlyMap<string, string>): CreatedClip[] {
  const audio = audioTrackIds(doc);
  const relinked = remappedParents(created.map((entry) => withHeardTracks(entry.clip, audio)), renamed);
  const existing = clipLookup(doc);
  const pasted = new Set(renamed.values());
  return created.map((entry, index) => {
    const clip = relinked[index];
    if (!clip.parentId || pasted.has(clip.parentId) || existing.has(clip.parentId)) return { ...entry, clip };
    const free: Clip = { ...clip };
    delete free.parentId;
    delete free.parentTracker;
    return { ...entry, clip: free };
  });
}

function pastedClips(doc: VideoDocument, payload: ClipboardPayload, atMs: number): CreatedClip[] | null {
  const links = new Map<string, string>();
  const renamed = new Map<string, string>();
  const created: CreatedClip[] = [];
  for (const item of payload.items) {
    const original = doc.tracks.find((t) => t.id === item.trackId && !t.locked && trackAccepts(t.kind, item.clip.type));
    const track = original ?? doc.tracks.find((t) => !t.locked && t.kind === item.trackKind && trackAccepts(t.kind, item.clip.type));
    if (!track) return null;
    const linkId = item.clip.linkId ? (links.get(item.clip.linkId) ?? links.set(item.clip.linkId, newStudioId("k")).get(item.clip.linkId)!) : undefined;
    const clip: Clip = { ...freshClip(item.clip), startMs: Math.round(atMs + item.offsetMs), linkId };
    if (!linkId) delete clip.linkId;
    renamed.set(item.clip.id, clip.id);
    created.push({ trackId: track.id, clip });
  }
  return pastedParents(doc, created, renamed);
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

export function setClipsDisabled(doc: VideoDocument, ids: readonly string[], disabled: boolean): VideoDocument {
  const flip = ids.filter((id) => {
    const found = findClip(doc, id);
    return found !== null && Boolean(found.clip.disabled) !== disabled;
  });
  return flip.length > 0 ? toggleDisabled(doc, flip) : doc;
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
