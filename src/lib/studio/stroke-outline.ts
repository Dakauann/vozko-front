import type { LineCap, LineJoin } from "./document";
import { booleanSubpaths } from "./path-boolean";
import { flattenSegment, segmentCount, type Subpath } from "./path-nodes";
import { simplifySubpaths } from "./path-simplify";
import type { Point } from "./viewport";

export interface StrokeOutlineSpec {
  width: number;
  cap: LineCap;
  join: LineJoin;
  miterLimit: number;
  dash?: readonly number[];
  dashOffset?: number;
}

interface Piece {
  points: Point[];
  closed: boolean;
  direction: Point;
}

const FLATTEN_STEP = 0.5;
const ARC_TOLERANCE = 0.05;
const MAX_ARC_STEP = Math.PI / 32;
const FIT_TOLERANCE = 0.25;
const REACH = 1e-9;

function plus(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

function times(a: Point, k: number): Point {
  return { x: a.x * k, y: a.y * k };
}

function heading(from: Point, to: Point): Point {
  const size = Math.hypot(to.x - from.x, to.y - from.y);
  return { x: (to.x - from.x) / size, y: (to.y - from.y) / size };
}

function leftOf(direction: Point, half: number): Point {
  return { x: -direction.y * half, y: direction.x * half };
}

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function distinct(points: readonly Point[]): Point[] {
  return points.filter((p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y);
}

function pieceOf(subpath: Subpath): Piece | null {
  const segments = segmentCount(subpath);
  if (segments === 0) return null;
  const sampled = [{ x: subpath.nodes[0].x, y: subpath.nodes[0].y }];
  for (let segment = 0; segment < segments; segment++) sampled.push(...flattenSegment(subpath, segment, FLATTEN_STEP));
  const points = distinct(sampled);
  if (subpath.closed && points.length > 1 && points[0].x === points[points.length - 1].x && points[0].y === points[points.length - 1].y) points.pop();
  if (points.length < 2) return null;
  return { points, closed: subpath.closed && points.length > 2, direction: heading(points[0], points[1]) };
}

function dashPattern(dash: readonly number[] | undefined): number[] | null {
  if (!dash || dash.length === 0) return null;
  const pattern = dash.length % 2 === 1 ? [...dash, ...dash] : [...dash];
  return pattern.reduce((sum, value) => sum + value, 0) > 0 ? pattern : null;
}

function dashed(piece: Piece, pattern: readonly number[], offset: number): Piece[] {
  const period = pattern.reduce((sum, value) => sum + value, 0);
  const points = piece.closed ? [...piece.points, piece.points[0]] : piece.points;
  let index = 0;
  let left = pattern[0];
  for (let phase = ((offset % period) + period) % period; phase > 0; ) {
    const used = Math.min(phase, left);
    phase -= used;
    left -= used;
    if (left <= 0 && phase > 0) {
      index = (index + 1) % pattern.length;
      left = pattern[index];
    }
  }
  const pieces: Piece[] = [];
  let current: Point[] | null = index % 2 === 0 ? [points[0]] : null;
  let direction = heading(points[0], points[1]);
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length === 0) continue;
    direction = heading(from, to);
    let travelled = 0;
    while (travelled + left <= length + REACH) {
      travelled += left;
      const at = plus(from, times(direction, Math.min(travelled, length)));
      if (current) {
        pieces.push({ points: distinct([...current, at]), closed: false, direction });
        current = null;
      } else {
        current = [at];
      }
      index = (index + 1) % pattern.length;
      left = pattern[index];
    }
    left -= length - travelled;
    if (current) current.push(to);
  }
  if (current) pieces.push({ points: distinct(current), closed: false, direction });
  return pieces;
}

function arc(center: Point, from: Point, sweep: number, half: number): Point[] {
  const step = Math.min(MAX_ARC_STEP, 2 * Math.acos(Math.max(-1, 1 - ARC_TOLERANCE / half)));
  const count = Math.max(1, Math.ceil(Math.abs(sweep) / step));
  const start = Math.atan2(from.y, from.x);
  return Array.from({ length: count + 1 }, (_, k) => {
    const angle = start + (sweep * k) / count;
    return { x: center.x + half * Math.cos(angle), y: center.y + half * Math.sin(angle) };
  });
}

