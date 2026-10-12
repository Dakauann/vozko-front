import { produce } from "immer";

import { STUDIO_LIMITS, type Clip, type Marker, type Track, type VideoDocument } from "./document";
import { localAtSource, sourceAt } from "./clip-time";
import { carriesOnly } from "./vfx";
import { CLIP_TAG_FIELDS, GUIDE_FIELD } from "./labels";
import type { IssueCode } from "./validate";

export type GroupClip = Clip & { type: "group"; tracks: Track[] };

export type GroupPath = readonly string[];

export const ROOT_PATH: GroupPath = [];

export const GROUP_FIELDS: ReadonlySet<string> = new Set([
  ...CLIP_TAG_FIELDS,
  GUIDE_FIELD,
  "id",
  "type",
  "startMs",
  "durationMs",
  "trimInMs",
  "volume",
  "fadeInMs",
  "fadeOutMs",
  "transform",
  "keyframes",
  "linkId",
  "motionIn",
  "motionOut",
  "transitionIn",
  "transitionOut",
  "disabled",
  "blur",
  "speed",
  "color",
  "masks",
  "matte",
  "matteChannel",
  "matteInvert",
  "blendMode",
  "vfx",
  "anchor",
  "flipX",
  "flipY",
  "autoOrient",
  "rotationX",
  "rotationY",
  "parentId",
  "tracks",
]);

export function isGroupClip(clip: Pick<Clip, "type"> | null | undefined): clip is GroupClip {
  return clip?.type === "group";
}

export function groupClipIssue(clip: Clip): IssueCode | null {
  return !carriesOnly(clip, GROUP_FIELDS) || (clip.keyframes?.speed?.length ?? 0) > 0 ? "invalid" : null;
}

export function tracksEnd(tracks: readonly Track[]): number {
  return tracks.reduce((max, track) => track.clips.reduce((end, clip) => Math.max(end, clip.startMs + clip.durationMs), max), 0);
}

export function groupContentMs(group: Pick<Clip, "tracks">): number {
  return tracksEnd(group.tracks ?? []);
}

export function sourceLengthOf(clip: Pick<Clip, "type" | "assetId" | "tracks">, assetMs: (assetId: string) => number | undefined): number | undefined {
  if (isGroupClip(clip)) return groupContentMs(clip);
  return clip.assetId ? assetMs(clip.assetId) : undefined;
}

export function innerMsAt(group: Clip, outerMs: number): number {
  return sourceAt(group, outerMs - group.startMs);
}

export function outerMsAt(group: Clip, innerMs: number): number {
  return group.startMs + localAtSource(group, innerMs);
}

function shownMarkers(markers: readonly Marker[] | undefined, group: Clip): Marker[] {
  return (markers ?? []).filter((marker) => marker.atMs >= group.startMs && marker.atMs <= group.startMs + group.durationMs).map((marker) => ({ ...marker, atMs: Math.round(innerMsAt(group, marker.atMs)) }));
}

export function directGroup(doc: Pick<VideoDocument, "tracks">, groupId: string): GroupClip | null {
  for (const track of doc.tracks) for (const clip of track.clips) if (clip.id === groupId && isGroupClip(clip)) return clip;
  return null;
}

export function groupTimeline(doc: VideoDocument, group: GroupClip): VideoDocument {
  const markers = shownMarkers(doc.markers, group);
  const view: VideoDocument = { schema: doc.schema, version: doc.version, canvas: doc.canvas, durationMs: Math.min(groupContentMs(group), STUDIO_LIMITS.maxVideoMs), tracks: group.tracks };
  return markers.length > 0 ? { ...view, markers } : view;
}

export function timelineAt(doc: VideoDocument, path: GroupPath): VideoDocument | null {
  let current: VideoDocument = doc;
  for (const id of path) {
    const group = directGroup(current, id);
    if (!group) return null;
    current = groupTimeline(current, group);
  }
  return current;
}

export function validPath(doc: VideoDocument, path: GroupPath): GroupPath {
  const kept: string[] = [];
  let current: VideoDocument = doc;
  for (const id of path) {
    const group = directGroup(current, id);
    if (!group) break;
    kept.push(id);
    current = groupTimeline(current, group);
  }
  return kept;
}

function sameMarker(a: Marker | undefined, b: Marker): boolean {
  return a !== undefined && a.atMs === b.atMs && (a.label ?? "") === (b.label ?? "");
}

