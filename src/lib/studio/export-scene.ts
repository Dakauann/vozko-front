import { lineMarkers, pathArrowheads, polygonPoints, strokedArrowEnds } from "./arrowheads";
import { parseColor, swatchOf } from "./color";
import type { BlendMode, CanvasSize, FillRule, Gradient, ImageSurface, Layer, LineCap, LineJoin } from "./document";
import { EXPORT_FALLBACK_BACKGROUND, visibleLayers } from "./image-edits";
import { clipRuns, gradientPaint, strokeStyle, type Box } from "./paint";
import { mapSubpaths, pathBounds, pathToSubpaths, type Subpath } from "./path-nodes";
import { pathOpsLayer } from "./path-ops";
import { repeatedLayers } from "./repeat-edits";
import { stillLooks } from "./still-vfx";
import { canvasSubpaths, unitToCanvas, vectorLayerOf } from "./vector-layer";
import type { Vfx } from "./vfx";
import type { Point } from "./viewport";

export interface ColorStop {
  offset: number;
  color: string;
  alpha: number;
}

export type ScenePaint =
  | { kind: "solid"; color: string; alpha: number }
  | { kind: "linear"; from: Point; to: Point; stops: ColorStop[] }
  | { kind: "radial"; center: Point; radius: number; stops: ColorStop[] };

export interface SceneStroke {
  color: string;
  alpha: number;
  width: number;
  cap: LineCap;
  join: LineJoin;
  miterLimit: number;
  dash: number[] | null;
  dashOffset: number;
}

export type PortableBlend = Exclude<BlendMode, "add">;

export interface VectorItem {
  kind: "vector";
  subpaths: Subpath[];
  fill: ScenePaint | null;
  fillRule: FillRule;
  stroke: SceneStroke | null;
  opacity: number;
  blend: PortableBlend;
}

export interface Backdrop {
  background?: string;
  gradient?: Gradient;
}

export interface RasterItem {
  kind: "raster";
  id: string;
  layerIds: string[];
  bounds: Box;
  blend: PortableBlend;
  backdrop?: Backdrop;
  vfx?: Vfx[];
}

export type SceneItem = VectorItem | RasterItem;

export interface ExportScene {
  width: number;
  height: number;
  background: ScenePaint | null;
  items: SceneItem[];
}

const MAX_PATCH_SIDE = 8192;
const MAX_PATCH_PIXELS = 4096 * 4096;

const VECTOR_KEYS: ReadonlySet<string> = new Set([
  "id",
  "type",
  "name",
  "transform",
  "hidden",
  "locked",
  "groupId",
  "fill",
  "stroke",
  "strokeWidth",
  "dash",
  "shape",
  "arrowStart",
  "arrowEnd",
  "arrowStartKind",
  "arrowEndKind",
  "blendMode",
  "gradient",
  "path",
  "fillRule",
  "lineCap",
  "lineJoin",
  "miterLimit",
  "dashArray",
  "dashOffset",
  "points",
  "inner",
  "radius",
]);

const REACH_KEYS: ReadonlySet<string> = new Set([
  ...VECTOR_KEYS,
  "assetId",
  "crop",
  "flipX",
  "flipY",
  "filters",
  "color",
  "chromaKey",
  "text",
  "fontId",
  "fontSize",
  "fontWeight",
  "italic",
  "align",
  "lineHeight",
  "letterSpacing",
  "runs",
  "shadow",
  "iconId",
  "clip",
  "highlight",
  "curve",
  "frame",
  "surface",
  "mask",
]);

const OVERHANG_SHARE = 0.25;
const MIN_OVERHANG_PX = 32;
const STROKE_REACH = 4;
const SHADOW_BLUR_REACH = 2;

function setKeys(layer: Layer): string[] {
  return Object.entries(layer)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
}

function solid(value: string | undefined): ScenePaint | null {
  const rgba = parseColor(value);
  const color = swatchOf(value);
  return rgba && color ? { kind: "solid", color, alpha: rgba.a } : null;
}

function stopsOf(gradient: Gradient): ColorStop[] | null {
  const colors = [gradient.from, ...(gradient.via ? [gradient.via] : []), gradient.to];
  const stops = colors.map((value, i) => {
    const paint = solid(value);
    return paint?.kind === "solid" ? { offset: colors.length === 1 ? 0 : i / (colors.length - 1), color: paint.color, alpha: paint.alpha } : null;
  });
  return stops.every((stop): stop is ColorStop => stop !== null) ? stops : null;
}

function gradientScene(gradient: Gradient, box: Box, place: (local: Point) => Point): ScenePaint | null {
  const stops = stopsOf(gradient);
  if (!stops) return null;
  const paint = gradientPaint(gradient, box);
  if (paint.kind === "radial") return { kind: "radial", center: place(paint.center), radius: paint.radius, stops };
  return { kind: "linear", from: place(paint.start), to: place(paint.end), stops };
}

