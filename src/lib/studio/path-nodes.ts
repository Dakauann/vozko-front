import type { Bounds } from "./layers";
import type { Point } from "./viewport";

export interface PathNode {
  x: number;
  y: number;
  in?: Point;
  out?: Point;
}

export interface Subpath {
  closed: boolean;
  nodes: PathNode[];
}

export interface NodeRef {
  path: number;
  node: number;
}

export interface SegmentRef {
  path: number;
  segment: number;
}

export type HandleSide = "in" | "out";

export interface PathHit extends SegmentRef {
  t: number;
  distance: number;
  point: Point;
}

const ARITY: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const SEPARATOR = /[\s,]/;
const SAME = 1e-9;
const SMOOTH_TOLERANCE = 1e-6;
const NEAREST_SAMPLES = 64;
const NEAREST_REFINE_STEPS = 24;
const MAX_FLATTEN_SAMPLES = 64;

interface Command {
  command: string;
  values: number[];
}

function tokenize(data: string): Command[] {
  const commands: Command[] = [];
  let i = 0;
  while (i < data.length) {
    const char = data[i];
    if (SEPARATOR.test(char)) {
      i++;
      continue;
    }
    if (char.toLowerCase() in ARITY) {
      commands.push({ command: char, values: [] });
      i++;
      continue;
    }
    const current = commands[commands.length - 1];
    if (!current) return [];
    const position = current.values.length % 7;
    if (current.command.toLowerCase() === "a" && (position === 3 || position === 4)) {
      if (char !== "0" && char !== "1") return [];
      current.values.push(Number(char));
      i++;
      continue;
    }
    NUMBER.lastIndex = i;
    const match = NUMBER.exec(data);
    if (!match) return [];
    const value = Number(match[0]);
    if (!Number.isFinite(value)) return [];
    current.values.push(value);
    i = NUMBER.lastIndex;
  }
  return commands;
}

function same(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < SAME && Math.abs(a.y - b.y) < SAME;
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function reflect(control: Point, around: Point): Point {
  return { x: 2 * around.x - control.x, y: 2 * around.y - control.y };
}

function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
  const dot = ux * vx + uy * vy;
  const length = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  const angle = Math.acos(Math.min(1, Math.max(-1, dot / length)));
  return ux * vy - uy * vx < 0 ? -angle : angle;
}

function arcToCubics(from: Point, radiusX: number, radiusY: number, degrees: number, large: boolean, sweep: boolean, to: Point): [Point, Point, Point][] | null {
  let rx = Math.abs(radiusX);
  let ry = Math.abs(radiusY);
  if (rx < SAME || ry < SAME) return null;
  const phi = (degrees * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const coefficient = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator));
  const cx1 = (coefficient * rx * y1) / ry;
  const cy1 = (-coefficient * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (from.x + to.x) / 2;
  const cy = sin * cx1 + cos * cy1 + (from.y + to.y) / 2;
  const start = vectorAngle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let delta = vectorAngle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const pieces = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const step = delta / pieces;
  const k = (4 / 3) * Math.tan(step / 4);
  const at = (t: number): Point => ({ x: cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, y: cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos });
  const tangent = (t: number): Point => ({ x: -rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, y: -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos });
  const curves: [Point, Point, Point][] = [];
  for (let i = 0; i < pieces; i++) {
    const t1 = start + i * step;
    const t2 = t1 + step;
    const p1 = at(t1);
    const p2 = i === pieces - 1 ? to : at(t2);
    const d1 = tangent(t1);
    const d2 = tangent(t2);
    curves.push([{ x: p1.x + k * d1.x, y: p1.y + k * d1.y }, { x: p2.x - k * d2.x, y: p2.y - k * d2.y }, p2]);
  }
  return curves;
}

class PathBuilder {
  readonly subpaths: Subpath[] = [];
  private current: Subpath | null = null;
  pen: Point = { x: 0, y: 0 };
  private start: Point = { x: 0, y: 0 };

