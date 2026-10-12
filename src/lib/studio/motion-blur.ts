import { FRAMES_PER_SECOND, type CanvasSize, type Clip, type ClipType, type Transform, type VideoCanvas } from "./document";
import type { IssueCode } from "./validate";

export interface Shutter {
  angle: number;
  phase: number;
}

export interface ShutterSpan {
  startMs: number;
  endMs: number;
}

export interface MotionTrail {
  maps: readonly number[];
}

export interface TrailSpread {
  x: number;
  y: number;
}

export type Pose = (timelineMs: number) => Transform;

export type ShutterChange = Partial<Pick<VideoCanvas, "shutterAngle" | "shutterPhase">>;

export const SHUTTER_ANGLE_RANGE = [0, 720] as const;
export const SHUTTER_PHASE_RANGE = [-360, 360] as const;
export const DEFAULT_SHUTTER: Shutter = { angle: 180, phase: -90 };
export const SAMPLE_SPACING_PX = 1;
export const TRAIL_PROBES = 8;
export const TRAIL_MAP_SIZE = 6;

const FRAME_MS = 1000 / FRAMES_PER_SECOND;
const FULL_TURN = 360;
const DEGENERATE = 1e-9;
const BLURRED_TYPES: ReadonlySet<ClipType> = new Set(["video", "image", "overlay"]);
const CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const;
const NO_SPREAD: TrailSpread = { x: 1, y: 1 };

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function within(value: number, [low, high]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= low && value <= high;
}

export function takesMotionBlur(type: ClipType): boolean {
  return BLURRED_TYPES.has(type);
}

export function acceptsMotionBlur(type: ClipType): boolean {
  return takesMotionBlur(type) || type === "effect";
}

export function shutterOf(canvas: Pick<VideoCanvas, "shutterAngle" | "shutterPhase">): Shutter {
  return { angle: canvas.shutterAngle ?? DEFAULT_SHUTTER.angle, phase: canvas.shutterPhase ?? DEFAULT_SHUTTER.phase };
}

export function shutterIssue(canvas: Pick<VideoCanvas, "shutterAngle" | "shutterPhase">): IssueCode | null {
  if (canvas.shutterAngle !== undefined && !within(canvas.shutterAngle, SHUTTER_ANGLE_RANGE)) return "out_of_range";
  if (canvas.shutterPhase !== undefined && !within(canvas.shutterPhase, SHUTTER_PHASE_RANGE)) return "out_of_range";
  return null;
}

export function motionBlurIssue(clip: Pick<Clip, "type" | "motionBlur">): IssueCode | null {
  return clip.motionBlur && !takesMotionBlur(clip.type) ? "invalid" : null;
}

export function shutterSpan(shutter: Shutter, ms: number): ShutterSpan {
  const startMs = ms + (shutter.phase / FULL_TURN) * FRAME_MS;
  return { startMs, endMs: startMs + (shutter.angle / FULL_TURN) * FRAME_MS };
}

export function sampleTimes(span: ShutterSpan, count: number): number[] {
  return Array.from({ length: count }, (_, i) => span.startMs + ((i + 0.5) / count) * (span.endMs - span.startMs));
}

function cornersPx(t: Transform, canvas: CanvasSize): { x: number; y: number }[] {
  const turn = radians(t.rotation);
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const halfW = (t.w * canvas.width) / 2;
  const halfH = (t.h * canvas.height) / 2;
  return CORNERS.map(([sx, sy]) => ({ x: t.x * canvas.width + sx * halfW * cos - sy * halfH * sin, y: t.y * canvas.height + sx * halfW * sin + sy * halfH * cos }));
}

export function sweepPx(pose: Pose, span: ShutterSpan, canvas: CanvasSize): number {
  const probes = Array.from({ length: TRAIL_PROBES + 1 }, (_, k) => cornersPx(pose(span.startMs + ((span.endMs - span.startMs) * k) / TRAIL_PROBES), canvas));
  const travelled = CORNERS.map((_, corner) => probes.slice(1).reduce((sum, at, k) => sum + Math.hypot(at[corner].x - probes[k][corner].x, at[corner].y - probes[k][corner].y), 0));
  return Math.max(...travelled);
}

export function trailSampleCount(sweep: number, pixelScale: number): number {
  return Math.ceil((sweep * pixelScale) / SAMPLE_SPACING_PX);
}

export function boxMap(center: Transform, sample: Transform, canvas: CanvasSize): number[] | null {
  const centerW = center.w * canvas.width;
  const centerH = center.h * canvas.height;
  const sampleW = sample.w * canvas.width;
  const sampleH = sample.h * canvas.height;
  if (!(sampleW > DEGENERATE && sampleH > DEGENERATE)) return null;
  const turn = radians(center.rotation - sample.rotation);
  const a = (Math.cos(turn) * centerW) / sampleW;
  const b = (-Math.sin(turn) * centerH) / sampleW;
  const d = (Math.sin(turn) * centerW) / sampleH;
  const e = (Math.cos(turn) * centerH) / sampleH;
  const dx = (center.x - sample.x) * canvas.width;
  const dy = (center.y - sample.y) * canvas.height;
  const own = radians(sample.rotation);
  const along = dx * Math.cos(own) + dy * Math.sin(own);
  const across = -dx * Math.sin(own) + dy * Math.cos(own);
  return [a, b, 0.5 + along / sampleW - (a + b) / 2, d, e, 0.5 + across / sampleH - (d + e) / 2];
}

export function motionTrail(pose: Pose, ms: number, shutter: Shutter, canvas: CanvasSize, pixelScale: number, reference?: Transform): MotionTrail | null {
  if (!(shutter.angle > 0) || !(pixelScale > 0)) return null;
  const span = shutterSpan(shutter, ms);
  const count = trailSampleCount(sweepPx(pose, span, canvas), pixelScale);
  if (!(count >= 2)) return null;
  const center = reference ?? pose(ms);
  const maps: number[] = [];
  for (const at of sampleTimes(span, count)) {
    const map = boxMap(center, pose(at), canvas);
    if (!map) return null;
    maps.push(...map);
  }
  return { maps };
}

export function trailReach(trail: MotionTrail, width: number, height: number, spread: TrailSpread = NO_SPREAD): number {
  const us = [0.5 - spread.x / 2, 0.5 + spread.x / 2];
  const vs = [0.5 - spread.y / 2, 0.5 + spread.y / 2];
  let reach = 0;
  for (let i = 0; i + TRAIL_MAP_SIZE <= trail.maps.length; i += TRAIL_MAP_SIZE) {
    const [a, b, c, d, e, f] = trail.maps.slice(i, i + TRAIL_MAP_SIZE);
    const det = a * e - b * d;
    if (!(Math.abs(det) > DEGENERATE)) continue;
    for (const u of us) {
      for (const v of vs) {
        const shownU = (e * (u - c) - b * (v - f)) / det;
        const shownV = (-d * (u - c) + a * (v - f)) / det;
        reach = Math.max(reach, Math.hypot((shownU - u) * width, (shownV - v) * height));
      }
    }
  }
  return reach;
}
