import type { Clip } from "./document";
import { axisScaled, framesOf, keyAt, onPath, setPathKey } from "./keyframe-edit";
import { pathFramesOf, PATH_PROPERTY, replaceLanes, withLane, withoutProperty, type Keyframe, type Keyframes } from "./keyframes";
import { carriesHandles, PATH_HANDLE_LIMIT, spatialOf, type PositionKeyframe, type SpatialMode, type Tangent } from "./path-keys";
import { joinedPath, resolvedHandles, separatedLanes, type PathPoint } from "./position-path";
import type { ClipPatch } from "./timeline";

type MotionClip = Pick<Clip, "transform" | "keyframes">;

export type MotionEdit = { ok: true; patch: ClipPatch } | { ok: false; reason: "nothing" | "missing" };

const NOTHING: MotionEdit = { ok: false, reason: "nothing" };

function edited(keyframes: Keyframes | undefined): MotionEdit {
  return { ok: true, patch: { keyframes } };
}

export type ScaleAxis = "x" | "y";

export function splitScale(clip: MotionClip, localMs: number): MotionEdit {
  if (axisScaled(clip)) return NOTHING;
  const uniform = framesOf(clip, "scale");
  const frames: Keyframe[] = uniform.length > 0 ? [...uniform] : [{ atMs: Math.round(localMs), value: 1, easing: "linear" }];
  return edited(replaceLanes(withoutProperty(clip.keyframes, "scale"), { scaleX: frames, scaleY: frames }));
}

export function scaleAxesMatch(clip: MotionClip): boolean {
  return JSON.stringify(framesOf(clip, "scaleX")) === JSON.stringify(framesOf(clip, "scaleY"));
}

export function linkScale(clip: MotionClip, keep: ScaleAxis): MotionEdit {
  if (!axisScaled(clip)) return NOTHING;
  const x = framesOf(clip, "scaleX");
  const y = framesOf(clip, "scaleY");
  const kept = keep === "y" ? (y.length > 0 ? y : x) : x.length > 0 ? x : y;
  return edited(withLane(clip.keyframes, "scale", kept));
}

export type JoinSpatial = Extract<SpatialMode, "auto" | "linear">;

export function curvePath(clip: MotionClip, spatial: JoinSpatial): MotionEdit {
  if (onPath(clip)) return NOTHING;
  const x = framesOf(clip, "x");
  const y = framesOf(clip, "y");
  if (x.length === 0 && y.length === 0) return NOTHING;
  const keys = joinedPath(x, y, { x: clip.transform.x, y: clip.transform.y }, spatial);
  return edited(withLane(clip.keyframes, PATH_PROPERTY, keys));
}

export function straightenPath(clip: MotionClip, aspect: number): MotionEdit {
  if (!onPath(clip)) return NOTHING;
  const lanes = separatedLanes(pathFramesOf(clip.keyframes), aspect);
  return edited(replaceLanes(withoutProperty(clip.keyframes, PATH_PROPERTY), { x: lanes.x, y: lanes.y }));
}

function replacedKey(clip: MotionClip, key: PositionKeyframe): Keyframes | undefined {
  const frames = pathFramesOf(clip.keyframes).map((frame) => (frame.atMs === key.atMs ? key : frame));
  return withLane(clip.keyframes, PATH_PROPERTY, frames);
}

function plain(key: PositionKeyframe): PositionKeyframe {
  return { atMs: key.atMs, x: key.x, y: key.y, easing: key.easing };
}

function boundedHandle(handle: Tangent): Tangent {
  const bound = (value: number) => Math.min(PATH_HANDLE_LIMIT, Math.max(-PATH_HANDLE_LIMIT, value));
  return { x: bound(handle.x), y: bound(handle.y) };
}

function lacksHandles(key: PositionKeyframe): boolean {
  return carriesHandles(spatialOf(key)) && (!key.in || !key.out);
}

export function fillHandles(frames: readonly PositionKeyframe[], aspect: number): PositionKeyframe[] {
  if (!frames.some(lacksHandles)) return [...frames];
  const auto = resolvedHandles(frames.map((frame) => (lacksHandles(frame) ? plain(frame) : frame)), aspect);
  return frames.map((frame, i) => (lacksHandles(frame) ? { ...frame, in: frame.in ?? boundedHandle(auto[i].in), out: frame.out ?? boundedHandle(auto[i].out) } : frame));
}

export function setSpatialAt(clip: MotionClip, localMs: number, spatial: SpatialMode, aspect: number): MotionEdit {
  const frames = pathFramesOf(clip.keyframes);
  const key = keyAt(frames, localMs);
  if (!key) return { ok: false, reason: "missing" };
  const kept = carriesHandles(spatial) && key.in && key.out ? { ...key, spatial } : { ...plain(key), ...(spatial === "auto" ? {} : { spatial }) };
  return edited(withLane(clip.keyframes, PATH_PROPERTY, fillHandles(frames.map((frame) => (frame.atMs === key.atMs ? kept : frame)), aspect)));
}

export type HandleSide = "in" | "out";

function mirrored(handle: Tangent, length: number, aspect: number): Tangent {
  const x = handle.x * aspect;
  const size = Math.hypot(x, handle.y);
  if (size < 1e-12) return { x: 0, y: 0 };
  return { x: (-x / size) * length / aspect, y: (-handle.y / size) * length };
}

export function setHandleAt(clip: MotionClip, localMs: number, side: HandleSide, tip: PathPoint, broken: boolean, aspect: number): MotionEdit {
  const frames = pathFramesOf(clip.keyframes);
  const key = keyAt(frames, localMs);
  if (!key) return { ok: false, reason: "missing" };
  const current = resolvedHandles(frames, aspect)[frames.indexOf(key)];
  const moved = boundedHandle({ x: tip.x - key.x, y: tip.y - key.y });
  const spatial: SpatialMode = broken || key.spatial === "free" ? "free" : "smooth";
  const other: HandleSide = side === "in" ? "out" : "in";
  const otherHandle = spatial === "free" ? current[other] : boundedHandle(mirrored(moved, Math.hypot(current[other].x * aspect, current[other].y), aspect));
  return edited(replacedKey(clip, { ...key, spatial, [side]: moved, [other]: otherHandle }));
}

export function movePathKey(clip: MotionClip, localMs: number, point: PathPoint): MotionEdit {
  const key = keyAt(pathFramesOf(clip.keyframes), localMs);
  if (!key) return { ok: false, reason: "missing" };
  return edited(setPathKey(clip, key.atMs, point));
}
