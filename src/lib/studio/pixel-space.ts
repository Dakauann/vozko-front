import { cropFrame, rotate } from "./crop";
import type { CanvasSize, Layer } from "./document";
import { maskSurfaceSize, type SurfaceKind } from "./pixel-surface";
import type { Point } from "./viewport";

export interface PixelFrame {
  center: Point;
  width: number;
  height: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  surface: CanvasSize;
}

export interface MaskPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  flipX: boolean;
  flipY: boolean;
}

function tidy(value: number): number {
  return Math.abs(value) < 1e-9 ? 0 : Math.round(value * 1e9) / 1e9;
}

export function pixelFrame(layer: Layer, canvas: CanvasSize, kind: SurfaceKind): PixelFrame | null {
  const flips = { flipX: Boolean(layer.flipX), flipY: Boolean(layer.flipY) };
  if (kind === "paint") {
    if (layer.type !== "paint" || !layer.surface) return null;
    const t = layer.transform;
    return { center: { x: t.x * canvas.width, y: t.y * canvas.height }, width: t.w * canvas.width, height: t.h * canvas.height, rotation: t.rotation, ...flips, surface: { width: layer.surface.width, height: layer.surface.height } };
  }
  if (layer.type !== "image") return null;
  const frame = cropFrame(layer, canvas);
  const surface = layer.mask ? { width: layer.mask.width, height: layer.mask.height } : maskSurfaceSize(layer, canvas);
  return { center: frame.center, width: frame.width, height: frame.height, rotation: frame.rotation, ...flips, surface };
}

export function toFrame(frame: PixelFrame, point: Point): Point {
  const local = rotate({ x: point.x - frame.center.x, y: point.y - frame.center.y }, -frame.rotation);
  const x = local.x + frame.width / 2;
  const y = local.y + frame.height / 2;
  return { x: frame.flipX ? frame.width - x : x, y: frame.flipY ? frame.height - y : y };
}

export function toSurface(frame: PixelFrame, point: Point): Point {
  const local = toFrame(frame, point);
  return { x: tidy((local.x / frame.width) * frame.surface.width), y: tidy((local.y / frame.height) * frame.surface.height) };
}

export function fromSurface(frame: PixelFrame, point: Point): Point {
  const fx = (point.x / frame.surface.width) * frame.width;
  const fy = (point.y / frame.surface.height) * frame.height;
  const x = (frame.flipX ? frame.width - fx : fx) - frame.width / 2;
  const y = (frame.flipY ? frame.height - fy : fy) - frame.height / 2;
  const turned = rotate({ x, y }, frame.rotation);
  return { x: turned.x + frame.center.x, y: turned.y + frame.center.y };
}

export function surfaceScale(frame: PixelFrame): number {
  return (frame.surface.width / frame.width + frame.surface.height / frame.height) / 2;
}

export function maskPlacement(layer: Layer, boxWidth: number, boxHeight: number): MaskPlacement {
  const crop = layer.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const width = boxWidth / crop.w;
  const height = boxHeight / crop.h;
  const dx = layer.flipX ? 1 - crop.x - crop.w : crop.x;
  const dy = layer.flipY ? 1 - crop.y - crop.h : crop.y;
  return { x: tidy(-dx * width), y: tidy(-dy * height), width, height, flipX: Boolean(layer.flipX), flipY: Boolean(layer.flipY) };
}