function joinPoints(at: Point, before: Point, after: Point, half: number, spec: StrokeOutlineSpec): Point[] {
  const a = leftOf(before, half);
  const b = leftOf(after, half);
  const turn = cross(before, after);
  if (turn > 0) return [plus(at, a), at, plus(at, b)];
  if (Math.abs(turn) < 1e-9 && before.x * after.x + before.y * after.y > 0) return [plus(at, a)];
  if (spec.join === "round") {
    const sweep = Math.atan2(cross(a, b), a.x * b.x + a.y * b.y);
    return arc(at, a, sweep, half);
  }
  const sum = plus(a, b);
  const span = Math.hypot(sum.x, sum.y);
  if (spec.join === "miter" && span > 0 && (2 * half) / span <= spec.miterLimit) return [plus(at, times(sum, (2 * half * half) / (span * span)))];
  return [plus(at, a), plus(at, b)];
}

function side(points: readonly Point[], closed: boolean, half: number, spec: StrokeOutlineSpec): Point[] {
  const count = points.length;
  const segments = closed ? count : count - 1;
  const directions = Array.from({ length: segments }, (_, i) => heading(points[i], points[(i + 1) % count]));
  const out: Point[] = [];
  if (!closed) out.push(plus(points[0], leftOf(directions[0], half)));
  for (let i = closed ? 0 : 1; i < (closed ? count : count - 1); i++) {
    out.push(...joinPoints(points[i], directions[(i - 1 + segments) % segments], directions[i % segments], half, spec));
  }
  if (!closed) out.push(plus(points[count - 1], leftOf(directions[segments - 1], half)));
  return out;
}

function cap(at: Point, normal: Point, outward: Point, half: number, spec: StrokeOutlineSpec): Point[] {
  if (spec.cap === "square") return [plus(plus(at, normal), times(outward, half)), plus(plus(at, times(normal, -1)), times(outward, half))];
  if (spec.cap === "round") return arc(at, normal, cross(normal, outward) > 0 ? Math.PI : -Math.PI, half).slice(1, -1);
  return [];
}

function dot(at: Point, direction: Point, half: number, spec: StrokeOutlineSpec): Point[][] {
  if (spec.cap === "round") return [arc(at, { x: half, y: 0 }, 2 * Math.PI, half).slice(0, -1)];
  if (spec.cap !== "square") return [];
  const along = times(direction, half);
  const across = leftOf(direction, half);
  return [[plus(plus(at, along), across), plus(plus(at, times(along, -1)), across), plus(plus(at, times(along, -1)), times(across, -1)), plus(plus(at, along), times(across, -1))]];
}

function rings(piece: Piece, spec: StrokeOutlineSpec): Point[][] {
  const half = spec.width / 2;
  if (piece.points.length === 1) return dot(piece.points[0], piece.direction, half, spec);
  const reversed = [...piece.points].reverse();
  if (piece.closed) return [side(piece.points, true, half, spec), side(reversed, true, half, spec)];
  const first = heading(piece.points[0], piece.points[1]);
  const last = heading(piece.points[piece.points.length - 2], piece.points[piece.points.length - 1]);
  const end = piece.points[piece.points.length - 1];
  return [[
    ...side(piece.points, false, half, spec),
    ...cap(end, leftOf(last, half), last, half, spec),
    ...side(reversed, false, half, spec),
    ...cap(piece.points[0], leftOf(times(first, -1), half), times(first, -1), half, spec),
  ]];
}

function signedArea(ring: readonly Point[]): number {
  let twice = 0;
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length];
    twice += a.x * b.y - b.x * a.y;
  });
  return twice / 2;
}

function upright(set: Point[][]): Point[][] {
  const dominant = set.reduce((best, ring) => (Math.abs(signedArea(ring)) > Math.abs(signedArea(best)) ? ring : best), set[0]);
  return signedArea(dominant) < 0 ? set.map((ring) => [...ring].reverse()) : set;
}

export function outlineStroke(subpaths: readonly Subpath[], spec: StrokeOutlineSpec, extra: readonly Point[][] = []): Subpath[] | null {
  if (spec.width <= 0) return [];
  const pattern = dashPattern(spec.dash);
  const pieces = subpaths.flatMap((subpath) => pieceOf(subpath) ?? []);
  const cut = pattern ? pieces.flatMap((piece) => dashed(piece, pattern, spec.dashOffset ?? 0)) : pieces;
  const outline = [...cut.map((piece) => rings(piece, spec)).filter((set) => set.length > 0), ...extra.map((ring) => [ring])].flatMap(upright);
  if (outline.length === 0) return [];
  const united = booleanSubpaths([{ subpaths: outline.map((ring) => ({ closed: true, nodes: ring.map(({ x, y }) => ({ x, y })) })), fillRule: "nonzero" }], "union");
  return united ? simplifySubpaths(united, FIT_TOLERANCE) : null;
}
