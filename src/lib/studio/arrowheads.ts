import { LINE_END_KINDS, type Layer, type LineEndKind } from "./document";
import { pathToSubpaths, type PathNode, type Subpath } from "./path-nodes";
import type { Point } from "./viewport";

const MIN_ARROWHEAD = 6;
const ARROWHEAD_PER_STROKE = 3;
const DOT_SEGMENTS = 32;
const ROUND_SEGMENTS = 16;
const OPEN_ARROW_SPREAD = Math.atan(0.5);

export type LineEnd = "start" | "end";

type Ends = Pick<Layer, "arrowStart" | "arrowEnd" | "arrowStartKind" | "arrowEndKind">;

export function arrowheadSize(strokeWidth: number): number {
  return Math.max(strokeWidth * ARROWHEAD_PER_STROKE, MIN_ARROWHEAD);
}

export function hasOpenEnds(path: string): boolean {
  return pathToSubpaths(path).some((subpath) => !subpath.closed && subpath.nodes.length > 1);
}

export function endKind(layer: Ends, end: LineEnd): LineEndKind | null {
  const on = end === "start" ? layer.arrowStart : layer.arrowEnd;
  if (!on) return null;
  return (end === "start" ? layer.arrowStartKind : layer.arrowEndKind) ?? "arrow";
}

export const LINE_END_CHOICES = ["none", ...LINE_END_KINDS] as const;

type LineEndChoice = (typeof LINE_END_CHOICES)[number];

export function endChoice(layer: Ends, end: LineEnd): LineEndChoice {
  return endKind(layer, end) ?? "none";
}

export function endPatch(end: LineEnd, choice: LineEndChoice): Ends {
  const kind = choice === "none" || choice === "arrow" ? undefined : choice;
  const on = choice === "none" ? undefined : true;
  return end === "start" ? { arrowStart: on, arrowStartKind: kind } : { arrowEnd: on, arrowEndKind: kind };
}

function isLine(layer: Pick<Layer, "shape">): boolean {
  return layer.shape === "line" || layer.shape === "arrow";
}

export function strokedArrowEnds(layer: Pick<Layer, "type" | "shape"> & Ends): Record<LineEnd, boolean> {
  const line = layer.type === "shape" && isLine(layer);
  return { start: line && endKind(layer, "start") === "arrow", end: line && endKind(layer, "end") === "arrow" };
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

export function headTriangle(base: Point, direction: Point, size: number): number[] {
  const half = size / 2;
  const side = { x: -direction.y * half, y: direction.x * half };
  return [base.x + side.x, base.y + side.y, base.x + direction.x * size, base.y + direction.y * size, base.x - side.x, base.y - side.y];
}

function placer(tip: Point, direction: Point): (along: number, across: number) => [number, number] {
  return (along, across) => [tip.x + direction.x * along - direction.y * across, tip.y + direction.y * along + direction.x * across];
}

function ring(place: ReturnType<typeof placer>, radius: number, from: number, to: number, segments: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= segments; i++) {
    if (i === segments && to - from >= Math.PI * 2) break;
    const angle = from + ((to - from) * i) / segments;
    out.push(...place(radius * Math.cos(angle), radius * Math.sin(angle)));
  }
  return out;
}

function openArrow(place: ReturnType<typeof placer>, size: number, half: number): number[] {
  const sin = Math.sin(OPEN_ARROW_SPREAD);
  const cos = Math.cos(OPEN_ARROW_SPREAD);
  const reach = half / sin;
  return [
    ...place(-size + half * sin, size / 2 + half * cos),
    ...place(reach, 0),
    ...place(-size + half * sin, -size / 2 - half * cos),
    ...place(-size - half * sin, -size / 2 + half * cos),
    ...place(-reach, 0),
    ...place(-size - half * sin, size / 2 - half * cos),
  ];
}

export function endMark(kind: LineEndKind, tip: Point, direction: Point, strokeWidth: number): number[] {
  const size = arrowheadSize(strokeWidth);
  const half = strokeWidth / 2;
  const radius = size / 2;
  const place = placer(tip, direction);
  switch (kind) {
    case "arrow":
      return headTriangle(tip, direction, size);
    case "openArrow":
      return openArrow(place, size, half);
    case "round":
      return ring(place, half, -Math.PI / 2, Math.PI / 2, ROUND_SEGMENTS);
    case "dot":
      return ring(place, radius, 0, Math.PI * 2, DOT_SEGMENTS);
    case "square":
      return [...place(-radius, radius), ...place(radius, radius), ...place(radius, -radius), ...place(-radius, -radius)];
    case "bar":
      return [...place(-half, radius), ...place(half, radius), ...place(half, -radius), ...place(-half, -radius)];
    case "diamond":
      return [...place(-radius, 0), ...place(0, radius), ...place(radius, 0), ...place(0, -radius)];
  }
}

