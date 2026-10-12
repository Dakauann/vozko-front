import { boxPointAt, framePointOf } from "./clip-placement";
import type { CanvasSize, Transform } from "./document";
import type { Mask } from "./masks";
import type { PathPoint } from "./position-path";

export interface PathFrame {
  placed: Transform;
  aspect: number;
  inner: Transform;
  innerAspect: number;
}

function sideRatio(placed: Transform, canvas: CanvasSize): number {
  const height = placed.h * canvas.height;
  return height > 0 ? (placed.w * canvas.width) / height : 1;
}

export function pathFrameOf(placed: Transform, canvas: CanvasSize, inner: Transform): PathFrame {
  return { placed, aspect: canvas.height > 0 ? canvas.width / canvas.height : 1, inner, innerAspect: sideRatio(placed, canvas) };
}

export function maskBox(mask: Pick<Mask, "x" | "y" | "w" | "h" | "rotation">): Transform {
  return { x: mask.x, y: mask.y, w: mask.w, h: mask.h, rotation: mask.rotation, opacity: 1 };
}

export function unitToFrame(frame: PathFrame, unit: PathPoint): PathPoint {
  return framePointOf(frame.placed, framePointOf(frame.inner, unit, frame.innerAspect), frame.aspect);
}

export function frameToUnit(frame: PathFrame, point: PathPoint): PathPoint {
  return boxPointAt(frame.inner, boxPointAt(frame.placed, point, frame.aspect), frame.innerAspect);
}
