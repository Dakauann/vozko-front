import { anchorOf, anchorOffset, placedPivot } from "./clip-placement";
import { localAtSource } from "./clip-time";
import { canvasAspect, frameOf, msOfFrame, type Clip, type VideoDocument } from "./document";
import { KEYFRAME_RANGES, type Keyframe, type Keyframes } from "./keyframes";
import { setParents, type ParentRefusal } from "./parent-edit";
import { ancestorIds, clipLookup, parentFrameOf, pointToLocal, reframe, takesParent, trackedPointIn, worldPlacementAt } from "./parenting";
import { neededZoom, stabilizeSpan, trackerOf, TRACKER_LIMITS, type PointTracker, type Stabilize, type StabilizeChoice } from "./point-track";
import { clipEnd, findClip, updateClip } from "./timeline";
import { documentIssue } from "./validate";
import type { PathPoint } from "./position-path";

export type TrackEditRefusal = ParentRefusal | "notVideo" | "frozen" | "needsSecond" | "tooMuchMotion" | "noOverlap";

export type TrackEdit = { ok: true; document: VideoDocument } | { ok: false; reason: TrackEditRefusal };

export type AttachMode = "link" | "keys";

export const ATTACH_MODES: readonly AttachMode[] = ["link", "keys"];

export interface AttachOptions {
  mode: AttachMode;
  keepVisual: boolean;
  atMs: number;
}

export interface StabilizeRequest extends StabilizeChoice {
  zoom?: number;
}

function checked(before: VideoDocument, after: VideoDocument): TrackEdit {
  if (after === before) return { ok: true, document: before };
  return documentIssue("video", after) ? { ok: false, reason: "invalid" } : { ok: true, document: after };
}

type Found = { ok: true; clip: Clip } | { ok: false; reason: TrackEditRefusal };

function videoClip(doc: VideoDocument, clipId: string): Found {
  const found = findClip(doc, clipId);
  if (!found) return { ok: false, reason: "missing" };
  if (found.track.locked) return { ok: false, reason: "locked" };
  if (found.clip.type !== "video") return { ok: false, reason: "notVideo" };
  if (found.clip.freeze) return { ok: false, reason: "frozen" };
  return { ok: true, clip: found.clip };
}

export function putTracker(doc: VideoDocument, clipId: string, tracker: PointTracker): TrackEdit {
  const found = videoClip(doc, clipId);
  if (!found.ok) return found;
  const trackers = found.clip.trackers ?? [];
  const index = trackers.findIndex((known) => known.id === tracker.id);
  const next = index < 0 ? [...trackers, tracker] : trackers.map((known, i) => (i === index ? tracker : known));
  return checked(doc, updateClip(doc, clipId, { trackers: next }));
}

export function followersOf(doc: VideoDocument, clipId: string, trackerId?: string): Clip[] {
  return doc.tracks.flatMap((track) => track.clips.filter((clip) => clip.parentId === clipId && clip.parentTracker !== undefined && (trackerId === undefined || clip.parentTracker === trackerId)));
}

export function removeTracker(doc: VideoDocument, clipId: string, trackerId: string): TrackEdit {
  const found = findClip(doc, clipId);
  if (!found) return { ok: false, reason: "missing" };
  if (found.track.locked) return { ok: false, reason: "locked" };
  if (!trackerOf(found.clip, trackerId)) return { ok: false, reason: "noTracker" };
  const lookup = clipLookup(doc);
  const aspect = canvasAspect(doc);
  let next = doc;
  for (const follower of followersOf(doc, clipId, trackerId)) {
    const result = reframe(follower, 0, { from: parentFrameOf(lookup, follower, follower.startMs, aspect), to: parentFrameOf(lookup, { parentId: clipId }, follower.startMs, aspect), parented: true, strict: false }, aspect);
    const placed = typeof result === "string" ? { transform: follower.transform, keyframes: follower.keyframes } : result;
    next = updateClip(next, follower.id, { ...placed, parentTracker: undefined });
  }
  const clip = found.clip;
  const trackers = (clip.trackers ?? []).filter((tracker) => tracker.id !== trackerId);
  const steadied = clip.stabilize && clip.stabilize.trackerId !== trackerId && clip.stabilize.secondTrackerId !== trackerId;
  next = updateClip(next, clipId, { trackers: trackers.length > 0 ? trackers : undefined, stabilize: steadied ? clip.stabilize : undefined });
  return checked(doc, next);
}

