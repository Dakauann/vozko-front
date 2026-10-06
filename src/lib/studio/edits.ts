import { produce } from "immer";

import { newStudioId, STUDIO_LIMITS, type Clip, type VideoDocument } from "./document";
import { KEYFRAME_LIMITS, keyframeCount, shiftKeyframes } from "./keyframes";
import { addTrack, clampClipTiming, clipEnd, contentDuration, findClip, insertClip, isRangeFree, hasSourceTime, moveClipToward, settleTimeline, splitClip, trackAccepts } from "./timeline";

export interface ClipChange {
  trackId?: string;
  startMs?: number;
  durationMs?: number;
  trimInMs?: number;
  keyShiftMs?: number;
}

export interface CreatedClip {
  trackId: string;
  clip: Clip;
}

export type ClipSource = (clipId: string) => number | undefined;

export function rearrange(
  doc: VideoDocument,
  changes: ReadonlyMap<string, ClipChange>,
  created: readonly CreatedClip[] = [],
  removed: readonly string[] = [],
): VideoDocument | null {
  const gone = new Set(removed);
  const touched = new Set<string>();
  const layout = new Map<string, Clip[]>(doc.tracks.map((t) => [t.id, []]));
  for (const track of doc.tracks) {
    for (const clip of track.clips) {
      const change = changes.get(clip.id);
      if (gone.has(clip.id)) {
        touched.add(track.id);
        continue;
      }
      if (!change) {
        layout.get(track.id)!.push(clip);
        continue;
      }
      const target = change.trackId ?? track.id;
      if (!layout.has(target)) return null;
      touched.add(track.id);
      touched.add(target);
      layout.get(target)!.push({
        ...clip,
        startMs: Math.round(change.startMs ?? clip.startMs),
        durationMs: Math.round(change.durationMs ?? clip.durationMs),
        trimInMs: Math.round(change.trimInMs ?? clip.trimInMs),
        ...(change.keyShiftMs && clip.keyframes ? { keyframes: shiftKeyframes(clip.keyframes, change.keyShiftMs) } : {}),
      });
    }
  }
  for (const { trackId, clip } of created) {
    if (!layout.has(trackId)) return null;
    touched.add(trackId);
    layout.get(trackId)!.push(clip);
  }
  let count = 0;
  for (const track of doc.tracks) {
    const clips = layout.get(track.id)!.sort((a, b) => a.startMs - b.startMs);
    count += clips.length;
    if (!touched.has(track.id)) continue;
    if (track.locked) return null;
    let lastEnd = 0;
    for (const clip of clips) {
      if (!trackAccepts(track.kind, clip.type)) return null;
      if (clip.startMs < lastEnd || clip.startMs < 0 || clip.trimInMs < 0 || clip.durationMs < STUDIO_LIMITS.minClipMs) return null;
      if (clipEnd(clip) > STUDIO_LIMITS.maxVideoMs) return null;
      lastEnd = clipEnd(clip);
    }
  }
  if (count > STUDIO_LIMITS.maxClips) return null;
  const keys = [...layout.values()].reduce((total, clips) => clips.reduce((sum, c) => sum + keyframeCount(c.keyframes), total), 0);
  if (keys > KEYFRAME_LIMITS.perTimeline) return null;
  return produce(doc, (draft) => {
    for (const track of draft.tracks) {
      if (!touched.has(track.id)) continue;
      track.clips = layout.get(track.id)!.map((clip) => ({ ...clip }));
      for (const clip of track.clips) clampClipTiming(clip);
    }
    settleTimeline(draft);
  });
}

export function linkGroup(doc: VideoDocument, clipId: string): string[] {
  const found = findClip(doc, clipId);
  if (!found) return [];
  const linkId = found.clip.linkId;
  if (!linkId) return [clipId];
  return doc.tracks.flatMap((t) => t.clips.filter((c) => c.linkId === linkId).map((c) => c.id));
}

export function withLinked(doc: VideoDocument, ids: readonly string[]): string[] {
  const out = new Set<string>();
  for (const id of ids) for (const linked of linkGroup(doc, id)) out.add(linked);
  return [...out];
}

