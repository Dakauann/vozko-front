import type { CanvasSize, Transform } from "./document";

export type Alignment = "left" | "center" | "right" | "top" | "middle" | "bottom";

export type DistributeAxis = "horizontal" | "vertical";

export const ALIGNMENTS: readonly Alignment[] = ["left", "center", "right", "top", "middle", "bottom"];

export const DISTRIBUTE_AXES: readonly DistributeAxis[] = ["horizontal", "vertical"];

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type Shift = [number, number];

const STILL = 1e-9;

export function boxBounds(transform: Transform, canvas: CanvasSize): Bounds {
  const w = transform.w * canvas.width;
  const h = transform.h * canvas.height;
  const radians = (transform.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const halfW = (w * cos + h * sin) / 2;
  const halfH = (w * sin + h * cos) / 2;
  const cx = transform.x * canvas.width;
  const cy = transform.y * canvas.height;
  return { left: cx - halfW, top: cy - halfH, right: cx + halfW, bottom: cy + halfH };
}

export function boxCorners(transform: Transform, canvas: CanvasSize): [number, number][] {
  const halfW = (transform.w * canvas.width) / 2;
  const halfH = (transform.h * canvas.height) / 2;
  const radians = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const cx = transform.x * canvas.width;
  const cy = transform.y * canvas.height;
  return [
    [-halfW, -halfH],
    [halfW, -halfH],
    [halfW, halfH],
    [-halfW, halfH],
  ].map(([dx, dy]) => [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]);
}

export function unionBounds(bounds: readonly Bounds[]): Bounds {
  return {
    left: Math.min(...bounds.map((b) => b.left)),
    top: Math.min(...bounds.map((b) => b.top)),
    right: Math.max(...bounds.map((b) => b.right)),
    bottom: Math.max(...bounds.map((b) => b.bottom)),
  };
}

export function alignTarget(items: readonly Bounds[], container: Bounds): Bounds {
  return items.length === 1 ? container : unionBounds(items);
}

export function alignShift(item: Bounds, frame: Bounds, alignment: Alignment): Shift {
  switch (alignment) {
    case "left":
      return [frame.left - item.left, 0];
    case "right":
      return [frame.right - item.right, 0];
    case "center":
      return [(frame.left + frame.right - item.left - item.right) / 2, 0];
    case "top":
      return [0, frame.top - item.top];
    case "bottom":
      return [0, frame.bottom - item.bottom];
    case "middle":
      return [0, (frame.top + frame.bottom - item.top - item.bottom) / 2];
  }
}

export function distributeShifts(items: readonly Bounds[], axis: DistributeAxis): Shift[] {
  const shifts: Shift[] = items.map(() => [0, 0]);
  if (items.length < 3) return shifts;
  const start = (b: Bounds) => (axis === "horizontal" ? b.left : b.top);
  const size = (b: Bounds) => (axis === "horizontal" ? b.right - b.left : b.bottom - b.top);
  const order = items.map((bounds, index) => ({ bounds, index })).sort((a, b) => start(a.bounds) + size(a.bounds) / 2 - (start(b.bounds) + size(b.bounds) / 2));
  const first = order[0].bounds;
  const last = order[order.length - 1].bounds;
  const span = start(last) + size(last) - start(first);
  const gap = (span - items.reduce((sum, b) => sum + size(b), 0)) / (items.length - 1);
  let cursor = start(first);
  for (const { bounds, index } of order) {
    const delta = cursor - start(bounds);
    cursor += size(bounds) + gap;
    if (Math.abs(delta) < STILL) continue;
    shifts[index] = axis === "horizontal" ? [delta, 0] : [0, delta];
  }
  return shifts;
}

export function isStill(shift: Shift): boolean {
  return Math.abs(shift[0]) < STILL && Math.abs(shift[1]) < STILL;
}