function mergedMarkers(outer: readonly Marker[] | undefined, shown: readonly Marker[], edited: readonly Marker[] | undefined, group: Clip): Marker[] {
  const before = new Map(shown.map((marker) => [marker.id, marker]));
  const after = new Map((edited ?? []).map((marker) => [marker.id, marker]));
  const kept = (outer ?? []).filter((marker) => !before.has(marker.id) || after.has(marker.id));
  const merged = kept.map((marker) => {
    const next = after.get(marker.id);
    if (!next || sameMarker(before.get(marker.id), next)) return marker;
    return { ...next, atMs: clampedMs(outerMsAt(group, next.atMs)) };
  });
  for (const marker of edited ?? []) if (!before.has(marker.id) && !kept.some((known) => known.id === marker.id)) merged.push({ ...marker, atMs: clampedMs(outerMsAt(group, marker.atMs)) });
  return merged.sort((a, b) => a.atMs - b.atMs);
}

function clampedMs(ms: number): number {
  return Math.min(Math.max(0, Math.round(ms)), STUDIO_LIMITS.maxVideoMs);
}

export function withTimelineAt(doc: VideoDocument, path: GroupPath, operation: (timeline: VideoDocument) => VideoDocument): VideoDocument {
  if (path.length === 0) return operation(doc);
  const [id, ...rest] = path;
  const group = directGroup(doc, id);
  if (!group) return doc;
  const inner = groupTimeline(doc, group);
  const edited = withTimelineAt(inner, rest, operation);
  if (edited === inner) return doc;
  const markers = edited.markers === inner.markers ? doc.markers : mergedMarkers(doc.markers, inner.markers ?? [], edited.markers, group);
  return produce(doc, (draft) => {
    for (const track of draft.tracks) {
      const target = track.clips.find((clip) => clip.id === id);
      if (target) target.tracks = edited.tracks as Track[];
    }
    if (edited.canvas !== inner.canvas) draft.canvas = edited.canvas;
    if (markers === doc.markers) return;
    if (markers && markers.length > 0) draft.markers = markers;
    else delete draft.markers;
  });
}

export interface PlacedClip {
  clip: Clip;
  track: Track;
  path: GroupPath;
}

export function* nestedClips(tracks: readonly Track[], path: GroupPath = ROOT_PATH): Generator<PlacedClip> {
  for (const track of tracks) {
    for (const clip of track.clips) {
      yield { clip, track, path };
      if (isGroupClip(clip)) yield* nestedClips(clip.tracks, [...path, clip.id]);
    }
  }
}

export function* nestedTracks(tracks: readonly Track[], path: GroupPath = ROOT_PATH): Generator<{ track: Track; path: GroupPath }> {
  for (const track of tracks) {
    yield { track, path };
    for (const clip of track.clips) if (isGroupClip(clip)) yield* nestedTracks(clip.tracks, [...path, clip.id]);
  }
}

export function pathOfId(doc: Pick<VideoDocument, "tracks">, id: string): GroupPath | null {
  for (const { track, path } of nestedTracks(doc.tracks)) {
    if (track.id === id || track.clips.some((clip) => clip.id === id) || (track.transitions ?? []).some((transition) => transition.id === id)) return path;
  }
  return null;
}

export function insidePath(doc: Pick<VideoDocument, "tracks">, groupId: string): GroupPath | null {
  for (const { clip, path } of nestedClips(doc.tracks)) if (clip.id === groupId) return isGroupClip(clip) ? [...path, clip.id] : null;
  return null;
}

export function commonPath(doc: Pick<VideoDocument, "tracks">, ids: readonly string[]): GroupPath | null {
  let found: GroupPath | null = null;
  for (const id of ids) {
    const path = pathOfId(doc, id);
    if (!path) return null;
    if (found && (found.length !== path.length || found.some((step, i) => step !== path[i]))) return null;
    found = path;
  }
  return found;
}

export function groupChain(doc: VideoDocument, path: GroupPath): GroupClip[] {
  const chain: GroupClip[] = [];
  let current: VideoDocument = doc;
  for (const id of path) {
    const group = directGroup(current, id);
    if (!group) return [];
    chain.push(group);
    current = groupTimeline(current, group);
  }
  return chain;
}

export function rootMsAt(doc: VideoDocument, path: GroupPath, innerMs: number): number {
  return groupChain(doc, path).reduceRight((ms, group) => outerMsAt(group, ms), innerMs);
}

export function pathMsAt(doc: VideoDocument, path: GroupPath, rootMs: number): number {
  return groupChain(doc, path).reduce((ms, group) => innerMsAt(group, ms), rootMs);
}
