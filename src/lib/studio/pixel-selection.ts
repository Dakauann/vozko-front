import type { CanvasSize } from "./document";
import { surfaceScale, toSurface, type PixelFrame } from "./pixel-space";
import { clipRect, PIXEL_RANGES, snapPixel, SUBTRACT, type AreaOp, type AreaPart, type PixelMode, type PixelRect } from "./pixel-surface";
import type { Point } from "./viewport";

export const SELECTION_TOOLS = ["rect", "ellipse", "lasso"] as const;

export type SelectionTool = (typeof SELECTION_TOOLS)[number];
export type SelectionMode = "add" | "subtract";
export type SelectionCombine = SelectionMode | "replace";

export interface SelectionPart {
  mode: SelectionMode;
  points: number[];
}

export interface PixelSelection {
  artboardId: string;
  parts: SelectionPart[];
  feather: number;
  invert: boolean;
}

export interface AreaInk {
  mode: PixelMode;
  color?: string;
  opacity: number;
}

const ELLIPSE_MIN_SEGMENTS = 24;
const ELLIPSE_SEGMENT_PX = 3;
const CLIP_SLACK = 2;
const FEATHER_REACH = 1.5;

export function rectPoints(a: Point, b: Point): number[] {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x, b.x);
  const bottom = Math.max(a.y, b.y);
  return [left, top, right, top, right, bottom, left, bottom];
}

export function ellipsePoints(a: Point, b: Point): number[] {
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const perimeter = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  const count = Math.ceil(Math.max(ELLIPSE_MIN_SEGMENTS, perimeter / ELLIPSE_SEGMENT_PX) / 4) * 4;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
  }).flat();
}

export function combineSelection(current: PixelSelection | null, artboardId: string, points: number[], combine: SelectionCombine): PixelSelection {
  const keep = current && current.artboardId === artboardId && combine !== "replace";
  const mode: SelectionMode = combine === "subtract" ? "subtract" : "add";
  return { artboardId, parts: [...(keep ? current.parts : []), { mode, points }], feather: current?.feather ?? 0, invert: keep ? current.invert : false };
}

export function invertSelection(selection: PixelSelection): PixelSelection {
  return { ...selection, invert: !selection.invert };
}

function boundsOf(points: readonly number[]): PixelRect {
  const xs = points.filter((_, i) => i % 2 === 0);
  const ys = points.filter((_, i) => i % 2 === 1);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function selectionBounds(selection: PixelSelection, canvas: CanvasSize): PixelRect | null {
  if (selection.invert) return { x: 0, y: 0, width: canvas.width, height: canvas.height };
  const adds = selection.parts.filter((part) => part.mode === "add" && part.points.length >= 6);
  if (adds.length === 0) return null;
  const all = boundsOf(adds.flatMap((part) => part.points));
  return clipRect(all, canvas.width, canvas.height);
}

function clipAgainst(points: readonly number[], inside: (x: number, y: number) => boolean, cross: (ax: number, ay: number, bx: number, by: number) => [number, number]): number[] {
  const out: number[] = [];
  const count = points.length / 2;
  for (let i = 0; i < count; i++) {
    const [ax, ay] = [points[i * 2], points[i * 2 + 1]];
    const j = (i + 1) % count;
    const [bx, by] = [points[j * 2], points[j * 2 + 1]];
    const aIn = inside(ax, ay);
    const bIn = inside(bx, by);
    if (aIn) out.push(ax, ay);
    if (aIn !== bIn) out.push(...cross(ax, ay, bx, by));
  }
  return out;
}

function clipPolygon(points: readonly number[], box: PixelRect): number[] {
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  const atX = (edge: number) => (ax: number, ay: number, bx: number, by: number): [number, number] => [edge, ay + ((by - ay) * (edge - ax)) / (bx - ax)];
  const atY = (edge: number) => (ax: number, ay: number, bx: number, by: number): [number, number] => [ax + ((bx - ax) * (edge - ay)) / (by - ay), edge];
  let out = clipAgainst(points, (x) => x >= box.x, atX(box.x));
  out = out.length >= 6 ? clipAgainst(out, (x) => x <= right, atX(right)) : [];
  out = out.length >= 6 ? clipAgainst(out, (_, y) => y >= box.y, atY(box.y)) : [];
  return out.length >= 6 ? clipAgainst(out, (_, y) => y <= bottom, atY(bottom)) : [];
}

export function selectionArea(selection: PixelSelection, frame: PixelFrame, ink: AreaInk, id: string): AreaOp | null {
  const feather = Math.min(PIXEL_RANGES.feather[1], snapPixel(selection.feather * surfaceScale(frame)));
  const pad = Math.ceil(feather * FEATHER_REACH) + CLIP_SLACK;
  const box = { x: -pad, y: -pad, width: frame.surface.width + 2 * pad, height: frame.surface.height + 2 * pad };
  const parts: AreaPart[] = [];
  for (const part of selection.parts) {
    const mapped: number[] = [];
    for (let i = 0; i + 1 < part.points.length; i += 2) {
      const point = toSurface(frame, { x: part.points[i], y: part.points[i + 1] });
      mapped.push(point.x, point.y);
    }
    const clipped = clipPolygon(mapped, box).map((value) => snapPixel(value) || 0);
    if (clipped.length < 6) continue;
    if (part.mode === "subtract" && parts.length === 0) continue;
    parts.push(part.mode === "subtract" ? { mode: SUBTRACT, points: clipped } : { points: clipped });
  }
  const whole = { points: [0, 0, frame.surface.width, 0, frame.surface.width, frame.surface.height, 0, frame.surface.height] };
  if (parts.length === 0 && !selection.invert) return null;
  return {
    kind: "area",
    id,
    mode: ink.mode,
    ...(ink.color ? { color: ink.color } : {}),
    opacity: ink.opacity,
    feather,
    ...(selection.invert && parts.length > 0 ? { invert: true } : {}),
    parts: parts.length > 0 ? parts : [whole],
  };
}
