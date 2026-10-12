import { canvasAspect, newNullClip, type Clip, type VideoDocument } from "./document";
import { clipLookup, createsCycle, parentFrameOf, reframe, takesParent } from "./parenting";
import { trackerOf } from "./point-track";
import { DEFAULT_OVERLAY_MS } from "./media-clips";
import { documentIssue } from "./validate";
import { clipEnd, findClip, placeClip, updateClip } from "./timeline";

export type ParentRefusal = "missing" | "locked" | "notParentable" | "self" | "cycle" | "degenerate" | "outOfRange" | "noRoom" | "noTracker" | "invalid";

export type ParentEdit = { ok: true; document: VideoDocument } | { ok: false; reason: ParentRefusal };

export interface ParentOptions {
  keepVisual: boolean;
  atMs: number;
  trackerId?: string;
}

function checked(before: VideoDocument, after: VideoDocument): ParentEdit {
  if (after === before) return { ok: true, document: before };
  return documentIssue("video", after) ? { ok: false, reason: "invalid" } : { ok: true, document: after };
}

export function parentRefusal(doc: VideoDocument, clipId: string, parentId: string): ParentRefusal | null {
  const child = findClip(doc, clipId);
  const parent = findClip(doc, parentId);
  if (!child || !parent) return "missing";
  if (!takesParent(child.clip.type) || !takesParent(parent.clip.type)) return "notParentable";
  if (parentId === clipId) return "self";
  return createsCycle(clipLookup(doc), clipId, parentId) ? "cycle" : null;
}

export function setClipParent(doc: VideoDocument, clipId: string, parentId: string | null, options: ParentOptions): ParentEdit {
  const found = findClip(doc, clipId);
  if (!found) return { ok: false, reason: "missing" };
  if (found.track.locked) return { ok: false, reason: "locked" };
  const { clip } = found;
  if (!takesParent(clip.type)) return { ok: false, reason: "notParentable" };
  const refusal = parentId === null ? null : parentRefusal(doc, clipId, parentId);
  if (refusal) return { ok: false, reason: refusal };
  const trackerId = parentId === null ? undefined : options.trackerId;
  if (trackerId !== undefined && !trackerOf(findClip(doc, parentId!)!.clip, trackerId)) return { ok: false, reason: "noTracker" };
  if ((clip.parentId ?? null) === parentId && clip.parentTracker === trackerId) return { ok: true, document: doc };
  const link = { parentId: parentId ?? undefined, parentTracker: trackerId };
  if (!options.keepVisual) return checked(doc, updateClip(doc, clipId, link));
  const lookup = clipLookup(doc);
  const aspect = canvasAspect(doc);
  const atMs = Math.min(Math.max(Math.round(options.atMs), clip.startMs), clipEnd(clip));
  const result = reframe(clip, atMs - clip.startMs, { from: parentFrameOf(lookup, clip, atMs, aspect), to: parentFrameOf(lookup, link, atMs, aspect), parented: parentId !== null, strict: true }, aspect);
  if (typeof result === "string") return { ok: false, reason: result };
  return checked(doc, updateClip(doc, clipId, { ...result, ...link }));
}

export function setParents(doc: VideoDocument, clipIds: readonly string[], parentId: string | null, options: ParentOptions): ParentEdit {
  let current = doc;
  for (const id of clipIds) {
    const edit = setClipParent(current, id, parentId, options);
    if (!edit.ok) return edit;
    current = edit.document;
  }
  return { ok: true, document: current };
}

export function parentChoices(doc: VideoDocument, clipIds: readonly string[]): Clip[] {
  return doc.tracks.flatMap((track) => track.clips.filter((candidate) => clipIds.every((id) => parentRefusal(doc, id, candidate.id) === null)));
}

export interface NullPlacement {
  startMs: number;
  durationMs?: number;
  x?: number;
  y?: number;
  trackId?: string;
}

export function nullClipFor(documentMs: number, placement: NullPlacement): Clip {
  return newNullClip(placement.startMs, placement.durationMs ?? Math.max(documentMs - placement.startMs, DEFAULT_OVERLAY_MS), placement.x, placement.y);
}

export function insertNull(doc: VideoDocument, placement: NullPlacement): { ok: true; document: VideoDocument; clipId: string } | { ok: false; reason: ParentRefusal } {
  const clip = nullClipFor(doc.durationMs, placement);
  const placed = placeClip(doc, clip, { preferTrackId: placement.trackId });
  if (!placed.clipId) return { ok: false, reason: "noRoom" };
  const edit = checked(doc, placed.document);
  return edit.ok ? { ok: true, document: edit.document, clipId: placed.clipId } : edit;
}