function layerPlacer(layer: Layer, canvas: CanvasSize): { width: number; height: number; place: (local: Point) => Point } {
  const width = layer.transform.w * canvas.width;
  const height = layer.transform.h * canvas.height;
  return { width, height, place: (local) => unitToCanvas(layer.transform, canvas, { x: local.x / width, y: local.y / height }) };
}

function sceneStroke(layer: Layer, color: string | undefined): SceneStroke | null {
  const paint = solid(color);
  const width = layer.strokeWidth ?? 0;
  if (paint?.kind !== "solid" || width <= 0) return null;
  const style = strokeStyle(layer);
  return { color: paint.color, alpha: paint.alpha, width, cap: style.lineCap, join: style.lineJoin, miterLimit: style.miterLimit, dash: style.dash ?? null, dashOffset: style.dashOffset };
}

function portableBlend(mode: BlendMode | undefined): PortableBlend | null {
  const blend = mode ?? "normal";
  return blend === "add" ? null : blend;
}

function item(subpaths: Subpath[], layer: Layer, fill: ScenePaint | null, stroke: SceneStroke | null, blend: PortableBlend): VectorItem {
  return { kind: "vector", subpaths, fill, fillRule: layer.fillRule ?? "nonzero", stroke, opacity: layer.transform.opacity, blend };
}

function markItems(marks: readonly number[][], place: (point: Point) => Point, layer: Layer, ink: ScenePaint, blend: PortableBlend): VectorItem[] {
  return marks.map((flat) => item([{ closed: true, nodes: polygonPoints(flat).map(place) }], layer, ink, null, blend));
}

function lineVectors(layer: Layer, canvas: CanvasSize, blend: PortableBlend): VectorItem[] | null {
  const pointers = strokedArrowEnds(layer);
  if (pointers.start || pointers.end) return null;
  const { width, height, place } = layerPlacer(layer, canvas);
  const subpaths: Subpath[] = [{ closed: false, nodes: [place({ x: 0, y: height / 2 }), place({ x: width, y: height / 2 })] }];
  const body = item(subpaths, layer, null, sceneStroke(layer, layer.stroke || layer.fill), blend);
  const marks = lineMarkers(layer, width, height);
  if (marks.length === 0) return [body];
  const ink = solid(layer.stroke || layer.fill);
  return ink ? [body, ...markItems(marks, place, layer, ink, blend)] : null;
}

function shapeVectors(layer: Layer, canvas: CanvasSize, blend: PortableBlend): VectorItem[] | null {
  const vector = vectorLayerOf(layer, canvas);
  if (!vector) return null;
  const { width, height, place } = layerPlacer(layer, canvas);
  const fill = layer.gradient ? gradientScene(layer.gradient, { x: 0, y: 0, width, height }, place) : layer.fill ? solid(layer.fill) : null;
  if ((layer.gradient || layer.fill) && !fill) return null;
  if (layer.stroke && !solid(layer.stroke)) return null;
  const body = item(canvasSubpaths(vector, canvas), layer, fill, sceneStroke(layer, layer.stroke), blend);
  const ink = solid(layer.stroke || layer.fill);
  if (layer.shape !== "path" || !ink) return [body];
  return [body, ...markItems(pathArrowheads(layer, width, height), place, layer, ink, blend)];
}

export function layerVectors(layer: Layer, canvas: CanvasSize): VectorItem[] | null {
  const blend = portableBlend(layer.blendMode);
  if (layer.type !== "shape" || !blend) return null;
  if (layer.shape === "line" || layer.shape === "arrow") return lineVectors(layer, canvas, blend);
  return shapeVectors(layer, canvas, blend);
}

function vectorizable(layer: Layer): boolean {
  return layer.type === "shape" && setKeys(layer).every((key) => VECTOR_KEYS.has(key));
}

