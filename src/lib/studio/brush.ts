import { simplifyWith } from "./freehand";
import { PIXEL_INPUT_MARGIN, snapPixel } from "./pixel-surface";

export const BRUSH_SPACING = 0.1;
export const MIN_DAB_STEP = 0.5;
const COMMIT_TOLERANCE = 0.3;
const SMOOTH_STEPS = 6;

const PRESSURE_WEIGHT = 100;
const PRESSURE_DIGITS = 100;

export interface Dab {
  x: number;
  y: number;
  radius: number;
}

export interface DabCursor {
  index: number;
  remaining: number;
}

export type Stride = 2 | 3;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function tipAlpha(distance: number, radius: number, hardness: number): number {
  const rim = Math.min(1, Math.max(0, radius + 0.5 - distance));
  if (hardness >= 1 || rim === 0) return rim;
  const r = distance / radius;
  const soft = r <= hardness ? 1 : 1 - smoothstep(hardness, 1, r);
  return Math.min(soft, rim);
}

export function dabDiameter(size: number, pressure: number): number {
  return Math.max(1, size * pressure);
}

function stepAt(size: number, pressure: number): number {
  return Math.max(MIN_DAB_STEP, BRUSH_SPACING * dabDiameter(size, pressure));
}

function pressureAt(points: readonly number[], stride: Stride, index: number): number {
  return stride === 3 ? points[index * 3 + 2] : 1;
}

function dabAt(x: number, y: number, size: number, pressure: number): Dab {
  return { x, y, radius: dabDiameter(size, pressure) / 2 };
}

export function walkDabs(points: readonly number[], stride: Stride, size: number, cursor: DabCursor | null, emit: (dab: Dab) => void): DabCursor {
  const count = Math.floor(points.length / stride);
  if (count === 0) return cursor ?? { index: 0, remaining: 0 };
  let index = cursor?.index ?? 0;
  let remaining = cursor?.remaining ?? 0;
  if (!cursor) {
    const pressure = pressureAt(points, stride, 0);
    emit(dabAt(points[0], points[1], size, pressure));
    remaining = stepAt(size, pressure);
  }
  for (; index + 1 < count; index++) {
    const ax = points[index * stride];
    const ay = points[index * stride + 1];
    const bx = points[(index + 1) * stride];
    const by = points[(index + 1) * stride + 1];
    const ap = pressureAt(points, stride, index);
    const bp = pressureAt(points, stride, index + 1);
    const length = Math.hypot(bx - ax, by - ay);
    let travelled = 0;
    while (length - travelled >= remaining) {
      travelled += remaining;
      const t = length > 0 ? travelled / length : 1;
      const pressure = ap + (bp - ap) * t;
      emit(dabAt(ax + (bx - ax) * t, ay + (by - ay) * t, size, pressure));
      remaining = stepAt(size, pressure);
    }
    remaining -= length - travelled;
  }
  return { index: Math.max(0, count - 1), remaining };
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3);
}

export function smoothSegment(raw: readonly number[], stride: Stride, index: number, steps: number = SMOOTH_STEPS): number[] {
  const count = Math.floor(raw.length / stride);
  if (index < 0 || index + 1 >= count) return [];
  const at = (k: number) => raw.slice(Math.min(count - 1, Math.max(0, k)) * stride, (Math.min(count - 1, Math.max(0, k)) + 1) * stride);
  const [p0, p1, p2, p3] = [at(index - 1), at(index), at(index + 1), at(index + 2)];
  const out: number[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    out.push(s === 0 ? p1[0] : s === steps ? p2[0] : catmullRom(p0[0], p1[0], p2[0], p3[0], t));
    out.push(s === 0 ? p1[1] : s === steps ? p2[1] : catmullRom(p0[1], p1[1], p2[1], p3[1], t));
    if (stride === 3) out.push(s === 0 ? p1[2] : s === steps ? p2[2] : Math.min(1, Math.max(0, catmullRom(p0[2], p1[2], p2[2], p3[2], t))));
  }
  return out;
}

function clampInto(value: number, side: number): number {
  return Math.min(side + PIXEL_INPUT_MARGIN, Math.max(-PIXEL_INPUT_MARGIN, value));
}

function tidy(value: number): number {
  return value || 0;
}

export function committedPoints(raw: readonly number[], stride: Stride, surface: { width: number; height: number }): number[] {
  const count = Math.floor(raw.length / stride);
  const points = Array.from({ length: count }, (_, i) => ({
    x: clampInto(raw[i * stride], surface.width),
    y: clampInto(raw[i * stride + 1], surface.height),
    p: stride === 3 ? Math.min(1, Math.max(0, raw[i * stride + 2])) : 1,
  }));
  const kept = simplifyWith(points, COMMIT_TOLERANCE, stride === 3 ? distanceWithPressure : distanceFlat);
  return kept.flatMap((point) => {
    const xy = [tidy(snapPixel(point.x)), tidy(snapPixel(point.y))];
    return stride === 3 ? [...xy, tidy(Math.round(point.p * PRESSURE_DIGITS) / PRESSURE_DIGITS)] : xy;
  });
}

interface PressurePoint {
  x: number;
  y: number;
  p: number;
}

function distanceFlat(point: PressurePoint, a: PressurePoint, b: PressurePoint): number {
  return distanceWithPressure({ ...point, p: 0 }, { ...a, p: 0 }, { ...b, p: 0 });
}

function distanceWithPressure(point: PressurePoint, a: PressurePoint, b: PressurePoint): number {
  const lift = (q: PressurePoint) => [q.x, q.y, q.p * PRESSURE_WEIGHT];
  const [c, from, to] = [lift(point), lift(a), lift(b)];
  const along = to.map((value, k) => value - from[k]);
  const length = along.reduce((sum, value) => sum + value * value, 0);
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, c.reduce((sum, value, k) => sum + (value - from[k]) * along[k], 0) / length));
  return Math.hypot(...c.map((value, k) => value - (from[k] + t * along[k])));
}
