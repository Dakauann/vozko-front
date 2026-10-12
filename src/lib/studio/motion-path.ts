import { anchorOf, anchorOffset } from "./clip-placement";
import { FRAMES_PER_SECOND, type CanvasSize, type Clip, type Transform } from "./document";
import { framesOf, isAnimated, onPath, propertyValue, setPathKey, setPropertyKey } from "./keyframe-edit";
import { pathFramesOf } from "./keyframes";
import { pointToWorld, type ParentFrame } from "./parenting";
import { spatialOf, type SpatialMode } from "./path-keys";
import { pathPolyline, positionAt, resolvedHandles, type PathPoint } from "./position-path";
import type { ClipPatch } from "./timeline";

export type { PathPoint } from "./position-path";

export interface PathKey extends PathPoint {
  atMs: number;
  spatial?: SpatialMode;
  in?: PathPoint;
  out?: PathPoint;
}

export interface MotionPath {
  keys: PathKey[];
  points: PathPoint[];
  dots: PathPoint[];
  curved: boolean;
}

export const PATH_SAMPLES = 96;

const AXES = ["x", "y"] as const;
const FRAME_MS = 1000 / FRAMES_PER_SECOND;

type PathClip = Pick<Clip, "transform" | "keyframes" | "durationMs"> & Partial<Pick<Clip, "anchor">>;

function lanePoint(clip: PathClip, atMs: number): PathPoint {
  return { x: propertyValue(clip, "x", atMs), y: propertyValue(clip, "y", atMs) };
}

function pivotShift(clip: PathClip): PathPoint {
  return anchorOffset(anchorOf(clip), clip.transform.w, clip.transform.h);
}

function shifted(point: PathPoint, shift: PathPoint): PathPoint {
  return { x: point.x + shift.x, y: point.y + shift.y };
}

function frameTimes(first: number, last: number): number[] {
  const count = Math.max(1, Math.floor((last - first) / FRAME_MS));
  return Array.from({ length: count + 1 }, (_, i) => Math.min(last, first + i * FRAME_MS));
}

function curvedPath(clip: PathClip, aspect: number): MotionPath {
  const frames = pathFramesOf(clip.keyframes);
  const shift = pivotShift(clip);
  const handles = resolvedHandles(frames, aspect);
  const keys = frames.map((frame, i): PathKey => ({
    atMs: frame.atMs,
    ...shifted(frame, shift),
    spatial: spatialOf(frame),
    in: shifted({ x: frame.x + handles[i].in.x, y: frame.y + handles[i].in.y }, shift),
    out: shifted({ x: frame.x + handles[i].out.x, y: frame.y + handles[i].out.y }, shift),
  }));
  const dots = frameTimes(frames[0].atMs, frames[frames.length - 1].atMs).map((atMs) => shifted(positionAt(frames, atMs, aspect), shift));
  return { keys, points: pathPolyline(frames, aspect).map((point) => shifted(point, shift)), dots, curved: true };
}

export function motionPath(clip: PathClip, aspect: number, samples: number = PATH_SAMPLES): MotionPath | null {
  if (onPath(clip)) return curvedPath(clip, aspect);
  const times = [...new Set(AXES.flatMap((axis) => framesOf(clip, axis).map((frame) => frame.atMs)))].sort((a, b) => a - b);
  if (times.length === 0) return null;
  const shift = pivotShift(clip);
  const keys = times.map((atMs) => ({ atMs, ...shifted(lanePoint(clip, atMs), shift) }));
  const first = times[0];
  const span = times[times.length - 1] - first;
  const count = Math.max(2, samples);
  const points = Array.from({ length: count }, (_, i) => shifted(lanePoint(clip, first + (span * i) / (count - 1)), shift));
  const dots = frameTimes(first, times[times.length - 1]).map((atMs) => shifted(lanePoint(clip, atMs), shift));
  return { keys, points, dots, curved: false };
}

export function framedPath(path: MotionPath, frame: ParentFrame, aspect: number): MotionPath {
  const out = (point: PathPoint) => pointToWorld(frame, point, aspect);
  return {
    ...path,
    keys: path.keys.map((key) => ({ ...key, ...out(key), ...(key.in ? { in: out(key.in) } : {}), ...(key.out ? { out: out(key.out) } : {}) })),
    points: path.points.map(out),
    dots: path.dots.map(out),
  };
}

export function movePathKeyPatch(clip: PathClip, atMs: number, x: number, y: number): ClipPatch {
  const shift = pivotShift(clip);
  const target = { x: x - shift.x, y: y - shift.y };
  if (onPath(clip)) return { keyframes: setPathKey(clip, atMs, target) };
  let keyframes = clip.keyframes;
  for (const axis of AXES) {
    if (isAnimated(clip, axis)) keyframes = setPropertyKey({ ...clip, keyframes }, axis, atMs, target[axis]);
  }
  return { keyframes };
}

export function pathHandlePoint(clip: PathClip, tip: PathPoint): PathPoint {
  const shift = pivotShift(clip);
  return { x: tip.x - shift.x, y: tip.y - shift.y };
}

export interface FloatingPosition {
  left: number;
  top: number;
  inside: boolean;
}

export function keyButtonPosition(transform: Transform, frame: CanvasSize, size: number, gap: number): FloatingPosition {
  const radians = (transform.rotation * Math.PI) / 180;
  const halfW = (transform.w * frame.width) / 2;
  const halfH = (transform.h * frame.height) / 2;
  const extentX = Math.abs(halfW * Math.cos(radians)) + Math.abs(halfH * Math.sin(radians));
  const extentY = Math.abs(halfW * Math.sin(radians)) + Math.abs(halfH * Math.cos(radians));
  const right = transform.x * frame.width + extentX;
  const top = transform.y * frame.height - extentY;
  const outside = { left: right + gap, top: top - gap - size };
  if (outside.left + size <= frame.width && outside.top >= 0) return { ...outside, inside: false };
  const clamp = (value: number, high: number) => Math.min(Math.max(value, 0), Math.max(0, high));
  return { left: clamp(Math.min(right, frame.width) - gap - size, frame.width - size), top: clamp(Math.max(top, 0) + gap, frame.height - size), inside: true };
}