  moveTo(point: Point): void {
    this.current = { closed: false, nodes: [{ x: point.x, y: point.y }] };
    this.subpaths.push(this.current);
    this.pen = point;
    this.start = point;
  }

  private open(): Subpath {
    if (!this.current || this.current.closed) this.moveTo(this.pen);
    return this.current!;
  }

  lineTo(point: Point): void {
    this.open().nodes.push({ x: point.x, y: point.y });
    this.pen = point;
  }

  cubicTo(c1: Point, c2: Point, point: Point): void {
    const nodes = this.open().nodes;
    const last = nodes[nodes.length - 1];
    if (!same(c1, last)) last.out = c1;
    nodes.push(same(c2, point) ? { x: point.x, y: point.y } : { x: point.x, y: point.y, in: c2 });
    this.pen = point;
  }

  close(): void {
    const current = this.current;
    if (!current || current.closed) return;
    const nodes = current.nodes;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (nodes.length > 1 && same(first, last)) {
      nodes.pop();
      if (last.in) nodes[0] = { ...first, in: last.in };
    }
    current.closed = true;
    this.pen = this.start;
  }
}

export function pathToSubpaths(data: string): Subpath[] {
  const builder = new PathBuilder();
  let lastCubic: Point | null = null;
  let lastQuad: Point | null = null;
  for (const { command, values } of tokenize(data)) {
    const kind = command.toLowerCase();
    const relative = command === kind;
    const arity = ARITY[kind];
    if (kind === "z") {
      builder.close();
      lastCubic = lastQuad = null;
      continue;
    }
    for (let k = 0; k + arity <= values.length; k += arity) {
      const v = values.slice(k, k + arity);
      const pen = builder.pen;
      const point = (x: number, y: number): Point => (relative ? { x: pen.x + x, y: pen.y + y } : { x, y });
      let cubic: Point | null = null;
      let quad: Point | null = null;
      switch (kind) {
        case "m":
          if (k === 0) builder.moveTo(point(v[0], v[1]));
          else builder.lineTo(point(v[0], v[1]));
          break;
        case "l":
          builder.lineTo(point(v[0], v[1]));
          break;
        case "h":
          builder.lineTo({ x: relative ? pen.x + v[0] : v[0], y: pen.y });
          break;
        case "v":
          builder.lineTo({ x: pen.x, y: relative ? pen.y + v[0] : v[0] });
          break;
        case "c":
          cubic = point(v[2], v[3]);
          builder.cubicTo(point(v[0], v[1]), cubic, point(v[4], v[5]));
          break;
        case "s":
          cubic = point(v[0], v[1]);
          builder.cubicTo(lastCubic ? reflect(lastCubic, pen) : pen, cubic, point(v[2], v[3]));
          break;
        case "q":
        case "t": {
          quad = kind === "q" ? point(v[0], v[1]) : lastQuad ? reflect(lastQuad, pen) : pen;
          const end = kind === "q" ? point(v[2], v[3]) : point(v[0], v[1]);
          builder.cubicTo(lerp(pen, quad, 2 / 3), lerp(end, quad, 2 / 3), end);
          break;
        }
        case "a": {
          const end = point(v[5], v[6]);
          if (same(pen, end)) break;
          const curves = arcToCubics(pen, v[0], v[1], v[2], v[3] === 1, v[4] === 1, end);
          if (!curves) builder.lineTo(end);
          else for (const [c1, c2, to] of curves) builder.cubicTo(c1, c2, to);
          break;
        }
      }
      lastCubic = cubic;
      lastQuad = quad;
    }
  }
  return builder.subpaths;
}

function format(value: number): string {
  return String(Math.round(value * 1e5) / 1e5 || 0);
}

function pair(point: Point): string {
  return `${format(point.x)} ${format(point.y)}`;
}