export function linkClips(doc: VideoDocument, ids: readonly string[]): VideoDocument {
  const found = ids.map((id) => findClip(doc, id)).filter((f) => f !== null);
  if (found.length < 2 || found.some((f) => f.track.locked)) return doc;
  const linkId = newStudioId("k");
  return produce(doc, (draft) => {
    for (const track of draft.tracks) for (const clip of track.clips) if (ids.includes(clip.id)) clip.linkId = linkId;
  });
}

export function unlinkClips(doc: VideoDocument, ids: readonly string[]): VideoDocument {
  const links = new Set(ids.map((id) => findClip(doc, id)?.clip.linkId).filter((l): l is string => Boolean(l)));
  if (links.size === 0) return doc;
  return produce(doc, (draft) => {
    for (const track of draft.tracks) {
      if (track.locked) continue;
      for (const clip of track.clips) if (clip.linkId && links.has(clip.linkId)) delete clip.linkId;
    }
  });
}

export function shiftChanges(doc: VideoDocument, ids: readonly string[], deltaMs: number, primary?: { id: string; trackId: string }): Map<string, ClipChange> {
  const changes = new Map<string, ClipChange>();
  for (const id of ids) {
    const found = findClip(doc, id);
    if (!found) continue;
    changes.set(id, { startMs: found.clip.startMs + deltaMs, trackId: primary?.id === id ? primary.trackId : found.track.id });
  }
  return changes;
}

function targetTrack(doc: VideoDocument, clipId: string, hoveredTrackId: string | null): string | null {
  const found = findClip(doc, clipId);
  if (!found) return null;
  const hovered = doc.tracks.find((t) => t.id === hoveredTrackId);
  return hovered && !hovered.locked && trackAccepts(hovered.kind, found.clip.type) ? hovered.id : found.track.id;
}

export function moveGroup(doc: VideoDocument, primaryId: string, ids: readonly string[], hoveredTrackId: string | null, startMs: number): VideoDocument {
  const primary = findClip(doc, primaryId);
  const trackId = targetTrack(doc, primaryId, hoveredTrackId);
  if (!primary || !trackId) return doc;
  const group = ids.includes(primaryId) ? ids : [primaryId, ...ids];
  const earliest = Math.min(...group.map((id) => findClip(doc, id)?.clip.startMs ?? Infinity));
  const delta = Math.max(Math.round(startMs) - primary.clip.startMs, -earliest);
  const exact = rearrange(doc, shiftChanges(doc, group, delta, { id: primaryId, trackId }));
  if (exact) return exact;
  return group.length === 1 ? moveClipToward(doc, primaryId, hoveredTrackId, startMs) : doc;
}

function insertionPoint(doc: VideoDocument, trackId: string, atMs: number, ignore: ReadonlySet<string>): number {
  const track = doc.tracks.find((t) => t.id === trackId);
  const inside = track?.clips.find((c) => !ignore.has(c.id) && c.startMs < atMs && atMs < clipEnd(c));
  if (!inside) return Math.max(0, Math.round(atMs));
  return atMs - inside.startMs < clipEnd(inside) - atMs ? inside.startMs : clipEnd(inside);
}

export function insertGroup(doc: VideoDocument, primaryId: string, ids: readonly string[], hoveredTrackId: string | null, atMs: number): VideoDocument {
  const primary = findClip(doc, primaryId);
  const trackId = targetTrack(doc, primaryId, hoveredTrackId);
  if (!primary || !trackId) return doc;
  const group = new Set(ids.includes(primaryId) ? ids : [primaryId, ...ids]);
  const at = insertionPoint(doc, trackId, atMs, group);
  const target = doc.tracks.find((t) => t.id === trackId)!;
  const pushed = withLinked(
    doc,
    target.clips.filter((c) => !group.has(c.id) && c.startMs >= at).map((c) => c.id),
  ).filter((id) => !group.has(id));
  const changes = shiftChanges(doc, pushed, primary.clip.durationMs);
  for (const [id, change] of shiftChanges(doc, [...group], at - primary.clip.startMs, { id: primaryId, trackId })) changes.set(id, change);
  return rearrange(doc, changes) ?? doc;
}

