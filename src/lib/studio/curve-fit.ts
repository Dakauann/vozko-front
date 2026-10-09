import type { Point } from "./viewport";

export type Cubic = [Point, Point, Point, Point];

const REPARAMETERIZE_STEPS = 4;
const TINY = 1e-12;

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scale(a: Point, k: number): Point {
  return { x: a.x * k, y: a.y * k };
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

function length(a: Point): number {
  return Math.hypot(a.x, a.y);
}

function unit(a: Point): Point {
  const size = length(a);
  return size < TINY ? { x: 0, y: 0 } : scale(a, 1 / size);
}

function bezierAt(cubic: readonly Point[], t: number): Point {
  const u = 1 - t;
  return add(add(scale(cubic[0], u * u * u), scale(cubic[1], 3 * u * u * t)), add(scale(cubic[2], 3 * u * t * t), scale(cubic[3], t * t * t)));
}

function derivative(cubic: readonly Point[]): Point[] {
  return [scale(sub(cubic[1], cubic[0]), 3), scale(sub(cubic[2], cubic[1]), 3), scale(sub(cubic[3], cubic[2]), 3)];
}

function quadraticAt(q: readonly Point[], t: number): Point {
  const u = 1 - t;
  return add(add(scale(q[0], u * u), scale(q[1], 2 * u * t)), scale(q[2], t * t));
}

function chordParameters(points: readonly Point[]): number[] {
  const u = [0];
  for (let i = 1; i < points.length; i++) u.push(u[i - 1] + length(sub(points[i], points[i - 1])));
  const total = u[u.length - 1];
  return total < TINY ? u.map((_, i) => i / (u.length - 1)) : u.map((value) => value / total);
}

function straightCubic(first: Point, last: Point, start: Point, end: Point): Cubic {
  const third = length(sub(last, first)) / 3;
  return [first, add(first, scale(start, third)), add(last, scale(end, third)), last];
}

function generate(points: readonly Point[], u: readonly number[], start: Point, end: Point): Cubic {
  const first = points[0];
  const last = points[points.length - 1];
  let c00 = 0;
  let c01 = 0;
  let c11 = 0;
  let x0 = 0;
  let x1 = 0;
  u.forEach((t, i) => {
    const s = 1 - t;
    const a0 = scale(start, 3 * s * s * t);
    const a1 = scale(end, 3 * s * t * t);
    c00 += dot(a0, a0);
    c01 += dot(a0, a1);
    c11 += dot(a1, a1);
    const base = add(scale(first, s * s * s + 3 * s * s * t), scale(last, 3 * s * t * t + t * t * t));
    const residual = sub(points[i], base);
    x0 += dot(a0, residual);
    x1 += dot(a1, residual);
  });
  const det = c00 * c11 - c01 * c01;
  const alphaStart = Math.abs(det) < TINY ? 0 : (x0 * c11 - c01 * x1) / det;
  const alphaEnd = Math.abs(det) < TINY ? 0 : (c00 * x1 - x0 * c01) / det;
  const floor = length(sub(last, first)) * 1e-6;
  if (alphaStart < floor || alphaEnd < floor) return straightCubic(first, last, start, end);
  return [first, add(first, scale(start, alphaStart)), add(last, scale(end, alphaEnd)), last];
}

function worst(points: readonly Point[], cubic: Cubic, u: readonly number[]): { error: number; index: number } {
  let error = 0;
  let index = Math.floor(points.length / 2);
  for (let i = 1; i < points.length - 1; i++) {
    const distance = length(sub(bezierAt(cubic, u[i]), points[i]));
    if (distance > error) {
      error = distance;
      index = i;
    }
  }
  return { error, index };
}

function newtonStep(cubic: Cubic, point: Point, t: number): number {
  const d1 = derivative(cubic);
  const d2 = [scale(sub(d1[1], d1[0]), 2), scale(sub(d1[2], d1[1]), 2)];
  const diff = sub(bezierAt(cubic, t), point);
  const first = quadraticAt(d1, t);
  const second = add(scale(d2[0], 1 - t), scale(d2[1], t));
  const denominator = dot(first, first) + dot(diff, second);
  if (Math.abs(denominator) < TINY) return t;
  return Math.min(1, Math.max(0, t - dot(diff, first) / denominator));
}

function fitRange(points: readonly Point[], start: Point, end: Point, tolerance: number, out: Cubic[]) {
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length === 2) {
    out.push(straightCubic(first, last, start, end));
    return;
  }
  let u = chordParameters(points);
  let cubic = generate(points, u, start, end);
  let { error, index } = worst(points, cubic, u);
  if (error <= tolerance) {
    out.push(cubic);
    return;
  }
  for (let step = 0; step < REPARAMETERIZE_STEPS; step++) {
    u = u.map((t, i) => newtonStep(cubic, points[i], t));
    cubic = generate(points, u, start, end);
    ({ error, index } = worst(points, cubic, u));
    if (error <= tolerance) {
      out.push(cubic);
      return;
    }
  }
  const center = unit(sub(points[index - 1], points[index + 1]));
  const tangent = length(center) < TINY ? unit(sub(points[index - 1], points[index])) : center;
  fitRange(points.slice(0, index + 1), start, tangent, tolerance, out);
  fitRange(points.slice(index), scale(tangent, -1), end, tolerance, out);
}

export function fitCurve(points: readonly Point[], tolerance: number, startTangent?: Point, endTangent?: Point): Cubic[] {
  if (points.length < 2) return [];
  const start = startTangent ? unit(startTangent) : unit(sub(points[1], points[0]));
  const end = endTangent ? unit(endTangent) : unit(sub(points[points.length - 2], points[points.length - 1]));
  const out: Cubic[] = [];
  fitRange(points, start, end, tolerance, out);
  return out;
}