export function stabilizeClip(doc: VideoDocument, clipId: string, request: StabilizeRequest): TrackEdit {
  const found = videoClip(doc, clipId);
  if (!found.ok) return found;
  const clip = found.clip;
  if (!trackerOf(clip, request.trackerId) || (request.secondTrackerId && !trackerOf(clip, request.secondTrackerId))) return { ok: false, reason: "noTracker" };
  if (request.secondTrackerId === request.trackerId) return { ok: false, reason: "invalid" };
  if ((request.rotation || request.scale) && !request.secondTrackerId) return { ok: false, reason: "needsSecond" };
  const choice: StabilizeChoice = {
    trackerId: request.trackerId,
    ...(request.secondTrackerId ? { secondTrackerId: request.secondTrackerId } : {}),
    ...(request.rotation ? { rotation: true } : {}),
    ...(request.scale ? { scale: true } : {}),
    ...(request.smoothMs ? { smoothMs: Math.round(request.smoothMs) } : {}),
  };
  if (choice.smoothMs !== undefined && (choice.smoothMs < TRACKER_LIMITS.smoothMs[0] || choice.smoothMs > TRACKER_LIMITS.smoothMs[1])) return { ok: false, reason: "outOfRange" };
  const zoom = request.zoom ?? neededZoom(clip, choice, stabilizeSpan(clip));
  if (zoom === null) return { ok: false, reason: "tooMuchMotion" };
  if (!(zoom >= TRACKER_LIMITS.zoom[0] && zoom <= TRACKER_LIMITS.zoom[1])) return { ok: false, reason: "outOfRange" };
  const stabilize: Stabilize = { ...choice, zoom };
  return checked(doc, updateClip(doc, clipId, { stabilize }));
}

export function unstabilizeClip(doc: VideoDocument, clipId: string): TrackEdit {
  const found = findClip(doc, clipId);
  if (!found) return { ok: false, reason: "missing" };
  if (found.track.locked) return { ok: false, reason: "locked" };
  if (!found.clip.stabilize) return { ok: true, document: doc };
  return checked(doc, updateClip(doc, clipId, { stabilize: undefined }));
}

function laneOf(times: readonly number[], values: readonly number[]): Keyframe[] {
  return times.map((atMs, i) => ({ atMs, value: values[i], easing: "linear" }));
}

function overlapFrames(a: Clip, b: Clip): number[] {
  const start = Math.max(a.startMs, b.startMs);
  const end = Math.min(clipEnd(a), clipEnd(b));
  const times: number[] = [];
  for (let frame = frameOf(start) - 1; frame <= frameOf(end) + 1; frame++) {
    const ms = msOfFrame(frame);
    if (ms >= start && ms < end) times.push(ms);
  }
  return times;
}