function segmentData(from: PathNode, to: PathNode): string {
  if (!from.out && !to.in) return `L${pair(to)}`;
  return `C${pair(from.out ?? from)} ${pair(to.in ?? to)} ${pair(to)}`;
}

export function subpathsToPath(subpaths: readonly Subpath[]): string {
  const parts: string[] = [];
  for (const { closed, nodes } of subpaths) {
    if (nodes.length === 0) continue;
    parts.push(`M${pair(nodes[0])}`);
    for (let i = 1; i < nodes.length; i++) parts.push(segmentData(nodes[i - 1], nodes[i]));
    if (!closed) continue;
    const last = nodes[nodes.length - 1];
    if (last.out || nodes[0].in) parts.push(segmentData(last, nodes[0]));
    parts.push("Z");
  }
  return parts.join(" ");
}

export function segmentCount(subpath: Subpath): number {
  if (subpath.nodes.length < 2) return 0;
  return subpath.closed ? subpath.nodes.length : subpath.nodes.length - 1;
}

function segmentEnds(subpath: Subpath, segment: number): [PathNode, PathNode] {
  const nodes = subpath.nodes;
  return [nodes[segment], nodes[(segment + 1) % nodes.length]];
}

export function pointAt(subpath: Subpath, segment: number, t: number): Point {
  const [from, to] = segmentEnds(subpath, segment);
  if (!from.out && !to.in) return lerp(from, to, t);
  const c1 = from.out ?? from;
  const c2 = to.in ?? to;
  const u = 1 - t;
  return {
    x: u * u * u * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x,
    y: u * u * u * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y,
  };
}

export function flattenSegment(subpath: Subpath, segment: number, step: number): Point[] {
  const [from, to] = segmentEnds(subpath, segment);
  const c1 = from.out ?? from;
  const c2 = to.in ?? to;
  const reach = Math.hypot(c1.x - from.x, c1.y - from.y) + Math.hypot(c2.x - c1.x, c2.y - c1.y) + Math.hypot(to.x - c2.x, to.y - c2.y);
  const count = !from.out && !to.in ? 1 : Math.max(1, Math.min(MAX_FLATTEN_SAMPLES, Math.ceil(reach / step)));
  return Array.from({ length: count }, (_, k) => (k + 1 === count ? { x: to.x, y: to.y } : pointAt(subpath, segment, (k + 1) / count)));
}

function extremaOf(p0: number, c1: number, c2: number, p3: number): number[] {
  const a = -p0 + 3 * c1 - 3 * c2 + p3;
  const b = 2 * (p0 - 2 * c1 + c2);
  const c = c1 - p0;
  if (Math.abs(a) < SAME) return Math.abs(b) < SAME ? [] : [-c / b];
  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];
  const root = Math.sqrt(disc);
  return [(-b + root) / (2 * a), (-b - root) / (2 * a)];
}

export function pathBounds(subpaths: readonly Subpath[]): Bounds {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  const include = (p: Point) => {
    left = Math.min(left, p.x);
    right = Math.max(right, p.x);
    top = Math.min(top, p.y);
    bottom = Math.max(bottom, p.y);
  };
  for (const subpath of subpaths) {
    for (const node of subpath.nodes) include(node);
    for (let s = 0; s < segmentCount(subpath); s++) {
      const [from, to] = segmentEnds(subpath, s);
      if (!from.out && !to.in) continue;
      const c1 = from.out ?? from;
      const c2 = to.in ?? to;
      for (const t of [...extremaOf(from.x, c1.x, c2.x, to.x), ...extremaOf(from.y, c1.y, c2.y, to.y)]) {
        if (t > 0 && t < 1) include(pointAt(subpath, s, t));
      }
    }
  }
  return Number.isFinite(left) ? { left, top, right, bottom } : { left: 0, top: 0, right: 0, bottom: 0 };
}

