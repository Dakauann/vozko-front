import { fullFrame, newStudioId, type CanvasSize, type Layer, type Transform } from "./document";
import { isValidToken } from "./tokens";
import type { IssueCode } from "./validate";

const PAINT_MODES = ["paint", "erase"] as const;
const MASK_MODES = ["hide", "reveal"] as const;

export type PaintMode = (typeof PAINT_MODES)[number];
export type MaskMode = (typeof MASK_MODES)[number];
export type PixelMode = PaintMode | MaskMode;
export type SurfaceKind = "paint" | "mask";

export interface StrokeOp {
  kind: "stroke";
  id: string;
  mode: PixelMode;
  color?: string;
  size: number;
  hardness: number;
  opacity: number;
  pressure?: boolean;
  points: number[];
}

export interface AreaPart {
  mode?: "subtract";
  points: number[];
}

export interface AreaOp {
  kind: "area";
  id: string;
  mode: PixelMode;
  color?: string;
  opacity: number;
  feather: number;
  invert?: boolean;
  parts: AreaPart[];
}

export type PixelOp = StrokeOp | AreaOp;

export interface PixelSurface {
  width: number;
  height: number;
  ops: PixelOp[];
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PIXEL_RANGES = {
  side: [1, 4096],
  size: [1, 1000],
  hardness: [0, 1],
  opacity: [0, 1],
  feather: [0, 250],
  pressure: [0, 1],
} as const;

const PIXEL_REACH = 8192;
export const PIXEL_INPUT_MARGIN = 4096;
const PIXEL_STEP = 0.25;
export const SUBTRACT = "subtract";

const MODES: Record<SurfaceKind, readonly PixelMode[]> = { paint: PAINT_MODES, mask: MASK_MODES };
const COLOR = /^#[0-9a-fA-F]{6}$/;
const PAINT_LAYER_FIELDS: ReadonlySet<string> = new Set(["id", "type", "name", "transform", "hidden", "locked", "groupId", "flipX", "flipY", "blendMode", "clip", "surface"]);
const STROKE_ONLY = ["size", "hardness", "pressure", "points"] as const;
const AREA_ONLY = ["feather", "invert", "parts"] as const;

function within(value: number, [lo, hi]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= lo && value <= hi;
}

function set(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== "" && value !== 0 && value !== false;
}

function sideIssue(side: number): IssueCode | null {
  return Number.isInteger(side) && within(side, PIXEL_RANGES.side) ? null : "out_of_range";
}

function pointsIssue(points: readonly number[], stride: number, surface: PixelSurface): IssueCode | null {
  for (let i = 0; i < points.length; i += stride) {
    if (!within(points[i], [-PIXEL_REACH, surface.width + PIXEL_REACH]) || !within(points[i + 1], [-PIXEL_REACH, surface.height + PIXEL_REACH])) return "out_of_range";
    if (stride === 3 && !within(points[i + 2], PIXEL_RANGES.pressure)) return "out_of_range";
  }
  return null;
}

function inkIssue(op: PixelOp, kind: SurfaceKind): IssueCode | null {
  if (!MODES[kind].includes(op.mode)) return "unknown";
  const color = op.color ?? "";
  if ((op.mode === "paint") !== (color !== "")) return "invalid";
  if (color !== "" && !COLOR.test(color)) return "invalid";
  return op.opacity > 0 && within(op.opacity, PIXEL_RANGES.opacity) ? null : "out_of_range";
}

function strokeIssue(op: StrokeOp, surface: PixelSurface): IssueCode | null {
  if (AREA_ONLY.some((field) => set((op as unknown as Record<string, unknown>)[field]))) return "invalid";
  if (!within(op.size, PIXEL_RANGES.size) || !within(op.hardness, PIXEL_RANGES.hardness)) return "out_of_range";
  const stride = op.pressure ? 3 : 2;
  if (op.points.length < stride || op.points.length % stride !== 0) return "invalid";
  return pointsIssue(op.points, stride, surface);
}

function areaIssue(op: AreaOp, surface: PixelSurface): IssueCode | null {
  if (STROKE_ONLY.some((field) => set((op as unknown as Record<string, unknown>)[field]))) return "invalid";
  if (!within(op.feather, PIXEL_RANGES.feather)) return "out_of_range";
  if (op.parts.length === 0 || (op.parts[0].mode ?? "") !== "") return "invalid";
  for (const part of op.parts) {
    if ((part.mode ?? "") !== "" && part.mode !== SUBTRACT) return "unknown";
    if (part.points.length < 6 || part.points.length % 2 !== 0) return "invalid";
    const code = pointsIssue(part.points, 2, surface);
    if (code) return code;
  }
  return null;
}

function pixelOpIssue(op: PixelOp, kind: SurfaceKind, surface: PixelSurface): IssueCode | null {
  if (!isValidToken(op.id)) return "invalid";
  if (op.kind !== "stroke" && op.kind !== "area") return "unknown";
  return inkIssue(op, kind) ?? (op.kind === "stroke" ? strokeIssue(op, surface) : areaIssue(op, surface));
}

export function pixelSurfaceIssue(surface: PixelSurface, kind: SurfaceKind): IssueCode | null {
  const side = sideIssue(surface.width) ?? sideIssue(surface.height);
  if (side) return side;
  const seen = new Set<string>();
  for (const op of surface.ops) {
    const code = pixelOpIssue(op, kind, surface);
    if (code) return code;
    if (seen.has(op.id)) return "duplicate";
    seen.add(op.id);
  }
  return null;
}

export function pixelLayerIssue(layer: Layer): IssueCode | null {
  if (layer.type === "paint") {
    if (!layer.surface) return "required";
    if (Object.entries(layer).some(([key, value]) => !PAINT_LAYER_FIELDS.has(key) && set(value))) return "invalid";
    return pixelSurfaceIssue(layer.surface, "paint");
  }
  if (layer.surface) return "invalid";
  if (!layer.mask) return null;
  return layer.type === "image" ? pixelSurfaceIssue(layer.mask, "mask") : "invalid";
}

export function carriesPixels(layer: Layer): boolean {
  return layer.type === "paint" || layer.mask !== undefined || layer.surface !== undefined;
}

export function surfaceSizeFor(widthPx: number, heightPx: number): CanvasSize {
  const [, max] = PIXEL_RANGES.side;
  const fit = Math.min(1, max / Math.max(widthPx, heightPx, 1));
  const side = (value: number) => Math.min(max, Math.max(1, Math.round(value * fit)));
  return { width: side(widthPx), height: side(heightPx) };
}

export function newPaintLayer(canvas: CanvasSize, transform: Transform = fullFrame()): Layer {
  return { id: newStudioId("l"), type: "paint", transform, surface: { ...surfaceSizeFor(transform.w * canvas.width, transform.h * canvas.height), ops: [] } };
}

export function maskSurfaceSize(layer: Layer, canvas: CanvasSize): CanvasSize {
  const crop = layer.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  return surfaceSizeFor((layer.transform.w * canvas.width) / crop.w, (layer.transform.h * canvas.height) / crop.h);
}

export function emptyMask(layer: Layer, canvas: CanvasSize): PixelSurface {
  return { ...maskSurfaceSize(layer, canvas), ops: [] };
}

export function surfaceOf(layer: Layer, kind: SurfaceKind): PixelSurface | undefined {
  return kind === "paint" ? layer.surface : layer.mask;
}

export function newPixelOpId(): string {
  return newStudioId("p");
}

export function snapPixel(value: number): number {
  return Math.round(value / PIXEL_STEP) * PIXEL_STEP;
}

export function addsInk(op: PixelOp): boolean {
  return op.mode === "paint" || op.mode === "hide";
}

function pointBounds(points: readonly number[], stride: number, pad: number): PixelRect | null {
  if (points.length < 2) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (let i = 0; i + 1 < points.length; i += stride) {
    left = Math.min(left, points[i]);
    right = Math.max(right, points[i]);
    top = Math.min(top, points[i + 1]);
    bottom = Math.max(bottom, points[i + 1]);
  }
  return { x: left - pad, y: top - pad, width: right - left + 2 * pad, height: bottom - top + 2 * pad };
}

export function unionRect(a: PixelRect | null, b: PixelRect | null): PixelRect | null {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}

export function clipRect(rect: PixelRect, width: number, height: number): PixelRect | null {
  const x = Math.max(0, rect.x);
  const y = Math.max(0, rect.y);
  const right = Math.min(width, rect.x + rect.width);
  const bottom = Math.min(height, rect.y + rect.height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

export function opReach(op: PixelOp, surface: Pick<PixelSurface, "width" | "height">): PixelRect | null {
  if (op.kind === "stroke") return pointBounds(op.points, op.pressure ? 3 : 2, op.size / 2);
  if (op.invert) return { x: 0, y: 0, width: surface.width, height: surface.height };
  return op.parts.filter((part) => part.mode !== SUBTRACT).reduce<PixelRect | null>((acc, part) => unionRect(acc, pointBounds(part.points, 2, op.feather)), null);
}

export function paintedBounds(surface: PixelSurface): PixelRect | null {
  const reach = surface.ops.filter(addsInk).reduce<PixelRect | null>((acc, op) => unionRect(acc, opReach(op, surface)), null);
  return reach ? clipRect(reach, surface.width, surface.height) : null;
}

export interface PixelLive {
  layerId: string;
  kind: SurfaceKind;
  op: StrokeOp;
}

export function liveOpFor(live: PixelLive | null | undefined, layerId: string, kind: SurfaceKind): StrokeOp | null {
  return live && live.layerId === layerId && live.kind === kind ? live.op : null;
}
