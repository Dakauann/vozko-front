import type { CanvasSize, Clip, Transform } from "./document";
import { framesOf, isAnimated, propertyValue, setPropertyKey } from "./keyframe-edit";
import type { ClipPatch } from "./timeline";

export interface PathPoint {
  x: number;
  y: number;
}

export interface PathKey extends PathPoint {
  atMs: number;
}

export interface MotionPath {
  keys: PathKey[];
  points: PathPoint[];
}

export const PATH_SAMPLES = 96;

const AXES = ["x", "y"] as const;

type PathClip = Pick<Clip, "transform" | "keyframes" | "durationMs">;

function positionAt(clip: PathClip, atMs: number): PathPoint {
  return { x: propertyValue(clip, "x", atMs), y: propertyValue(clip, "y", atMs) };
}

export function motionPath(clip: PathClip, samples: number = PATH_SAMPLES): MotionPath | null {
  const times = [...new Set(AXES.flatMap((axis) => framesOf(clip, axis).map((frame) => frame.atMs)))].sort((a, b) => a - b);
  if (times.length === 0) return null;
  const keys = times.map((atMs) => ({ atMs, ...positionAt(clip, atMs) }));
  const first = times[0];
  const span = times[times.length - 1] - first;
  const count = Math.max(2, samples);
  const points = Array.from({ length: count }, (_, i) => positionAt(clip, first + (span * i) / (count - 1)));
  return { keys, points };
}

export function movePathKeyPatch(clip: PathClip, atMs: number, x: number, y: number): ClipPatch {
  const target = { x, y };
  let keyframes = clip.keyframes;
  for (const axis of AXES) {
    if (isAnimated(clip, axis)) keyframes = setPropertyKey({ ...clip, keyframes }, axis, atMs, target[axis]);
  }
  return { keyframes };
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