function scaled(subpath: Subpath, width: number, height: number): PathNode[] {
  const scale = (p: Point): Point => ({ x: p.x * width, y: p.y * height });
  return subpath.nodes.map((node) => ({ ...scale(node), in: node.in && scale(node.in), out: node.out && scale(node.out) }));
}

type PathHeads = Pick<Layer, "path" | "strokeWidth"> & Ends;

export function pathArrowheads(layer: PathHeads, width: number, height: number): number[][] {
  const strokeWidth = layer.strokeWidth ?? 0;
  const startKind = endKind(layer, "start");
  const finishKind = endKind(layer, "end");
  if (strokeWidth <= 0 || (!startKind && !finishKind)) return [];
  const heads: number[][] = [];
  for (const subpath of pathToSubpaths(layer.path ?? "")) {
    if (subpath.closed || subpath.nodes.length < 2) continue;
    const nodes = scaled(subpath, width, height);
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const start = startKind ? leaving(first, first.out, nodes[1], nodes[1].in) : null;
    const end = finishKind ? leaving(last, last.in, nodes[nodes.length - 2], nodes[nodes.length - 2].out) : null;
    if (start && startKind) heads.push(endMark(startKind, first, start, strokeWidth));
    if (end && finishKind) heads.push(endMark(finishKind, last, end, strokeWidth));
  }
  return heads;
}

export function takesArrowheads(layer: Pick<Layer, "type" | "shape" | "path">): boolean {
  if (layer.type !== "shape") return false;
  if (isLine(layer)) return true;
  return layer.shape === "path" && hasOpenEnds(layer.path ?? "");
}

function lineEnd(kind: LineEndKind, tip: Point, direction: Point, strokeWidth: number): number[] {
  if (kind !== "arrow") return endMark(kind, tip, direction, strokeWidth);
  const size = arrowheadSize(strokeWidth);
  return headTriangle({ x: tip.x - direction.x * size, y: tip.y - direction.y * size }, direction, size);
}

function lineArrowheads(layer: Pick<Layer, "strokeWidth"> & Ends, width: number, height: number): number[][] {
  const strokeWidth = layer.strokeWidth ?? 0;
  if (strokeWidth <= 0) return [];
  const middle = height / 2;
  const heads: number[][] = [];
  const startKind = endKind(layer, "start");
  const finishKind = endKind(layer, "end");
  if (startKind) heads.push(lineEnd(startKind, { x: 0, y: middle }, { x: -1, y: 0 }, strokeWidth));
  if (finishKind) heads.push(lineEnd(finishKind, { x: width, y: middle }, { x: 1, y: 0 }, strokeWidth));
  return heads;
}

export function lineMarkers(layer: Pick<Layer, "strokeWidth"> & Ends, width: number, height: number): number[][] {
  const strokeWidth = layer.strokeWidth ?? 0;
  if (strokeWidth <= 0) return [];
  const middle = height / 2;
  const marks: number[][] = [];
  const startKind = endKind(layer, "start");
  const finishKind = endKind(layer, "end");
  if (startKind && startKind !== "arrow") marks.push(endMark(startKind, { x: 0, y: middle }, { x: -1, y: 0 }, strokeWidth));
  if (finishKind && finishKind !== "arrow") marks.push(endMark(finishKind, { x: width, y: middle }, { x: 1, y: 0 }, strokeWidth));
  return marks;
}

export function layerArrowheads(layer: Pick<Layer, "type" | "shape" | "path" | "strokeWidth"> & Ends, width: number, height: number): number[][] {
  if (layer.type !== "shape") return [];
  if (isLine(layer)) return lineArrowheads(layer, width, height);
  return layer.shape === "path" ? pathArrowheads(layer, width, height) : [];
}

export function polygonPoints(flat: readonly number[]): Point[] {
  const points: Point[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) points.push({ x: flat[i], y: flat[i + 1] });
  return points;
}