export function clearRange(doc: VideoDocument, trackId: string, fromMs: number, toMs: number, ignore: ReadonlySet<string> = new Set()): VideoDocument | null {
  const track = doc.tracks.find((t) => t.id === trackId);
  if (!track) return null;
  const changes = new Map<string, ClipChange>();
  const created: CreatedClip[] = [];
  const removed: string[] = [];
  for (const clip of track.clips) {
    const end = clipEnd(clip);
    if (ignore.has(clip.id) || end <= fromMs || clip.startMs >= toMs) continue;
    const keepLeft = fromMs - clip.startMs;
    const keepRight = end - toMs;
    const sourced = hasSourceTime(clip.type);
    if (keepLeft >= STUDIO_LIMITS.minClipMs) changes.set(clip.id, { durationMs: keepLeft });
    if (keepRight >= STUDIO_LIMITS.minClipMs) {
      const piece = { startMs: toMs, durationMs: keepRight, trimInMs: sourced ? clip.trimInMs + (toMs - clip.startMs) : clip.trimInMs, keyShiftMs: clip.startMs - toMs };
      if (changes.has(clip.id)) {
        const { keyShiftMs, ...placed } = piece;
        const keyframes = shiftKeyframes(clip.keyframes, keyShiftMs);
        created.push({ trackId, clip: { ...clip, ...placed, id: newStudioId("c"), fadeInMs: 0, motionIn: undefined, linkId: undefined, ...(keyframes ? { keyframes } : {}) } });
      }
      else changes.set(clip.id, piece);
    }
    if (!changes.has(clip.id)) removed.push(clip.id);
  }
  if (changes.size === 0 && created.length === 0 && removed.length === 0) return doc;
  return rearrange(doc, changes, created, removed);
}

export function overwriteGroup(doc: VideoDocument, primaryId: string, ids: readonly string[], hoveredTrackId: string | null, startMs: number): VideoDocument {
  const primary = findClip(doc, primaryId);
  const trackId = targetTrack(doc, primaryId, hoveredTrackId);
  if (!primary || !trackId) return doc;
  const group = ids.includes(primaryId) ? ids : [primaryId, ...ids];
  const groupSet = new Set(group);
  const earliest = Math.min(...group.map((id) => findClip(doc, id)?.clip.startMs ?? Infinity));
  const delta = Math.max(Math.round(startMs) - primary.clip.startMs, -earliest);
  const moves = shiftChanges(doc, group, delta, { id: primaryId, trackId });
  let cleared: VideoDocument | null = doc;
  for (const [id, change] of moves) {
    const clip = findClip(doc, id)!.clip;
    cleared = cleared && clearRange(cleared, change.trackId!, change.startMs!, change.startMs! + clip.durationMs, groupSet);
  }
  if (!cleared) return doc;
  return rearrange(cleared, moves) ?? doc;
}

function alignedPartners(doc: VideoDocument, clipId: string, edge: "start" | "end"): string[] {
  const found = findClip(doc, clipId);
  if (!found) return [];
  const at = edge === "start" ? found.clip.startMs : clipEnd(found.clip);
  return linkGroup(doc, clipId).filter((id) => {
    if (id === clipId) return false;
    const partner = findClip(doc, id)!.clip;
    return (edge === "start" ? partner.startMs : clipEnd(partner)) === at;
  });
}

export function trimChange(clip: Clip, edge: "start" | "end", ms: number, sourceMs: number | undefined): ClipChange {
  if (edge === "end") {
    const sourceLimit = hasSourceTime(clip.type) && sourceMs !== undefined ? clip.startMs + sourceMs - clip.trimInMs : Infinity;
    const end = Math.min(Math.max(Math.round(ms), clip.startMs + STUDIO_LIMITS.minClipMs), sourceLimit, STUDIO_LIMITS.maxVideoMs);
    return { durationMs: end - clip.startMs };
  }
  const end = clipEnd(clip);
  const lowest = hasSourceTime(clip.type) ? clip.startMs - clip.trimInMs : 0;
  const start = Math.min(Math.max(Math.round(ms), lowest, 0), end - STUDIO_LIMITS.minClipMs);
  return {
    startMs: start,
    durationMs: end - start,
    trimInMs: hasSourceTime(clip.type) ? clip.trimInMs + (start - clip.startMs) : clip.trimInMs,
    keyShiftMs: clip.startMs - start,
  };
}

