import { produce } from "immer";

import { anchorOf, anchorOffset, headingOf, placedPivot, placementAt } from "./clip-placement";
import { clipTime } from "./clip-time";
import { canvasAspect, NULL_BOX, type Clip, type ClipType, type Transform, type VideoDocument } from "./document";
import { animatedProperties, KEYFRAME_RANGES, pathFramesOf, PLACEMENT_PROPERTIES, scaleAt, valueAt, type Keyframe, type Keyframes, type LaneValue } from "./keyframes";
import { behaviorLane, NO_LEVELS, type TrackLevels } from "./behaviors";
import type { PositionKeyframe, Tangent } from "./path-keys";
import type { PathPoint } from "./position-path";
import type { IssueCode } from "./validate";
import { carriesOnly } from "./vfx";
import { CLIP_TAG_FIELDS } from "./labels";
import { trackedPoint, trackerOf, type PointTracker } from "./point-track";

export interface ParentFrame {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export const WORLD_FRAME: ParentFrame = { x: 0.5, y: 0.5, rotation: 0, scaleX: 1, scaleY: 1 };

export const STILL_POSITION = [0, 1] as const;

export const PARENTED_POSITION = KEYFRAME_RANGES.x;

const PARENTABLE: ReadonlySet<ClipType> = new Set(["video", "image", "overlay", "null", "group"]);

const DEGENERATE_SCALE = 1e-6;

const MIXING = 1e-9;

export type ClipLookup = ReadonlyMap<string, Clip>;

export function takesParent(type: ClipType): boolean {
  return PARENTABLE.has(type);
}

export function positionRange(clip: Pick<Clip, "parentId">): readonly [number, number] {
  return clip.parentId ? PARENTED_POSITION : STILL_POSITION;
}

export function clipLookup(doc: VideoDocument): ClipLookup {
  const lookup = new Map<string, Clip>();
  for (const track of doc.tracks) for (const clip of track.clips) lookup.set(clip.id, clip);
  return lookup;
}

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function degrees(value: number): number {
  return (value * 180) / Math.PI;
}

function wrapHalfTurn(value: number): number {
  return value - 360 * Math.round(value / 360);
}

export function pointToWorld(frame: ParentFrame, point: PathPoint, aspect: number): PathPoint {
  const dx = (point.x - WORLD_FRAME.x) * aspect * frame.scaleX;
  const dy = (point.y - WORLD_FRAME.y) * frame.scaleY;
  const turn = radians(frame.rotation);
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return { x: frame.x + (dx * cos - dy * sin) / aspect, y: frame.y + dx * sin + dy * cos };
}

function degenerate(frame: ParentFrame): boolean {
  return !(frame.scaleX > DEGENERATE_SCALE && frame.scaleY > DEGENERATE_SCALE);
}

export function pointToLocal(frame: ParentFrame, point: PathPoint, aspect: number): PathPoint | null {
  if (degenerate(frame)) return null;
  const rx = (point.x - frame.x) * aspect;
  const ry = point.y - frame.y;
  const turn = radians(-frame.rotation);
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return { x: WORLD_FRAME.x + (rx * cos - ry * sin) / (aspect * frame.scaleX), y: WORLD_FRAME.y + (rx * sin + ry * cos) / frame.scaleY };
}

interface Axes {
  rotation: number;
  x: number;
  y: number;
}

function axesOf(frame: ParentFrame, rotation: number): Axes {
  const turn = radians(rotation);
  const ax = frame.scaleX * Math.cos(turn);
  const ay = frame.scaleY * Math.sin(turn);
  const x = Math.hypot(ax, ay);
  const y = Math.hypot(frame.scaleX * Math.sin(turn), frame.scaleY * Math.cos(turn));
  const correction = x > 0 ? wrapHalfTurn(degrees(Math.atan2(ay, ax)) - rotation) : 0;
  return { rotation: frame.rotation + rotation + correction, x, y };
}

export function boxToWorld(frame: ParentFrame, box: Transform, aspect: number): Transform {
  const center = pointToWorld(frame, box, aspect);
  const axes = axesOf(frame, box.rotation);
  return { ...box, x: center.x, y: center.y, w: box.w * axes.x, h: box.h * axes.y, rotation: axes.rotation };
}

export function boxToLocal(frame: ParentFrame, box: Transform, aspect: number): Transform | null {
  const center = pointToLocal(frame, box, aspect);
  if (!center) return null;
  const turn = box.rotation - frame.rotation;
  const rotation = turn + wrapHalfTurn(degrees(Math.atan2(frame.scaleX * Math.sin(radians(turn)), frame.scaleY * Math.cos(radians(turn)))) - turn);
  const axes = axesOf({ ...frame, rotation: 0 }, rotation);
  return { ...box, x: center.x, y: center.y, w: box.w / axes.x, h: box.h / axes.y, rotation };
}

export function composeFrame(parent: ParentFrame, local: ParentFrame, aspect: number): ParentFrame {
  const pivot = pointToWorld(parent, local, aspect);
  const axes = axesOf(parent, local.rotation);
  return { x: pivot.x, y: pivot.y, rotation: axes.rotation, scaleX: local.scaleX * axes.x, scaleY: local.scaleY * axes.y };
}

export function frameScale(clip: Pick<Clip, "type" | "keyframes">, placed: Transform, localMs: number, lane?: LaneValue): PathPoint {
  return clip.type === "null" ? { x: placed.w / NULL_BOX, y: placed.h / NULL_BOX } : scaleAt(clip.keyframes, localMs, lane);
}

export function ownFrame(clip: Clip, localMs: number, aspect: number, levels: TrackLevels = NO_LEVELS): ParentFrame {
  const lane = behaviorLane(clip, localMs, levels);
  const placed = placementAt(clip, localMs, aspect, lane);
  const pivot = placedPivot(placed, anchorOf(clip), aspect);
  const scale = frameScale(clip, placed, localMs, lane);
  return { x: pivot.x, y: pivot.y, rotation: placed.rotation, scaleX: scale.x, scaleY: scale.y };
}

export function parentOf(lookup: ClipLookup, clip: Pick<Clip, "parentId">): Clip | null {
  return clip.parentId ? (lookup.get(clip.parentId) ?? null) : null;
}

export type LinkedClip = Pick<Clip, "parentId" | "parentTracker">;

function linkedFrame(lookup: ClipLookup, clip: LinkedClip, timelineMs: number, aspect: number, levels: TrackLevels, depth: number): ParentFrame {
  const parent = parentOf(lookup, clip);
  if (!parent || depth > lookup.size) return WORLD_FRAME;
  const above = linkedFrame(lookup, parent, timelineMs, aspect, levels, depth + 1);
  const localMs = clipTime(parent, timelineMs);
  const frame = composeFrame(above, ownFrame(parent, localMs, aspect, levels), aspect);
  const tracker = trackerOf(parent, clip.parentTracker);
  if (!tracker) return frame;
  const placed = boxToWorld(above, placementAt(parent, localMs, aspect, behaviorLane(parent, localMs, levels)), aspect);
  const point = trackedPoint(parent, tracker, localMs, placed, aspect);
  return { ...frame, x: point.x, y: point.y };
}

export function frameAt(lookup: ClipLookup, clip: Clip, timelineMs: number, aspect: number, levels: TrackLevels = NO_LEVELS): ParentFrame {
  return composeFrame(linkedFrame(lookup, clip, timelineMs, aspect, levels, 0), ownFrame(clip, clipTime(clip, timelineMs), aspect, levels), aspect);
}

export function parentFrameOf(lookup: ClipLookup, clip: LinkedClip, timelineMs: number, aspect: number, levels: TrackLevels = NO_LEVELS): ParentFrame {
  return linkedFrame(lookup, clip, timelineMs, aspect, levels, 0);
}

export function worldPlacementAt(lookup: ClipLookup, clip: Clip, localMs: number, aspect: number, levels: TrackLevels = NO_LEVELS): Transform {
  const placed = placementAt(clip, localMs, aspect, behaviorLane(clip, localMs, levels));
  return clip.parentId ? boxToWorld(linkedFrame(lookup, clip, clip.startMs + localMs, aspect, levels, 0), placed, aspect) : placed;
}

export function trackedPointIn(lookup: ClipLookup, clip: Clip, tracker: PointTracker, timelineMs: number, aspect: number): PathPoint {
  const localMs = clipTime(clip, timelineMs);
  return trackedPoint(clip, tracker, localMs, worldPlacementAt(lookup, clip, localMs, aspect), aspect);
}

export function worldPlacementIn(doc: VideoDocument, clip: Clip, localMs: number, levels: TrackLevels = NO_LEVELS): Transform {
  return worldPlacementAt(clipLookup(doc), clip, localMs, canvasAspect(doc), levels);
}

export function ancestorIds(lookup: ClipLookup, clip: Pick<Clip, "parentId">): string[] {
  const seen: string[] = [];
  for (let at = clip.parentId; at && !seen.includes(at) && seen.length <= lookup.size; at = lookup.get(at)?.parentId) seen.push(at);
  return seen;
}

export function createsCycle(lookup: ClipLookup, clipId: string, parentId: string): boolean {
  return parentId === clipId || ancestorIds(lookup, { parentId }).includes(clipId);
}

export function leaders(lookup: ClipLookup, clipIds: readonly string[]): string[] {
  const chosen = new Set(clipIds);
  return clipIds.filter((id) => !ancestorIds(lookup, lookup.get(id) ?? {}).some((ancestor) => chosen.has(ancestor)));
}

export function parentsFirst<T extends { clip: Pick<Clip, "parentId"> }>(lookup: ClipLookup, items: readonly T[]): T[] {
  return [...items].sort((a, b) => ancestorIds(lookup, a.clip).length - ancestorIds(lookup, b.clip).length);
}

export function childIds(doc: VideoDocument, clipId: string): string[] {
  return doc.tracks.flatMap((track) => track.clips.filter((clip) => clip.parentId === clipId).map((clip) => clip.id));
}

export function descendantIds(doc: VideoDocument, clipId: string): string[] {
  const found: string[] = [];
  for (let wave = childIds(doc, clipId); wave.length > 0; wave = wave.flatMap((id) => childIds(doc, id)).filter((id) => !found.includes(id))) found.push(...wave);
  return found;
}

export function parentsIssue(doc: VideoDocument): IssueCode | null {
  const lookup = clipLookup(doc);
  for (const clip of lookup.values()) {
    if (clip.parentTracker && !trackerOf(parentOf(lookup, clip) ?? {}, clip.parentTracker)) return "invalid";
    if (!clip.parentId) continue;
    const parent = lookup.get(clip.parentId);
    if (!takesParent(clip.type) || !parent || !takesParent(parent.type)) return "invalid";
    const chain = ancestorIds(lookup, clip);
    if (chain.includes(clip.id) || chain.some((id) => !lookup.has(id))) return "invalid";
  }
  return null;
}

const NULL_FIELDS: ReadonlySet<string> = new Set([...CLIP_TAG_FIELDS, "id", "type", "startMs", "durationMs", "trimInMs", "volume", "fadeInMs", "fadeOutMs", "transform", "keyframes", "anchor", "autoOrient", "parentId", "parentTracker", "behaviors", "disabled"]);


export function nullClipIssue(clip: Clip): IssueCode | null {
  if (!carriesOnly(clip, NULL_FIELDS) || clip.trimInMs !== 0 || clip.fadeInMs !== 0 || clip.fadeOutMs !== 0 || clip.transform.opacity !== 1) return "invalid";
  return animatedProperties(clip.keyframes).every((property) => PLACEMENT_PROPERTIES.includes(property)) ? null : "invalid";
}

export type ReframeRefusal = "degenerate" | "outOfRange";

export interface ReframeTarget {
  from: ParentFrame;
  to: ParentFrame;
  parented: boolean;
  strict: boolean;
}

type Reframed = Pick<Clip, "transform" | "keyframes">;

function within(value: number, [low, high]: readonly [number, number]): boolean {
  return value >= low && value <= high;
}

function clamped(value: number, [low, high]: readonly [number, number]): number {
  return Math.min(high, Math.max(low, value));
}

function turnedWithin(value: number, [low, high]: readonly [number, number]): number {
  let turned = value;
  while (turned > high) turned -= 360;
  while (turned < low) turned += 360;
  return turned;
}

function laneFrames(keyframes: Keyframes | undefined, axis: "x" | "y"): readonly Keyframe[] {
  return keyframes?.[axis] ?? [];
}

function easingBefore(frames: readonly Keyframe[], atMs: number): Keyframe["easing"] {
  const before = frames.filter((frame) => frame.atMs <= atMs);
  return (before[before.length - 1] ?? frames[0])?.easing ?? "linear";
}

type PointMap = (point: PathPoint) => PathPoint;

function mappedLanes(clip: Clip, keyframes: Keyframes, place: PointMap, mixes: boolean, localMs: number) {
  const xs = laneFrames(clip.keyframes, "x");
  const ys = laneFrames(clip.keyframes, "y");
  if (xs.length === 0 && ys.length === 0) return;
  const times = [...new Set([...xs, ...ys].map((frame) => frame.atMs).concat(mixes ? [Math.round(localMs)] : []))].sort((a, b) => a - b);
  const sample = (atMs: number) => place({ x: xs.length > 0 ? valueAt(xs, atMs) : clip.transform.x, y: ys.length > 0 ? valueAt(ys, atMs) : clip.transform.y });
  const lane = (axis: "x" | "y", frames: readonly Keyframe[], other: readonly Keyframe[]): Keyframe[] | undefined => {
    if (frames.length === 0 && !mixes) return undefined;
    return (mixes ? times : frames.map((frame) => frame.atMs)).map((atMs) => {
      const existing = frames.find((frame) => frame.atMs === atMs);
      return existing ? { ...existing, value: sample(atMs)[axis] } : { atMs, value: sample(atMs)[axis], easing: easingBefore(frames.length > 0 ? frames : other, atMs) };
    });
  };
  const nextX = lane("x", xs, ys);
  const nextY = lane("y", ys, xs);
  if (nextX) keyframes.x = nextX;
  if (nextY) keyframes.y = nextY;
}

function shifted(reframed: Reframed, delta: PathPoint): Reframed {
  const move = (value: number, axis: "x" | "y") => value + delta[axis];
  const keyframes = reframed.keyframes ? { ...reframed.keyframes } : undefined;
  if (keyframes?.position) keyframes.position = keyframes.position.map((key) => ({ ...key, x: move(key.x, "x"), y: move(key.y, "y") }));
  for (const axis of ["x", "y"] as const) if (keyframes?.[axis]) keyframes[axis] = keyframes[axis].map((key) => ({ ...key, value: move(key.value, axis) }));
  return { transform: { ...reframed.transform, x: move(reframed.transform.x, "x"), y: move(reframed.transform.y, "y") }, keyframes };
}

function fittedReframe(reframed: Reframed, parented: boolean, strict: boolean): Reframed | ReframeRefusal {
  const keyRange = KEYFRAME_RANGES.x;
  const t = reframed.transform;
  const k = reframed.keyframes;
  const still = parented ? PARENTED_POSITION : STILL_POSITION;
  const handles = (k?.position ?? []).flatMap((key) => [key.in, key.out]).filter((handle): handle is Tangent => handle !== undefined);
  const fits =
    within(t.x, still) &&
    within(t.y, still) &&
    within(t.w, BOX_RANGE) &&
    within(t.h, BOX_RANGE) &&
    within(t.rotation, TURN_RANGE) &&
    (k?.position ?? []).every((key) => within(key.x, keyRange) && within(key.y, keyRange)) &&
    handles.every((handle) => within(handle.x, HANDLE_RANGE) && within(handle.y, HANDLE_RANGE)) &&
    (["x", "y", "rotation"] as const).every((lane) => (k?.[lane] ?? []).every((key) => within(key.value, KEYFRAME_RANGES[lane])));
  if (fits) return reframed;
  if (strict) return "outOfRange";
  const keyframes = k ? { ...k } : undefined;
  const fitHandle = (handle: Tangent | undefined) => handle && { x: clamped(handle.x, HANDLE_RANGE), y: clamped(handle.y, HANDLE_RANGE) };
  if (keyframes?.position) keyframes.position = keyframes.position.map((key) => ({ ...key, x: clamped(key.x, keyRange), y: clamped(key.y, keyRange), ...(key.in ? { in: fitHandle(key.in) } : {}), ...(key.out ? { out: fitHandle(key.out) } : {}) }));
  for (const lane of ["x", "y", "rotation"] as const) if (keyframes?.[lane]) keyframes[lane] = keyframes[lane].map((key) => ({ ...key, value: clamped(key.value, KEYFRAME_RANGES[lane]) }));
  return { transform: { ...t, x: clamped(t.x, still), y: clamped(t.y, still), w: clamped(t.w, BOX_RANGE), h: clamped(t.h, BOX_RANGE), rotation: clamped(t.rotation, TURN_RANGE) }, keyframes };
}

const BOX_RANGE = [0.001, 4] as const;

const TURN_RANGE = [-360, 360] as const;

const HANDLE_RANGE = [-2, 2] as const;

export function reframe(clip: Clip, localMs: number, target: ReframeTarget, aspect: number): Reframed | ReframeRefusal {
  const map = (point: PathPoint) => pointToLocal(target.to, pointToWorld(target.from, point, aspect), aspect);
  const shown = placementAt(clip, localMs, aspect);
  const origin = map(WORLD_FRAME);
  const unit = boxToLocal(target.to, boxToWorld(target.from, { x: 0.5, y: 0.5, w: 1, h: 1, rotation: shown.rotation, opacity: 1 }, aspect), aspect);
  const goal = boxToLocal(target.to, boxToWorld(target.from, shown, aspect), aspect);
  if (!origin || !unit || !goal) return "degenerate";
  const vector = (delta: PathPoint): PathPoint => {
    const moved = map({ x: WORLD_FRAME.x + delta.x, y: WORLD_FRAME.y + delta.y })!;
    return { x: moved.x - origin.x, y: moved.y - origin.y };
  };
  const across = vector({ x: 1, y: 0 });
  const down = vector({ x: 0, y: 1 });
  const mixes = Math.abs(across.y) > MIXING || Math.abs(down.x) > MIXING;
  const anchor = anchorOf(clip);
  const base = clip.transform;
  const w = base.w * unit.w;
  const h = base.h * unit.h;
  const before = anchorOffset(anchor, base.w, base.h);
  const after = anchorOffset(anchor, w, h);
  const place: PointMap = (position) => {
    const pivot = map({ x: position.x + before.x, y: position.y + before.y })!;
    return { x: pivot.x - after.x, y: pivot.y - after.y };
  };
  const keyframes: Keyframes | undefined = clip.keyframes ? { ...clip.keyframes } : undefined;
  const path = pathFramesOf(clip.keyframes);
  if (keyframes && path.length > 0) keyframes.position = path.map((key): PositionKeyframe => ({ ...key, ...place(key), ...(key.in ? { in: vector(key.in) } : {}), ...(key.out ? { out: vector(key.out) } : {}) }));
  if (keyframes) mappedLanes(clip, keyframes, place, mixes, localMs);
  const headingShift = clip.autoOrient ? headingOf({ keyframes, autoOrient: true }, localMs, aspect) - headingOf(clip, localMs, aspect) : 0;
  const turn = unit.rotation - shown.rotation - headingShift;
  if (keyframes?.rotation) keyframes.rotation = keyframes.rotation.map((key) => ({ ...key, value: key.value + turn }));
  const still = place(base);
  const mapped: Reframed = { transform: { ...base, x: still.x, y: still.y, w, h, rotation: turnedWithin(base.rotation + turn, TURN_RANGE) }, keyframes };
  const landed = placementAt({ ...clip, ...mapped }, localMs, aspect);
  return fittedReframe(shifted(mapped, { x: goal.x - landed.x, y: goal.y - landed.y }), target.parented, target.strict);
}

function survivingAncestor(lookup: ClipLookup, clip: Clip, removed: ReadonlySet<string>): Clip | null {
  for (const id of ancestorIds(lookup, clip)) if (!removed.has(id)) return lookup.get(id) ?? null;
  return null;
}

export function releaseChildren(doc: VideoDocument, removedIds: Iterable<string>): VideoDocument {
  const removed = new Set(removedIds);
  const lookup = clipLookup(doc);
  const orphans = [...lookup.values()].filter((clip) => !removed.has(clip.id) && clip.parentId !== undefined && removed.has(clip.parentId));
  if (orphans.length === 0) return doc;
  const aspect = canvasAspect(doc);
  const changes = new Map<string, Reframed & { parentId?: string }>();
  for (const clip of orphans) {
    const heir = survivingAncestor(lookup, clip, removed);
    const target: ReframeTarget = { from: parentFrameOf(lookup, clip, clip.startMs, aspect), to: heir ? frameAt(lookup, heir, clip.startMs, aspect) : WORLD_FRAME, parented: heir !== null, strict: false };
    const result = reframe(clip, 0, target, aspect);
    changes.set(clip.id, { ...(typeof result === "string" ? { transform: clip.transform, keyframes: clip.keyframes } : result), parentId: heir?.id });
  }
  return produce(doc, (draft) => {
    for (const track of draft.tracks) {
      for (const clip of track.clips) {
        const change = changes.get(clip.id);
        if (!change) continue;
        clip.transform = change.transform;
        if (change.keyframes) clip.keyframes = change.keyframes;
        if (change.parentId) clip.parentId = change.parentId;
        else delete clip.parentId;
        delete clip.parentTracker;
      }
    }
  });
}

export function remappedParents(clips: readonly Clip[], renamed: ReadonlyMap<string, string>): Clip[] {
  return clips.map((clip) => (clip.parentId && renamed.has(clip.parentId) ? { ...clip, parentId: renamed.get(clip.parentId) } : clip));
}
