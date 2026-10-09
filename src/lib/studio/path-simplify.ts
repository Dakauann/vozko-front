import { fitCurve } from "./curve-fit";
import { flattenSegment, segmentCount, type PathNode, type Subpath } from "./path-nodes";
import type { Point } from "./viewport";

export const CORNER_DEGREES = 40;

const CHORD_SAMPLES_PER_TOLERANCE = 8;
const LONG_LINE_PER_TOLERANCE = 16;

function towards(from: Point, to: Point): Point | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const size = Math.hypot(dx, dy);
  return size === 0 ? null : { x: dx / size, y: dy / size };
}

function firstDistinct(node: Point, candidates: (Point | undefined)[]): Point | undefined {
  return candidates.find((point): point is Point => point !== undefined && (point.x !== node.x || point.y !== node.y));
}

function neighbour(subpath: Subpath, index: number, step: 1 | -1): PathNode | null {
  const { nodes, closed } = subpath;
  const at = index + step;
  if (at >= 0 && at < nodes.length) return nodes[at];
  return closed ? nodes[(at + nodes.length) % nodes.length] : null;
}

function arriving(subpath: Subpath, index: number): Point | null {
  const node = subpath.nodes[index];
  const previous = neighbour(subpath, index, -1);
  if (!previous) return null;
  const from = firstDistinct(node, [node.in, previous.out, previous]);
  return from ? towards(from, node) : null;
}

function leaving(subpath: Subpath, index: number): Point | null {
  const node = subpath.nodes[index];
  const next = neighbour(subpath, index, 1);
  if (!next) return null;
  const to = firstDistinct(node, [node.out, next.in, next]);
  return to ? towards(node, to) : null;
}

function isCorner(subpath: Subpath, index: number, cornerDegrees: number): boolean {
  const before = arriving(subpath, index);
  const after = leaving(subpath, index);
  if (!before || !after) return true;
  const cosine = Math.max(-1, Math.min(1, before.x * after.x + before.y * after.y));
  return (Math.acos(cosine) * 180) / Math.PI > cornerDegrees;
}

function isLongLine(subpath: Subpath, segment: number, tolerance: number): boolean {
  const count = segmentCount(subpath);
  if (segment < 0 || segment >= count) return false;
  const from = subpath.nodes[segment];
  const to = subpath.nodes[(segment + 1) % subpath.nodes.length];
  return !from.out && !to.in && Math.hypot(to.x - from.x, to.y - from.y) > tolerance * LONG_LINE_PER_TOLERANCE;
}

function isBreak(subpath: Subpath, index: number, tolerance: number, cornerDegrees: number): boolean {
  if (isCorner(subpath, index, cornerDegrees)) return true;
  const before = subpath.closed ? (index - 1 + subpath.nodes.length) % subpath.nodes.length : index - 1;
  return isLongLine(subpath, before, tolerance) !== isLongLine(subpath, index, tolerance);
}

function densified(points: readonly Point[], spacing: number): Point[] {
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const parts = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / spacing);
    for (let k = 1; k < parts; k++) out.push({ x: from.x + ((to.x - from.x) * k) / parts, y: from.y + ((to.y - from.y) * k) / parts });
    out.push(to);
  }
  return out;
}

function straight(points: readonly Point[], tolerance: number): boolean {
  const first = points[0];
  const last = points[points.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const size = Math.hypot(dx, dy);
  if (size === 0) return false;
  return points.every((p) => Math.abs((p.x - first.x) * dy - (p.y - first.y) * dx) / size <= tolerance);
}

interface Run {
  from: number;
  to: number;
}

function runsOf(subpath: Subpath, corners: number[]): Run[] {
  const count = segmentCount(subpath);
  if (!subpath.closed) return corners.slice(0, -1).map((from, i) => ({ from, to: corners[i + 1] }));
  if (corners.length === 0) return [{ from: 0, to: count }];
  return corners.map((from, i) => ({ from, to: i + 1 < corners.length ? corners[i + 1] : corners[0] + count }));
}

function fitRun(subpath: Subpath, run: Run, tolerance: number): PathNode[] {
  const size = subpath.nodes.length;
  const start = subpath.nodes[run.from % size];
  const points: Point[] = [{ x: start.x, y: start.y }];
  for (let segment = run.from; segment < run.to; segment++) points.push(...flattenSegment(subpath, segment % size, tolerance));
  const end = points[points.length - 1];
  if (straight(points, tolerance)) return [{ x: start.x, y: start.y }, { x: end.x, y: end.y }];
  const out = leaving(subpath, run.from % size) ?? undefined;
  const back = arriving(subpath, run.to % size);
  const cubics = fitCurve(densified(points, tolerance * CHORD_SAMPLES_PER_TOLERANCE), tolerance, out, back ? { x: -back.x, y: -back.y } : undefined);
  const nodes: PathNode[] = [{ x: start.x, y: start.y }];
  for (const [, c1, c2, p3] of cubics) {
    nodes[nodes.length - 1].out = c1;
    nodes.push({ x: p3.x, y: p3.y, in: c2 });
  }
  return nodes;
}

function joined(runs: PathNode[][], closed: boolean): PathNode[] {
  const nodes: PathNode[] = [];
  for (const run of runs) {
    const [head, ...rest] = run;
    if (nodes.length === 0) nodes.push(head);
    else nodes[nodes.length - 1] = { ...nodes[nodes.length - 1], ...(head.out ? { out: head.out } : {}) };
    nodes.push(...rest);
  }
  if (closed && nodes.length > 1) {
    const last = nodes.pop()!;
    nodes[0] = { ...nodes[0], ...(last.in ? { in: last.in } : {}) };
  }
  return nodes;
}

function simplified(subpath: Subpath, tolerance: number, cornerDegrees: number): Subpath {
  if (segmentCount(subpath) < 2) return subpath;
  const corners = subpath.nodes.flatMap((_, i) => (isBreak(subpath, i, tolerance, cornerDegrees) ? [i] : []));
  const nodes = joined(runsOf(subpath, corners).map((run) => fitRun(subpath, run, tolerance)), subpath.closed);
  return nodes.length < subpath.nodes.length ? { closed: subpath.closed, nodes } : subpath;
}

export function simplifySubpaths(subpaths: readonly Subpath[], tolerance: number, cornerDegrees: number = CORNER_DEGREES): Subpath[] {
  return subpaths.map((subpath) => simplified(subpath, tolerance, cornerDegrees));
}