function bakeOne(doc: VideoDocument, clipId: string, videoId: string, tracker: PointTracker, options: AttachOptions): TrackEdit {
  const found = findClip(doc, clipId);
  if (!found) return { ok: false, reason: "missing" };
  if (found.track.locked) return { ok: false, reason: "locked" };
  const follower = found.clip;
  if (!takesParent(follower.type)) return { ok: false, reason: "notParentable" };
  if (clipId === videoId) return { ok: false, reason: "self" };
  const lookup = clipLookup(doc);
  const video = lookup.get(videoId)!;
  if (ancestorIds(lookup, video).includes(clipId)) return { ok: false, reason: "cycle" };
  const times = overlapFrames(follower, video);
  if (times.length === 0) return { ok: false, reason: "noOverlap" };
  const aspect = canvasAspect(doc);
  const pointAt = (ms: number) => trackedPointIn(lookup, video, tracker, ms, aspect);
  const pivotAt = (ms: number) => placedPivot(worldPlacementAt(lookup, follower, ms - follower.startMs, aspect), anchorOf(follower), aspect);
  const at = Math.min(Math.max(Math.round(options.atMs), times[0]), times[times.length - 1]);
  const offset: PathPoint = options.keepVisual ? { x: pivotAt(at).x - pointAt(at).x, y: pivotAt(at).y - pointAt(at).y } : { x: 0, y: 0 };
  const shift = anchorOffset(anchorOf(follower), follower.transform.w, follower.transform.h);
  const xs: number[] = [];
  const ys: number[] = [];
  const [low, high] = KEYFRAME_RANGES.x;
  for (const ms of times) {
    const point = pointAt(ms);
    const local = pointToLocal(parentFrameOf(lookup, follower, ms, aspect), { x: point.x + offset.x, y: point.y + offset.y }, aspect);
    if (!local) return { ok: false, reason: "degenerate" };
    const x = local.x - shift.x;
    const y = local.y - shift.y;
    if (!(x >= low && x <= high && y >= low && y <= high)) return { ok: false, reason: "outOfRange" };
    xs.push(x);
    ys.push(y);
  }
  const keyTimes = times.map((ms) => ms - follower.startMs);
  const keyframes: Keyframes = { ...follower.keyframes, x: laneOf(keyTimes, xs), y: laneOf(keyTimes, ys) };
  delete keyframes.position;
  return checked(doc, updateClip(doc, clipId, { keyframes }));
}

export function attachToTracker(doc: VideoDocument, clipIds: readonly string[], videoId: string, trackerId: string, options: AttachOptions): TrackEdit {
  const video = findClip(doc, videoId);
  if (!video) return { ok: false, reason: "missing" };
  if (video.clip.type !== "video") return { ok: false, reason: "notVideo" };
  const tracker = trackerOf(video.clip, trackerId);
  if (!tracker) return { ok: false, reason: "noTracker" };
  if (clipIds.length === 0) return { ok: false, reason: "missing" };
  if (options.mode === "link") return setParents(doc, clipIds, videoId, { keepVisual: options.keepVisual, atMs: options.atMs, trackerId });
  let current = doc;
  for (const id of clipIds) {
    const edit = bakeOne(current, id, videoId, tracker, options);
    if (!edit.ok) return edit;
    current = edit.document;
  }
  return { ok: true, document: current };
}

export function attachChoices(doc: VideoDocument, videoId: string): Clip[] {
  const lookup = clipLookup(doc);
  const video = lookup.get(videoId);
  if (!video) return [];
  const above = new Set(ancestorIds(lookup, video));
  return doc.tracks.flatMap((track) => track.clips.filter((clip) => clip.id !== videoId && takesParent(clip.type) && !above.has(clip.id)));
}

export function nextTrackerNumber(clip: Pick<Clip, "trackers">): number {
  return (clip.trackers?.length ?? 0) + 1;
}

export function trackerPath(doc: VideoDocument, clipId: string, trackerId: string): PathPoint[] {
  const lookup = clipLookup(doc);
  const clip = lookup.get(clipId);
  const tracker = clip ? trackerOf(clip, trackerId) : undefined;
  if (!clip || !tracker) return [];
  const aspect = canvasAspect(doc);
  return tracker.samples.flatMap((sample) => {
    const local = localAtSource(clip, sample.atMs);
    return local >= 0 && local <= clip.durationMs ? [trackedPointIn(lookup, clip, tracker, clip.startMs + local, aspect)] : [];
  });
}

export function trackerPointNow(doc: VideoDocument, clipId: string, trackerId: string, timelineMs: number): PathPoint | null {
  const lookup = clipLookup(doc);
  const clip = lookup.get(clipId);
  const tracker = clip ? trackerOf(clip, trackerId) : undefined;
  return clip && tracker ? trackedPointIn(lookup, clip, tracker, timelineMs, canvasAspect(doc)) : null;
}
