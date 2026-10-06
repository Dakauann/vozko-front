import type { Transform } from "./document";

export const MIN_BOX = 0.02;
export const MAX_BOX = 4;

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const HANDLES: readonly Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

export function clampClipTransform(t: Transform): Transform {
  return {
    x: clamp(t.x, 0, 1),
    y: clamp(t.y, 0, 1),
    w: clamp(t.w, 0.001, MAX_BOX),
    h: clamp(t.h, 0.001, MAX_BOX),
    rotation: clamp(t.rotation, -360, 360),
    opacity: clamp(t.opacity, 0, 1),
  };
}

export function moveBox(t: Transform, dx: number, dy: number): Transform {
  return clampClipTransform({ ...t, x: t.x + dx, y: t.y + dy });
}

function handleSigns(handle: Handle): { sx: -1 | 0 | 1; sy: -1 | 0 | 1 } {
  return {
    sx: handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0,
    sy: handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0,
  };
}

export interface ResizeOptions {
  aspect: number;
  keepRatio: boolean;
}

export function resizeBox(t: Transform, handle: Handle, dx: number, dy: number, options: ResizeOptions): Transform {
  const radians = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const localX = dx * cos + (dy * sin) / options.aspect;
  const localY = -dx * sin * options.aspect + dy * cos;
  const { sx, sy } = handleSigns(handle);
  let w = Math.max(MIN_BOX, t.w + sx * localX);
  let h = Math.max(MIN_BOX, t.h + sy * localY);
  if (options.keepRatio && sx !== 0 && sy !== 0) {
    const scale = Math.max(w / t.w, h / t.h);
    w = Math.max(MIN_BOX, t.w * scale);
    h = Math.max(MIN_BOX, t.h * scale);
  }
  w = Math.min(w, MAX_BOX);
  h = Math.min(h, MAX_BOX);
  const shiftLocalX = (sx * (w - t.w)) / 2;
  const shiftLocalY = (sy * (h - t.h)) / 2;
  const shiftX = shiftLocalX * cos - (shiftLocalY * sin) / options.aspect;
  const shiftY = shiftLocalX * sin * options.aspect + shiftLocalY * cos;
  return clampClipTransform({ ...t, w, h, x: t.x + shiftX, y: t.y + shiftY });
}

export function rotateBox(t: Transform, centerPx: { x: number; y: number }, pointerPx: { x: number; y: number }, snapDegrees: number = 0): Transform {
  const angle = (Math.atan2(pointerPx.y - centerPx.y, pointerPx.x - centerPx.x) * 180) / Math.PI + 90;
  const normalized = ((angle + 540) % 360) - 180;
  const snapped = snapDegrees > 0 ? Math.round(normalized / snapDegrees) * snapDegrees : normalized;
  return clampClipTransform({ ...t, rotation: Math.round(snapped * 10) / 10 });
}

export function pointInBox(t: Transform, x: number, y: number, aspect: number): boolean {
  const radians = (-t.rotation * Math.PI) / 180;
  const dx = (x - t.x) * aspect;
  const dy = y - t.y;
  const localX = (dx * Math.cos(radians) - dy * Math.sin(radians)) / aspect;
  const localY = dx * Math.sin(radians) + dy * Math.cos(radians);
  return Math.abs(localX) <= t.w / 2 && Math.abs(localY) <= t.h / 2;
}

export function topmostAt<T extends { transform: Transform; zIndex: number }>(items: readonly T[], x: number, y: number, aspect: number): T | null {
  let best: T | null = null;
  for (const item of items) {
    if (pointInBox(item.transform, x, y, aspect) && (best === null || item.zIndex >= best.zIndex)) best = item;
  }
  return best;
}