export function trimLinked(doc: VideoDocument, clipId: string, edge: "start" | "end", ms: number, source: ClipSource = () => undefined): VideoDocument {
  const found = findClip(doc, clipId);
  if (!found) return doc;
  const group = [clipId, ...alignedPartners(doc, clipId, edge)];
  let target = ms;
  for (let attempt = 0; attempt <= group.length; attempt++) {
    const changes = new Map<string, ClipChange>();
    const edges = group.map((id) => {
      const clip = findClip(doc, id)!.clip;
      const change = trimChange(clip, edge, target, source(id));
      changes.set(id, change);
      return edge === "end" ? clip.startMs + change.durationMs! : change.startMs!;
    });
    const agreed = edge === "end" ? Math.min(...edges) : Math.max(...edges);
    if (edges.every((value) => value === agreed)) return rearrange(doc, changes) ?? doc;
    target = agreed;
  }
  return doc;
}

export function rippleTrim(doc: VideoDocument, clipId: string, edge: "start" | "end", ms: number, source: ClipSource = () => undefined): VideoDocument {
  const found = findClip(doc, clipId);
  if (!found) return doc;
  const { clip, track } = found;
  const oldEnd = clipEnd(clip);
  const change = trimChange(clip, edge, ms, source(clipId));
  const removedHead = edge === "start" ? change.startMs! - clip.startMs : 0;
  const delta = edge === "end" ? clip.startMs + change.durationMs! - oldEnd : -removedHead;
  if (delta === 0) return doc;
  const own: ClipChange = edge === "end" ? change : { startMs: clip.startMs, durationMs: change.durationMs, trimInMs: change.trimInMs, keyShiftMs: -removedHead };
  const changes = new Map<string, ClipChange>([[clipId, own]]);
  for (const id of alignedPartners(doc, clipId, edge)) {
    const partner = findClip(doc, id)!.clip;
    const partnerChange = trimChange(partner, edge, edge === "end" ? oldEnd + delta : partner.startMs + removedHead, source(id));
    changes.set(id, edge === "end" ? partnerChange : { startMs: partner.startMs, durationMs: partnerChange.durationMs, trimInMs: partnerChange.trimInMs, keyShiftMs: -removedHead });
  }
  const followers = withLinked(
    doc,
    track.clips.filter((c) => c.startMs >= oldEnd && c.id !== clipId).map((c) => c.id),
  ).filter((id) => !changes.has(id));
  for (const [id, shift] of shiftChanges(doc, followers, delta)) changes.set(id, shift);
  return rearrange(doc, changes) ?? doc;
}

export function closeGaps(doc: VideoDocument, trackId: string): VideoDocument {
  const track = doc.tracks.find((t) => t.id === trackId);
  if (!track || track.locked) return doc;
  const changes = new Map<string, ClipChange>();
  let cursor = 0;
  for (const clip of [...track.clips].sort((a, b) => a.startMs - b.startMs)) {
    const delta = cursor - clip.startMs;
    if (delta !== 0) for (const [id, change] of shiftChanges(doc, linkGroup(doc, clip.id), delta)) changes.set(id, change);
    cursor = clipEnd(clip) + delta;
  }
  if (changes.size === 0) return doc;
  return rearrange(doc, changes) ?? doc;
}

export function duplicateGroup(doc: VideoDocument, ids: readonly string[]): { document: VideoDocument; clipIds: string[] } {
  const found = ids.map((id) => findClip(doc, id)).filter((f) => f !== null);
  if (found.length === 0) return { document: doc, clipIds: [] };
  const earliest = Math.min(...found.map((f) => f.clip.startMs));
  const span = Math.max(...found.map((f) => clipEnd(f.clip))) - earliest;
  for (const delta of [span, contentDuration(doc) - earliest]) {
    const result = duplicateBy(doc, found, delta);
    if (result) return result;
  }
  return { document: doc, clipIds: [] };
}

