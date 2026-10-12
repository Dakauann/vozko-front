import type { Bounds } from "./arrange";
import type { CanvasSize, ImageSurface } from "./document";
import { layerBounds } from "./layers";

export const SNAP_THRESHOLD_SCREEN_PX = 5;

export const SNAP_GUIDE_COLOR = "#e11d74";

export interface SnapTargets {
  x: number[];
  y: number[];
}

export interface SnapGuides {
  vertical: number[];
  horizontal: number[];
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuides;
}

const TOUCH_EPSILON = 0.5;

export function frameTargets(size: CanvasSize): SnapTargets {
  return { x: [0, size.width / 2, size.width], y: [0, size.height / 2, size.height] };
}

export function boundsTargets(bounds: readonly Bounds[]): SnapTargets {
  return {
    x: bounds.flatMap((b) => [b.left, (b.left + b.right) / 2, b.right]),
    y: bounds.flatMap((b) => [b.top, (b.top + b.bottom) / 2, b.bottom]),
  };
}

export function mergeTargets(...targets: readonly SnapTargets[]): SnapTargets {
  return { x: targets.flatMap((t) => t.x), y: targets.flatMap((t) => t.y) };
}

export function snapTargets(doc: ImageSurface, movingIds: readonly string[]): SnapTargets {
  const moving = new Set(movingIds);
  const others = doc.layers.filter((layer) => !moving.has(layer.id) && !layer.hidden).map((layer) => layerBounds(layer.transform, doc.canvas));
  return mergeTargets(frameTargets(doc.canvas), boundsTargets(others));
}

function nearest(lines: readonly number[], targets: readonly number[], threshold: number): number {
  let best = 0;
  let bestDistance = Infinity;
  for (const line of lines) {
    for (const target of targets) {
      const delta = target - line;
      if (Math.abs(delta) <= threshold && Math.abs(delta) < bestDistance) {
        best = delta;
        bestDistance = Math.abs(delta);
      }
    }
  }
  return best;
}

function touched(lines: readonly number[], targets: readonly number[]): number[] {
  const hits = targets.filter((target) => lines.some((line) => Math.abs(line - target) <= TOUCH_EPSILON));
  return [...new Set(hits)].sort((a, b) => a - b);
}

export function snapMove(moving: Bounds, targets: SnapTargets, threshold: number): SnapResult {
  const xs = [moving.left, (moving.left + moving.right) / 2, moving.right];
  const ys = [moving.top, (moving.top + moving.bottom) / 2, moving.bottom];
  const dx = nearest(xs, targets.x, threshold);
  const dy = nearest(ys, targets.y, threshold);
  return {
    dx,
    dy,
    guides: {
      vertical: touched(
        xs.map((v) => v + dx),
        targets.x,
      ),
      horizontal: touched(
        ys.map((v) => v + dy),
        targets.y,
      ),
    },
  };
}

export interface Gap {
  axis: "horizontal" | "vertical";
  from: number;
  to: number;
  at: number;
}

const MIN_GAP = 0.5;

function overlapMiddle(a0: number, a1: number, b0: number, b1: number): number {
  return (Math.max(a0, b0) + Math.min(a1, b1)) / 2;
}

function sideGap(moving: Bounds, others: readonly Bounds[], frame: Bounds, side: "left" | "right" | "top" | "bottom"): Gap | null {
  const horizontal = side === "left" || side === "right";
  const facing = others.filter((b) => (horizontal ? b.top < moving.bottom && b.bottom > moving.top : b.left < moving.right && b.right > moving.left));
  const across = (b: Bounds) => (horizontal ? overlapMiddle(moving.top, moving.bottom, b.top, b.bottom) : overlapMiddle(moving.left, moving.right, b.left, b.right));
  const center = horizontal ? (moving.top + moving.bottom) / 2 : (moving.left + moving.right) / 2;
  const axis = horizontal ? "horizontal" : "vertical";
  const gap = (from: number, to: number, at: number): Gap | null => (to - from >= MIN_GAP ? { axis, from, to, at } : null);
  switch (side) {
    case "left": {
      const near = facing.filter((b) => b.right <= moving.left).sort((a, b) => b.right - a.right)[0];
      if (near) return gap(near.right, moving.left, across(near));
      return moving.left >= frame.left ? gap(frame.left, moving.left, center) : null;
    }
    case "right": {
      const near = facing.filter((b) => b.left >= moving.right).sort((a, b) => a.left - b.left)[0];
      if (near) return gap(moving.right, near.left, across(near));
      return moving.right <= frame.right ? gap(moving.right, frame.right, center) : null;
    }
    case "top": {
      const near = facing.filter((b) => b.bottom <= moving.top).sort((a, b) => b.bottom - a.bottom)[0];
      if (near) return gap(near.bottom, moving.top, across(near));
      return moving.top >= frame.top ? gap(frame.top, moving.top, center) : null;
    }
    case "bottom": {
      const near = facing.filter((b) => b.top >= moving.bottom).sort((a, b) => a.top - b.top)[0];
      if (near) return gap(moving.bottom, near.top, across(near));
      return moving.bottom <= frame.bottom ? gap(moving.bottom, frame.bottom, center) : null;
    }
  }
}

export function measureGaps(moving: Bounds, others: readonly Bounds[], frame: Bounds): Gap[] {
  return (["left", "right", "top", "bottom"] as const).map((side) => sideGap(moving, others, frame, side)).filter((gap): gap is Gap => gap !== null);
}