function clampBox(box: Box, canvas: CanvasSize): Box {
  const left = Math.max(0, Math.floor(box.x));
  const top = Math.max(0, Math.floor(box.y));
  const right = Math.min(canvas.width, Math.ceil(box.x + box.width));
  const bottom = Math.min(canvas.height, Math.ceil(box.y + box.height));
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function layerReach(layer: Layer, canvas: CanvasSize): Box | null {
  if (!setKeys(layer).every((key) => REACH_KEYS.has(key))) return null;
  const { width, height, place } = layerPlacer(layer, canvas);
  const drawn = layer.shape === "path" ? pathBounds(pathToSubpaths(layer.path ?? "")) : { left: 0, top: 0, right: 1, bottom: 1 };
  const x0 = Math.min(0, drawn.left) * width;
  const y0 = Math.min(0, drawn.top) * height;
  const x1 = Math.max(1, drawn.right) * width;
  const y1 = Math.max(1, drawn.bottom) * height;
  const corners = [place({ x: x0, y: y0 }), place({ x: x1, y: y0 }), place({ x: x1, y: y1 }), place({ x: x0, y: y1 })];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const shadow = layer.shadow ? Math.abs(layer.shadow.x) + Math.abs(layer.shadow.y) + layer.shadow.blur * SHADOW_BLUR_REACH : 0;
  const pad = Math.max(MIN_OVERHANG_PX, Math.max(width, height) * OVERHANG_SHARE) + (layer.strokeWidth ?? 0) * STROKE_REACH + shadow;
  const left = Math.min(...xs) - pad;
  const top = Math.min(...ys) - pad;
  return { x: left, y: top, width: Math.max(...xs) + pad - left, height: Math.max(...ys) + pad - top };
}

function runBounds(run: readonly Layer[], canvas: CanvasSize): Box {
  const reaches = run.map((layer) => layerReach(layer, canvas));
  if (reaches.some((reach) => reach === null)) return { x: 0, y: 0, width: canvas.width, height: canvas.height };
  const boxes = reaches as Box[];
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return clampBox({ x: left, y: top, width: right - left, height: bottom - top }, canvas);
}

function backgroundOf(surface: ImageSurface, transparent: boolean): ScenePaint | null {
  const { canvas } = surface;
  if (canvas.gradient) return gradientScene(canvas.gradient, { x: 0, y: 0, width: canvas.width, height: canvas.height }, (p) => p);
  if (canvas.background) return solid(canvas.background);
  return transparent ? null : solid(EXPORT_FALLBACK_BACKGROUND);
}

function flattened(surface: ImageSurface, runs: readonly Layer[][], transparent: boolean): ExportScene {
  const { canvas } = surface;
  const background = canvas.background || (transparent || canvas.gradient ? undefined : EXPORT_FALLBACK_BACKGROUND);
  const backdrop: Backdrop = { ...(background ? { background } : {}), ...(canvas.gradient ? { gradient: canvas.gradient } : {}) };
  const adjusts = stillLooks(canvas.vfx).length > 0;
  const item: RasterItem = { kind: "raster", id: "r0", layerIds: runs.flat().map((layer) => layer.id), bounds: { x: 0, y: 0, width: canvas.width, height: canvas.height }, blend: "normal", backdrop, ...(adjusts ? { vfx: canvas.vfx } : {}) };
  return { width: canvas.width, height: canvas.height, background: null, items: [item] };
}

export function exportScene(surface: ImageSurface, options: { transparent: boolean }): ExportScene {
  const { canvas } = surface;
  const runs = clipRuns(visibleLayers(repeatedLayers(surface).map((layer) => pathOpsLayer(layer, canvas))));
  if (stillLooks(canvas.vfx).length > 0 || runs.some((run) => !portableBlend(run[0].blendMode))) return flattened(surface, runs, options.transparent);
  const items: SceneItem[] = [];
  for (const run of runs) {
    const base = run[0];
    const blend = portableBlend(base.blendMode) ?? "normal";
    const vectors = run.length === 1 && vectorizable(base) ? layerVectors(base, canvas) : null;
    if (vectors) {
      items.push(...vectors);
      continue;
    }
    const bounds = runBounds(run, canvas);
    if (bounds.width > 0 && bounds.height > 0) items.push({ kind: "raster", id: `r${items.length}`, layerIds: run.map((layer) => layer.id), bounds, blend });
  }
  return { width: canvas.width, height: canvas.height, background: backgroundOf(surface, options.transparent), items };
}

export function rasterLayerCount(scene: ExportScene): number {
  return scene.items.reduce((sum, entry) => sum + (entry.kind === "raster" ? entry.layerIds.length : 0), 0);
}

export function withoutRaster(scene: ExportScene, id: string): ExportScene {
  return { ...scene, items: scene.items.filter((entry) => entry.kind !== "raster" || entry.id !== id) };
}

export function patchRatio(bounds: Box, wanted: number): number {
  const side = MAX_PATCH_SIDE / Math.max(bounds.width, bounds.height, 1);
  const area = Math.sqrt(MAX_PATCH_PIXELS / Math.max(bounds.width * bounds.height, 1));
  return Math.min(wanted, side, area);
}

export function alphaBounds(data: ArrayLike<number>, width: number, height: number): Box | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

export function isOpaque(data: ArrayLike<number>): boolean {
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) return false;
  return true;
}

export function roundedSubpaths(subpaths: readonly Subpath[], decimals: number): Subpath[] {
  const scale = 10 ** decimals;
  return mapSubpaths(subpaths, (p) => ({ x: Math.round(p.x * scale) / scale || 0, y: Math.round(p.y * scale) / scale || 0 }));
}