function duplicateBy(doc: VideoDocument, found: { clip: Clip; track: { id: string } }[], delta: number): { document: VideoDocument; clipIds: string[] } | null {
  const links = new Map<string, string>();
  const created = found.map(({ clip, track }) => {
    const linkId = clip.linkId ? (links.get(clip.linkId) ?? links.set(clip.linkId, newStudioId("k")).get(clip.linkId)!) : undefined;
    const copy: Clip = { ...clip, id: newStudioId("c"), startMs: clip.startMs + delta, linkId };
    if (clip.layer) copy.layer = { ...clip.layer, id: newStudioId("l") };
    return { trackId: track.id, clip: copy };
  });
  const document = rearrange(doc, new Map(), created);
  return document ? { document, clipIds: created.map((c) => c.clip.id) } : null;
}

export function splitAt(doc: VideoDocument, atMs: number, ids?: readonly string[]): VideoDocument {
  const wanted = ids ? new Set(ids) : null;
  const targets = doc.tracks
    .filter((t) => !t.locked)
    .flatMap((t) => t.clips)
    .filter((c) => (!wanted || wanted.has(c.id)) && c.startMs < atMs && clipEnd(c) > atMs);
  const links = new Map<string, string>();
  const rights: { id: string; linkId: string }[] = [];
  let document = doc;
  for (const clip of targets) {
    const result = splitClip(document, clip.id, atMs);
    if (!result.clipId) continue;
    document = result.document;
    if (clip.linkId) {
      if (!links.has(clip.linkId)) links.set(clip.linkId, newStudioId("k"));
      rights.push({ id: result.clipId, linkId: links.get(clip.linkId)! });
    }
  }
  if (rights.length === 0) return document;
  return produce(document, (draft) => {
    for (const { id, linkId } of rights) {
      for (const track of draft.tracks) {
        const clip = track.clips.find((c) => c.id === id);
        if (clip) clip.linkId = linkId;
      }
    }
  });
}

export function placeStack(doc: VideoDocument, clips: readonly Clip[]): { document: VideoDocument; ids: string[] } | null {
  let document = doc;
  let floor = -1;
  const ids: string[] = [];
  for (const clip of clips) {
    let index = document.tracks.findIndex(
      (track, i) => i > floor && !track.locked && trackAccepts(track.kind, clip.type) && isRangeFree(track, clip.startMs, clip.durationMs),
    );
    if (index < 0) {
      const added = addTrack(document, "visual");
      if (!added.trackId) return null;
      document = added.document;
      index = document.tracks.length - 1;
    }
    const result = insertClip(document, document.tracks[index].id, clip);
    if (!result.clipId) return null;
    document = result.document;
    ids.push(result.clipId);
    floor = index;
  }
  return { document, ids };
}

export function mainTrackId(doc: VideoDocument): string | null {
  return doc.tracks.find((t) => t.kind === "visual")?.id ?? null;
}

export function magnetize(doc: VideoDocument, enabled: boolean): VideoDocument {
  const main = mainTrackId(doc);
  return enabled && main ? closeGaps(doc, main) : doc;
}

export type PlacementMode = "move" | "insert" | "overwrite";

export interface DragModifiers {
  insert: boolean;
  overwrite: boolean;
  magnetic: boolean;
  onMainTrack: boolean;
}

export function placementMode(modifiers: DragModifiers): PlacementMode {
  if (modifiers.overwrite) return "overwrite";
  if (modifiers.insert || (modifiers.magnetic && modifiers.onMainTrack)) return "insert";
  return "move";
}

export function placeGroup(doc: VideoDocument, mode: PlacementMode, primaryId: string, ids: readonly string[], hoveredTrackId: string | null, startMs: number): VideoDocument {
  if (mode === "insert") return insertGroup(doc, primaryId, ids, hoveredTrackId, startMs);
  if (mode === "overwrite") return overwriteGroup(doc, primaryId, ids, hoveredTrackId, startMs);
  return moveGroup(doc, primaryId, ids, hoveredTrackId, startMs);
}
