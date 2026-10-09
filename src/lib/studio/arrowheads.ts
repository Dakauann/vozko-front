import type { Layer } from "./document";
import { pathToSubpaths, type PathNode, type Subpath } from "./path-nodes";
import type { Point } from "./viewport";

const MIN_ARROWHEAD = 6;
const ARROWHEAD_PER_STROKE = 3;

export function arrowheadSize(strokeWidth: number): number {
  return Math.max(strokeWidth * ARROWHEAD_PER_STROKE, MIN_ARROWHEAD);
}

export function hasOpenEnds(path: string): boolean {
  return pathToSubpaths(path).some((subpath) => !subpath.closed && subpath.nodes.length > 1);
}

function differs(a: Point, b: Point): boolean {
  return a.x !== b.x || a.y !== b.y;
}

function leaving(end: PathNode, handle: Point | undefined, neighbour: PathNode, neighbourHandle: Point | undefined): Point | null {
  const control = [handle, neighbourHandle, neighbour].find((point): point is Point => point !== undefined && differs(point, end));
  if (!control) return null;
  const dx = end.x - control.x;
  const dy = end.y - control.y;
  const length = Math.hypot(dx, dy);
  return { x: dx / length, y: dy / length };
}

function triangle(base: Point, direction: Point, size: number): number[] {
  const half = size / 2;
  const side = { x: -direction.y * half, y: direction.x * half };
  return [base.x + side.x, base.y + side.y, base.x + direction.x * size, base.y + direction.y * size, base.x - side.x, base.y - side.y];
}

function scaled(subpath: Subpath, width: number, height: number): PathNode[] {
  const scale = (p: Point): Point => ({ x: p.x * width, y: p.y * height });
  return subpath.nodes.map((node) => ({ ...scale(node), in: node.in && scale(node.in), out: node.out && scale(node.out) }));
}

export function pathArrowheads(layer: Pick<Layer, "path" | "arrowStart" | "arrowEnd" | "strokeWidth">, width: number, height: number): number[][] {
  const strokeWidth = layer.strokeWidth ?? 0;
  if (strokeWidth <= 0 || (!layer.arrowStart && !layer.arrowEnd)) return [];
  const size = arrowheadSize(strokeWidth);
  const heads: number[][] = [];
  for (const subpath of pathToSubpaths(layer.path ?? "")) {
    if (subpath.closed || subpath.nodes.length < 2) continue;
    const nodes = scaled(subpath, width, height);
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const start = layer.arrowStart ? leaving(first, first.out, nodes[1], nodes[1].in) : null;
    const end = layer.arrowEnd ? leaving(last, last.in, nodes[nodes.length - 2], nodes[nodes.length - 2].out) : null;
    if (start) heads.push(triangle(first, start, size));
    if (end) heads.push(triangle(last, end, size));
  }
  return heads;
}

export function takesArrowheads(layer: Pick<Layer, "type" | "shape" | "path">): boolean {
  if (layer.type !== "shape") return false;
  if (layer.shape === "line" || layer.shape === "arrow") return true;
  return layer.shape === "path" && hasOpenEnds(layer.path ?? "");
}

export function lineArrowheads(layer: Pick<Layer, "arrowStart" | "arrowEnd" | "strokeWidth">, width: number, height: number): number[][] {
  const strokeWidth = layer.strokeWidth ?? 0;
  if (strokeWidth <= 0) return [];
  const size = arrowheadSize(strokeWidth);
  const middle = height / 2;
  const heads: number[][] = [];
  if (layer.arrowStart) heads.push(triangle({ x: size, y: middle }, { x: -1, y: 0 }, size));
  if (layer.arrowEnd) heads.push(triangle({ x: width - size, y: middle }, { x: 1, y: 0 }, size));
  return heads;
}

export function layerArrowheads(layer: Pick<Layer, "type" | "shape" | "path" | "arrowStart" | "arrowEnd" | "strokeWidth">, width: number, height: number): number[][] {
  if (layer.type !== "shape") return [];
  if (layer.shape === "line" || layer.shape === "arrow") return lineArrowheads(layer, width, height);
  return layer.shape === "path" ? pathArrowheads(layer, width, height) : [];
}
