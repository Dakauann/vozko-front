import type { FillRule, LineJoin } from "./document";
import { booleanSubpaths, type BooleanOp } from "./path-boolean";
import { flattenSegment, mapSubpaths, pathToSubpaths, pointAt, segmentCount, type PathNode, type Subpath } from "./path-nodes";
import { outlineStroke } from "./stroke-outline";
import type { Point } from "./viewport";

export const ZIG_ZAG_POINTS = ["corner", "smooth"] as const;

export type ZigZagPoints = (typeof ZIG_ZAG_POINTS)[number];

export interface Shape {
  subpaths: Subpath[];
  fillRule: FillRule;
}

interface OffsetSpec {
  amount: number;
  copies: number;
  copyOffset: number;
  join: LineJoin;
  miterLimit: number;
}

interface ZigZagSpec {
  size: number;
  ridges: number;
  points: ZigZagPoints;
}

interface Operand {
  subpaths: Subpath[];
  fillRule: FillRule;
}

const ROUND_HANDLE = 0.5519;
const LENGTH_SAMPLES = 32;
const TWIST_STEP_PX = 4;
const SMOOTH_HANDLE = 1 / 3;
const EPSILON = 1e-9;
const TANGENT_DELTA = 1e-4;

function closedOnly(subpaths: readonly Subpath[]): Subpath[] {
  return subpaths.filter((subpath) => subpath.closed && subpath.nodes.length > 2);
}

function openOnly(subpaths: readonly Subpath[]): Subpath[] {
  return subpaths.filter((subpath) => !(subpath.closed && subpath.nodes.length > 2));
}

function offsetOnce(shape: Shape, amount: number, join: LineJoin, miterLimit: number): Subpath[] | null {
  const rings = closedOnly(shape.subpaths);
  if (Math.abs(amount) <= EPSILON || rings.length === 0) return rings;
  const band = outlineStroke(rings, { width: 2 * Math.abs(amount), cap: "butt", join, miterLimit });
  if (!band) return null;
  if (band.length === 0) return rings;
  return booleanSubpaths([{ subpaths: rings, fillRule: shape.fillRule }, { subpaths: band, fillRule: "nonzero" }], amount > 0 ? "union" : "subtract");
}

export function offsetShape(shape: Shape, spec: OffsetSpec): Shape {
  const copies = Math.max(1, Math.round(spec.copies));
  const rings: Subpath[] = [];
  for (let copy = 0; copy < copies; copy++) {
    const ring = offsetOnce(shape, spec.amount + copy * spec.copyOffset, spec.join, spec.miterLimit);
    if (!ring) return { subpaths: [], fillRule: "evenodd" };
    rings.push(...ring);
  }
  return { subpaths: [...rings, ...openOnly(shape.subpaths)], fillRule: copies > 1 || Math.abs(spec.amount) > EPSILON ? "evenodd" : shape.fillRule };
}

function vertexCenter(subpaths: readonly Subpath[]): Point | null {
  let x = 0;
  let y = 0;
  let count = 0;
  for (const subpath of subpaths) {
    for (const node of subpath.nodes) {
      x += node.x;
      y += node.y;
      count += 1;
    }
  }
  return count > 0 ? { x: x / count, y: y / count } : null;
}

function toward(point: Point, center: Point, share: number): Point {
  return { x: point.x + (center.x - point.x) * share, y: point.y + (center.y - point.y) * share };
}

export function puckerBloatShape(shape: Shape, percent: number): Shape {
  const center = vertexCenter(shape.subpaths);
  const share = percent / 100;
  if (!center || Math.abs(share) <= EPSILON) return shape;
  const subpaths = shape.subpaths.map(({ closed, nodes }) => ({
    closed,
    nodes: nodes.map((node) => ({ ...toward(node, center, share), in: toward(node.in ?? node, center, -share), out: toward(node.out ?? node, center, -share) })),
  }));
  return { subpaths, fillRule: shape.fillRule };
}

function sharp(node: PathNode): boolean {
  return !node.in && !node.out;
}

