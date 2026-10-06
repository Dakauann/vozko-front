import type { ImageDocument } from "./document";
import { layerBounds, type Bounds } from "./layers";

export const SNAP_THRESHOLD_SCREEN_PX = 5;

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

export function snapTargets(doc: ImageDocument, movingIds: readonly string[]): SnapTargets {
  const moving = new Set(movingIds);
  const { width, height } = doc.canvas;
  const x = [0, width / 2, width];
  const y = [0, height / 2, height];
  for (const layer of doc.layers) {
    if (moving.has(layer.id) || layer.hidden) continue;
    const b = layerBounds(layer.transform, doc.canvas);
    x.push(b.left, (b.left + b.right) / 2, b.right);
    y.push(b.top, (b.top + b.bottom) / 2, b.bottom);
  }
  return { x, y };
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