export function mapSubpaths(subpaths: readonly Subpath[], map: (point: Point) => Point): Subpath[] {
  return subpaths.map(({ closed, nodes }) => ({
    closed,
    nodes: nodes.map((node) => {
      const anchor = map(node);
      return { x: anchor.x, y: anchor.y, ...(node.in ? { in: map(node.in) } : {}), ...(node.out ? { out: map(node.out) } : {}) };
    }),
  }));
}

export function fitToUnit(subpaths: readonly Subpath[]): { subpaths: Subpath[]; bounds: Bounds } {
  const bounds = pathBounds(subpaths);
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const map = (p: Point): Point => ({ x: width > SAME ? (p.x - bounds.left) / width : 0.5, y: height > SAME ? (p.y - bounds.top) / height : 0.5 });
  return { subpaths: mapSubpaths(subpaths, map), bounds };
}

function withNode(subpaths: readonly Subpath[], ref: NodeRef, change: (node: PathNode) => PathNode): Subpath[] {
  return subpaths.map((subpath, p) => (p !== ref.path ? subpath : { ...subpath, nodes: subpath.nodes.map((node, n) => (n === ref.node ? change(node) : node)) }));
}

function shift(point: Point | undefined, delta: Point): Point | undefined {
  return point ? { x: point.x + delta.x, y: point.y + delta.y } : undefined;
}

function strip(node: PathNode): PathNode {
  return { x: node.x, y: node.y, ...(node.in ? { in: node.in } : {}), ...(node.out ? { out: node.out } : {}) };
}

export function moveNode(subpaths: readonly Subpath[], ref: NodeRef, delta: Point): Subpath[] {
  return withNode(subpaths, ref, (node) => strip({ x: node.x + delta.x, y: node.y + delta.y, in: shift(node.in, delta), out: shift(node.out, delta) }));
}

export function isSmooth(node: PathNode): boolean {
  if (!node.in || !node.out) return false;
  const ax = node.in.x - node.x;
  const ay = node.in.y - node.y;
  const bx = node.out.x - node.x;
  const by = node.out.y - node.y;
  const lengths = Math.hypot(ax, ay) * Math.hypot(bx, by);
  return lengths > SAME && Math.abs(ax * by - ay * bx) <= SMOOTH_TOLERANCE * lengths && ax * bx + ay * by < 0;
}

export function moveHandle(subpaths: readonly Subpath[], ref: NodeRef, side: HandleSide, point: Point, mirror: boolean): Subpath[] {
  return withNode(subpaths, ref, (node) => {
    const other: HandleSide = side === "in" ? "out" : "in";
    const opposite = node[other];
    const moved = { ...node, [side]: point };
    if (!mirror || !opposite || !isSmooth(node)) return strip(moved);
    const length = Math.hypot(opposite.x - node.x, opposite.y - node.y);
    const dx = point.x - node.x;
    const dy = point.y - node.y;
    const reach = Math.hypot(dx, dy);
    if (reach < SAME) return strip(moved);
    return strip({ ...moved, [other]: { x: node.x - (dx / reach) * length, y: node.y - (dy / reach) * length } });
  });
}

function neighbors(subpath: Subpath, index: number): { previous: PathNode | null; next: PathNode | null } {
  const nodes = subpath.nodes;
  const count = nodes.length;
  const previous = index > 0 ? nodes[index - 1] : subpath.closed ? nodes[count - 1] : null;
  const next = index < count - 1 ? nodes[index + 1] : subpath.closed ? nodes[0] : null;
  return { previous, next };
}