function along(from: Point, to: Point, share: number): Point {
  return { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share };
}

function roundedNodes(subpath: Subpath, radius: number): PathNode[] {
  const { nodes, closed } = subpath;
  const count = nodes.length;
  return nodes.flatMap((node, i) => {
    if (!sharp(node) || (!closed && (i === 0 || i === count - 1))) return [node];
    const before = nodes[(i - 1 + count) % count];
    const after = nodes[(i + 1) % count];
    const reachBefore = Math.hypot(before.x - node.x, before.y - node.y);
    const reachAfter = Math.hypot(after.x - node.x, after.y - node.y);
    if (reachBefore <= EPSILON || reachAfter <= EPSILON) return [node];
    const entry = along(node, before.out ?? before, Math.min(reachBefore / 2, radius) / reachBefore);
    const exit = along(node, after.in ?? after, Math.min(reachAfter / 2, radius) / reachAfter);
    return [
      { x: entry.x, y: entry.y, out: along(entry, node, ROUND_HANDLE) },
      { x: exit.x, y: exit.y, in: along(exit, node, ROUND_HANDLE) },
    ];
  });
}

export function roundCornersShape(shape: Shape, radius: number): Shape {
  if (radius <= EPSILON) return shape;
  return { subpaths: shape.subpaths.map((subpath) => (subpath.nodes.length < 3 && !subpath.closed ? subpath : { closed: subpath.closed, nodes: roundedNodes(subpath, radius) })), fillRule: shape.fillRule };
}

interface Station {
  point: Point;
  tangent: Point;
}

function unit(vector: Point): Point {
  const size = Math.hypot(vector.x, vector.y);
  return size > EPSILON ? { x: vector.x / size, y: vector.y / size } : { x: 0, y: 0 };
}

function tangentAt(subpath: Subpath, segment: number, t: number): Point {
  const a = pointAt(subpath, segment, Math.max(0, t - TANGENT_DELTA));
  const b = pointAt(subpath, segment, Math.min(1, t + TANGENT_DELTA));
  return unit({ x: b.x - a.x, y: b.y - a.y });
}

function lengthTable(subpath: Subpath, segment: number): number[] {
  const table = [0];
  let previous = pointAt(subpath, segment, 0);
  for (let k = 1; k <= LENGTH_SAMPLES; k++) {
    const next = pointAt(subpath, segment, k / LENGTH_SAMPLES);
    table.push(table[k - 1] + Math.hypot(next.x - previous.x, next.y - previous.y));
    previous = next;
  }
  return table;
}

function parameterAt(table: readonly number[], share: number): number {
  const target = share * table[table.length - 1];
  let k = 1;
  while (k < table.length - 1 && table[k] < target) k++;
  const span = table[k] - table[k - 1];
  const within = span > EPSILON ? (target - table[k - 1]) / span : 0;
  return (k - 1 + within) / LENGTH_SAMPLES;
}

function stations(subpath: Subpath, ridges: number): { stations: Station[]; spacing: number[] } {
  const segments = segmentCount(subpath);
  const list: Station[] = [];
  const spacing: number[] = [];
  for (let segment = 0; segment < segments; segment++) {
    const table = lengthTable(subpath, segment);
    const gap = table[table.length - 1] / (ridges + 1);
    for (let k = 0; k <= ridges; k++) {
      const t = parameterAt(table, k / (ridges + 1));
      list.push({ point: pointAt(subpath, segment, t), tangent: tangentAt(subpath, segment, t) });
      spacing.push(gap);
    }
  }
  if (!subpath.closed && segments > 0) {
    const last = subpath.nodes[subpath.nodes.length - 1];
    list.push({ point: { x: last.x, y: last.y }, tangent: tangentAt(subpath, segments - 1, 1) });
    spacing.push(spacing[spacing.length - 1] ?? 0);
  }
  return { stations: list, spacing };
}

