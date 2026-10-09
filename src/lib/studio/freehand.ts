import type { PathNode, Subpath } from "./path-nodes";
import type { Point } from "./viewport";

export interface FreehandOptions {
  tolerance: number;
  closeDistance: number;
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  if (length === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

export function simplifyPoints(points: readonly Point[], tolerance: number): Point[] {
  if (points.length <= 2) return [...points];
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const spans: [number, number][] = [[0, points.length - 1]];
  while (spans.length > 0) {
    const [start, end] = spans.pop()!;
    let farthest = -1;
    let reach = tolerance;
    for (let i = start + 1; i < end; i++) {
      const distance = distanceToSegment(points[i], points[start], points[end]);
      if (distance > reach) {
        reach = distance;
        farthest = i;
      }
    }
    if (farthest < 0) continue;
    keep[farthest] = true;
    spans.push([start, farthest], [farthest, end]);
  }
  return points.filter((_, i) => keep[i]);
}

function distinct(points: readonly Point[]): Point[] {
  return points.filter((p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y);
}

export function freehandSubpath(points: readonly Point[], options: FreehandOptions): Subpath | null {
  const stroke = distinct(points);
  if (stroke.length < 2) return null;
  const first = stroke[0];
  const last = stroke[stroke.length - 1];
  const closed = stroke.length > 3 && Math.hypot(last.x - first.x, last.y - first.y) <= options.closeDistance;
  const simplified = simplifyPoints(stroke, options.tolerance);
  const kept = closed && simplified.length > 2 ? simplified.slice(0, -1) : simplified;
  if (kept.length < 2) return null;
  const count = kept.length;
  const nodes: PathNode[] = kept.map((point, i) => {
    const previous = i > 0 ? kept[i - 1] : closed ? kept[count - 1] : null;
    const next = i < count - 1 ? kept[i + 1] : closed ? kept[0] : null;
    if (!previous || !next) return { x: point.x, y: point.y };
    const tx = (next.x - previous.x) / 6;
    const ty = (next.y - previous.y) / 6;
    return { x: point.x, y: point.y, in: { x: point.x - tx, y: point.y - ty }, out: { x: point.x + tx, y: point.y + ty } };
  });
  return { closed, nodes };
}