export function toggleSmooth(subpaths: readonly Subpath[], ref: NodeRef): Subpath[] {
  const subpath = subpaths[ref.path];
  const node = subpath?.nodes[ref.node];
  if (!node) return [...subpaths];
  if (node.in || node.out) return withNode(subpaths, ref, (n) => ({ x: n.x, y: n.y }));
  const { previous, next } = neighbors(subpath, ref.node);
  const from = previous ?? node;
  const to = next ?? node;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < SAME) return [...subpaths];
  const ux = dx / length;
  const uy = dy / length;
  const before = previous ? Math.hypot(node.x - previous.x, node.y - previous.y) / 3 : 0;
  const after = next ? Math.hypot(next.x - node.x, next.y - node.y) / 3 : 0;
  return withNode(subpaths, ref, (n) =>
    strip({
      x: n.x,
      y: n.y,
      in: previous ? { x: n.x - ux * before, y: n.y - uy * before } : undefined,
      out: next ? { x: n.x + ux * after, y: n.y + uy * after } : undefined,
    }),
  );
}

export function deleteNode(subpaths: readonly Subpath[], ref: NodeRef): Subpath[] | null {
  const next = subpaths
    .map((subpath, p) => (p !== ref.path ? subpath : { ...subpath, nodes: subpath.nodes.filter((_, n) => n !== ref.node) }))
    .filter((subpath) => subpath.nodes.length >= 2);
  return next.length === 0 ? null : next;
}

export function insertNode(subpaths: readonly Subpath[], ref: SegmentRef, t: number): Subpath[] {
  const subpath = subpaths[ref.path];
  if (!subpath || ref.segment < 0 || ref.segment >= segmentCount(subpath)) return [...subpaths];
  const [from, to] = segmentEnds(subpath, ref.segment);
  const toIndex = (ref.segment + 1) % subpath.nodes.length;
  const nodes = subpath.nodes.map((node) => ({ ...node }));
  let added: PathNode;
  if (!from.out && !to.in) {
    added = lerp(from, to, t);
  } else {
    const c1 = from.out ?? from;
    const c2 = to.in ?? to;
    const q0 = lerp(from, c1, t);
    const q1 = lerp(c1, c2, t);
    const q2 = lerp(c2, to, t);
    const r0 = lerp(q0, q1, t);
    const r1 = lerp(q1, q2, t);
    const split = lerp(r0, r1, t);
    nodes[ref.segment] = { ...nodes[ref.segment], out: q0 };
    nodes[toIndex] = { ...nodes[toIndex], in: q2 };
    added = { x: split.x, y: split.y, in: r0, out: r1 };
  }
  nodes.splice(ref.segment + 1, 0, added);
  return subpaths.map((s, p) => (p === ref.path ? { ...s, nodes } : s));
}

function distanceAt(subpath: Subpath, segment: number, t: number, point: Point): number {
  const at = pointAt(subpath, segment, t);
  return Math.hypot(at.x - point.x, at.y - point.y);
}

export function nearestOnPath(subpaths: readonly Subpath[], point: Point): PathHit | null {
  let best: PathHit | null = null;
  subpaths.forEach((subpath, path) => {
    for (let segment = 0; segment < segmentCount(subpath); segment++) {
      let bestT = 0;
      let bestDistance = Infinity;
      for (let i = 0; i <= NEAREST_SAMPLES; i++) {
        const t = i / NEAREST_SAMPLES;
        const distance = distanceAt(subpath, segment, t, point);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestT = t;
        }
      }
      let lo = Math.max(0, bestT - 1 / NEAREST_SAMPLES);
      let hi = Math.min(1, bestT + 1 / NEAREST_SAMPLES);
      for (let i = 0; i < NEAREST_REFINE_STEPS; i++) {
        const a = lo + (hi - lo) / 3;
        const b = hi - (hi - lo) / 3;
        if (distanceAt(subpath, segment, a, point) < distanceAt(subpath, segment, b, point)) hi = b;
        else lo = a;
      }
      const t = (lo + hi) / 2;
      const distance = distanceAt(subpath, segment, t, point);
      if (!best || distance < best.distance) best = { path, segment, t, distance, point: pointAt(subpath, segment, t) };
    }
  });
  return best;
}