function cornerTangent(subpath: Subpath, index: number, ridges: number, own: Station): Point {
  if (index % (ridges + 1) !== 0) return own.tangent;
  const segment = index / (ridges + 1);
  const segments = segmentCount(subpath);
  if (segment >= segments || (segment === 0 && !subpath.closed)) return own.tangent;
  const incoming = tangentAt(subpath, (segment - 1 + segments) % segments, 1);
  const blended = unit({ x: incoming.x + own.tangent.x, y: incoming.y + own.tangent.y });
  return blended.x === 0 && blended.y === 0 ? own.tangent : blended;
}

function zigZagSubpath(subpath: Subpath, spec: ZigZagSpec): Subpath {
  const ridges = Math.max(0, Math.round(spec.ridges));
  const { stations: list, spacing } = stations(subpath, ridges);
  const nodes = list.map((station, i): PathNode => {
    const tangent = cornerTangent(subpath, i, ridges, station);
    const side = i % 2 === 0 ? 1 : -1;
    const x = station.point.x - tangent.y * spec.size * side;
    const y = station.point.y + tangent.x * spec.size * side;
    if (spec.points !== "smooth") return { x, y };
    const reach = spacing[i] * SMOOTH_HANDLE;
    return { x, y, in: { x: x - tangent.x * reach, y: y - tangent.y * reach }, out: { x: x + tangent.x * reach, y: y + tangent.y * reach } };
  });
  return { closed: subpath.closed, nodes };
}

export function zigZagShape(shape: Shape, spec: ZigZagSpec): Shape {
  if (Math.abs(spec.size) <= EPSILON) return shape;
  return { subpaths: shape.subpaths.map((subpath) => (segmentCount(subpath) === 0 ? subpath : zigZagSubpath(subpath, spec))), fillRule: shape.fillRule };
}

function densePoints(subpath: Subpath): Point[] {
  const corners: Point[] = [subpath.nodes[0]];
  for (let segment = 0; segment < segmentCount(subpath); segment++) corners.push(...flattenSegment(subpath, segment, TWIST_STEP_PX));
  if (subpath.closed) corners.pop();
  const edges = subpath.closed ? corners.length : corners.length - 1;
  const points: Point[] = [];
  for (let i = 0; i < edges; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const pieces = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / TWIST_STEP_PX));
    for (let k = 0; k < pieces; k++) points.push(along(a, b, k / pieces));
  }
  if (!subpath.closed) points.push(corners[corners.length - 1]);
  return points;
}

export function twistShape(shape: Shape, degrees: number, center: Point): Shape {
  if (Math.abs(degrees) <= EPSILON) return shape;
  const dense = shape.subpaths.filter((subpath) => segmentCount(subpath) > 0).map((subpath) => ({ closed: subpath.closed, points: densePoints(subpath) }));
  const reach = Math.max(EPSILON, ...dense.flatMap(({ points }) => points.map((p) => Math.hypot(p.x - center.x, p.y - center.y))));
  const turn = (p: Point): PathNode => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const angle = (degrees * Math.PI * (1 - Math.min(1, Math.hypot(dx, dy) / reach))) / 180;
    return { x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle) };
  };
  return { subpaths: dense.map(({ closed, points }) => ({ closed, nodes: points.map(turn) })), fillRule: shape.fillRule };
}

export function mergeShape(shape: Shape, operand: Operand, mode: BooleanOp): Shape {
  const merged = booleanSubpaths(
    [
      { subpaths: shape.subpaths, fillRule: shape.fillRule },
      { subpaths: operand.subpaths, fillRule: operand.fillRule },
    ],
    mode,
  );
  return { subpaths: merged ?? [], fillRule: "evenodd" };
}

interface OperandBox {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

export function placedOperand(path: string, fillRule: FillRule, box: OperandBox, widthPx: number, heightPx: number): Operand {
  const width = box.w * widthPx;
  const height = box.h * heightPx;
  const angle = (box.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cx = box.x * widthPx;
  const cy = box.y * heightPx;
  const place = (p: Point): Point => {
    const lx = (p.x - 0.5) * width;
    const ly = (p.y - 0.5) * height;
    return { x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos };
  };
  return { subpaths: mapSubpaths(pathToSubpaths(path), place), fillRule };
}
