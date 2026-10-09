import { arcSegmentToCubics, FillRule as ArrangementFill, PathBoolean, PathBooleanOperation, type Path } from "path-bool";

import type { FillRule } from "./document";
import type { PathNode, Subpath } from "./path-nodes";
import type { Point } from "./viewport";

export const BOOLEAN_OPS = ["union", "subtract", "intersect", "exclude"] as const;
export type BooleanOp = (typeof BOOLEAN_OPS)[number];

export interface BooleanInput {
  subpaths: readonly Subpath[];
  fillRule?: FillRule;
}

const OPERATIONS: Record<BooleanOp, PathBooleanOperation> = {
  union: PathBooleanOperation.Union,
  subtract: PathBooleanOperation.Difference,
  intersect: PathBooleanOperation.Intersection,
  exclude: PathBooleanOperation.Exclusion,
};

const JOIN_DISTANCE = 1e-6;

type Vector = [number, number];
type Cubic = ["C", Vector, Vector, Vector, Vector];
type Segment = Path[number];

function vector(point: Point): Vector {
  return [point.x, point.y];
}

function point([x, y]: Vector): Point {
  return { x, y };
}

function same(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function segmentBetween(from: PathNode, to: PathNode): Segment | null {
  if (!from.out && !to.in) return same(from, to) ? null : ["L", vector(from), vector(to)];
  const c1 = from.out ?? from;
  const c2 = to.in ?? to;
  if (same(from, to) && same(c1, from) && same(c2, to)) return null;
  return ["C", vector(from), vector(c1), vector(c2), vector(to)];
}

function segmentsOf(subpaths: readonly Subpath[]): Path {
  return subpaths.flatMap(({ nodes }) => {
    if (nodes.length < 2) return [];
    return nodes.flatMap((node, i) => {
      const segment = segmentBetween(node, nodes[(i + 1) % nodes.length]);
      return segment ? [segment] : [];
    });
  });
}

function cubicsOf(segment: Segment): Cubic[] | Segment[] {
  if (segment[0] === "A") return arcSegmentToCubics(segment);
  if (segment[0] !== "Q") return [segment];
  const [, from, control, to] = segment;
  const toward = (end: Vector): Vector => [end[0] + (2 / 3) * (control[0] - end[0]), end[1] + (2 / 3) * (control[1] - end[1])];
  return [["C", from, toward(from), toward(to), to]];
}

function near(a: Point, b: Point): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= JOIN_DISTANCE;
}

function subpathsOf(path: Path): Subpath[] {
  const rings: Subpath[] = [];
  let nodes: PathNode[] = [];
  const settle = () => {
    if (nodes.length > 2 && near(nodes[nodes.length - 1], nodes[0])) {
      const end = nodes.pop()!;
      if (end.in) nodes[0] = { ...nodes[0], in: end.in };
    }
    if (nodes.length > 1) rings.push({ closed: true, nodes });
    nodes = [];
  };
  for (const segment of path.flatMap(cubicsOf)) {
    const from = point(segment[1] as Vector);
    if (nodes.length > 0 && !near(nodes[nodes.length - 1], from)) settle();
    if (nodes.length === 0) nodes.push(from);
    const last = nodes[nodes.length - 1];
    if (segment[0] === "C") {
      last.out = point(segment[2]);
      nodes.push({ ...point(segment[4]), in: point(segment[3]) });
    } else {
      nodes.push(point(segment[2] as Vector));
    }
    if (nodes.length > 2 && near(nodes[nodes.length - 1], nodes[0])) settle();
  }
  settle();
  return rings;
}

export function booleanSubpaths(inputs: readonly BooleanInput[], op: BooleanOp): Subpath[] | null {
  try {
    const arrangement = new PathBoolean(inputs.map(({ subpaths, fillRule }) => ({ path: segmentsOf(subpaths), fillRule: fillRule === "evenodd" ? ArrangementFill.EvenOdd : ArrangementFill.NonZero })));
    return arrangement.get(OPERATIONS[op]).flatMap(subpathsOf);
  } catch {
    return null;
  }
}

function swapped(node: PathNode): PathNode {
  return { x: node.x, y: node.y, ...(node.out ? { in: node.out } : {}), ...(node.in ? { out: node.in } : {}) };
}

export function reverseSubpaths(subpaths: readonly Subpath[]): Subpath[] {
  return subpaths.map(({ closed, nodes }) => {
    const reversed = [...nodes].reverse().map(swapped);
    return { closed, nodes: closed ? [reversed[reversed.length - 1], ...reversed.slice(0, -1)] : reversed };
  });
}
