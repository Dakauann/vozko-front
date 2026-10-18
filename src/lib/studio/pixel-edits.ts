import { applyCropBox, cropFrame, rotate } from "./crop";
import { fullFrame, type CanvasSize, type ImageSurface, type Layer, type Transform } from "./document";
import { addLayers, addLayersAbove, duplicateLayers, layerById, updateLayers } from "./layers";
import { clampTo, LAYER_RANGES } from "./layer-ranges";
import { fromSurface, pixelFrame, toSurface, type PixelFrame } from "./pixel-space";
import { selectionArea, type PixelSelection } from "./pixel-selection";
import {
  clipRect,
  emptyMask,
  newPaintLayer,
  newPixelOpId,
  opReach,
  type PixelMode,
  type PixelOp,
  type PixelRect,
  type PixelSurface,
  type SurfaceKind,
} from "./pixel-surface";
import { layerIssue } from "./validate";

export const PIXEL_ACTIONS = ["fill", "erase", "hide", "reveal"] as const;

export type PixelAction = (typeof PIXEL_ACTIONS)[number];

interface PixelInk {
  color?: string;
  opacity: number;
}

export type PixelEditIssue = "missing" | "locked" | "no_pixels" | "not_image" | "color" | "empty" | "invalid";

export type PixelEdit = { ok: true; document: ImageSurface; layerId: string; created?: string } | { ok: false; issue: PixelEditIssue };

interface Target {
  kind: SurfaceKind;
  mode: PixelMode;
}

function fail(issue: PixelEditIssue): PixelEdit {
  return { ok: false, issue };
}

export function addPaintLayer(doc: ImageSurface, options: { aboveId?: string; name?: string; transform?: Transform } = {}): { document: ImageSurface; id: string } {
  const created: Layer = { ...newPaintLayer(doc.canvas, options.transform ?? fullFrame()), ...(options.name ? { name: options.name } : {}) };
  const document = options.aboveId ? addLayersAbove(doc, [created], options.aboveId) : addLayers(doc, [created]);
  return { document, id: created.id };
}

function withOp(surface: PixelSurface | undefined, fallback: () => PixelSurface, op: PixelOp): PixelSurface {
  const base = surface ?? fallback();
  return { ...base, ops: [...base.ops, op] };
}

export function appendPixelOp(doc: ImageSurface, layerId: string, kind: SurfaceKind, op: PixelOp, canvas: CanvasSize = doc.canvas): ImageSurface {
  return updateLayers(doc, [layerId], (layer) =>
    kind === "paint" ? { surface: withOp(layer.surface, () => ({ width: 1, height: 1, ops: [] }), op) } : { mask: withOp(layer.mask, () => emptyMask(layer, canvas), op) },
  );
}

export function clearMask(doc: ImageSurface, layerId: string): ImageSurface {
  return updateLayers(doc, [layerId], { mask: undefined });
}

function targetOf(layer: Layer, action: PixelAction): Target | PixelEditIssue {
  if (layer.type === "paint") {
    if (action === "fill") return { kind: "paint", mode: "paint" };
    return action === "erase" ? { kind: "paint", mode: "erase" } : "not_image";
  }
  if (layer.type !== "image") return "no_pixels";
  if (action === "reveal") return { kind: "mask", mode: "reveal" };
  return { kind: "mask", mode: "hide" };
}

function usable(doc: ImageSurface, layerId: string): Layer | PixelEditIssue {
  const layer = layerById(doc, layerId);
  if (!layer) return "missing";
  return layer.locked ? "locked" : layer;
}

function checked(document: ImageSurface, layerId: string, created?: string): PixelEdit {
  const layer = layerById(document, layerId);
  if (!layer || layerIssue(layer)) return fail("invalid");
  return { ok: true, document, layerId, ...(created ? { created } : {}) };
}

function paintOn(doc: ImageSurface, layer: Layer, target: Target, selection: PixelSelection, ink: PixelInk, canvas: CanvasSize): PixelEdit {
  const frame = pixelFrame(layer, canvas, target.kind);
  if (!frame) return fail("no_pixels");
  const area = selectionArea(selection, frame, { mode: target.mode, ...(target.mode === "paint" ? { color: ink.color } : {}), opacity: ink.opacity }, newPixelOpId());
  if (!area) return fail("empty");
  return checked(appendPixelOp(doc, layer.id, target.kind, area, canvas), layer.id);
}

export function paintSelection(doc: ImageSurface, layerId: string, selection: PixelSelection, action: PixelAction, ink: PixelInk, canvas: CanvasSize = doc.canvas): PixelEdit {
  const layer = usable(doc, layerId);
  if (typeof layer === "string") return fail(layer);
  if (action === "fill" && !ink.color) return fail("color");
  if (action === "fill" && layer.type !== "paint") {
    const added = addPaintLayer(doc, { aboveId: layer.id });
    const filled = paintOn(added.document, layerById(added.document, added.id)!, { kind: "paint", mode: "paint" }, selection, ink, canvas);
    return filled.ok ? { ...filled, created: added.id } : filled;
  }
  const target = targetOf(layer, action);
  if (typeof target === "string") return fail(target);
  return paintOn(doc, layer, target, selection, ink, canvas);
}

function selectionPoints(selection: PixelSelection): { x: number; y: number }[] {
  return selection.parts.filter((part) => part.mode === "add").flatMap((part) => Array.from({ length: part.points.length / 2 }, (_, i) => ({ x: part.points[i * 2], y: part.points[i * 2 + 1] })));
}

function boundsOf(points: readonly { x: number; y: number }[]): PixelRect | null {
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

function intersect(a: PixelRect, b: PixelRect): PixelRect | null {
  const shifted = clipRect({ ...a, x: a.x - b.x, y: a.y - b.y }, b.width, b.height);
  return shifted ? { ...shifted, x: shifted.x + b.x, y: shifted.y + b.y } : null;
}

function cropPhoto(doc: ImageSurface, layer: Layer, selection: PixelSelection, canvas: CanvasSize): PixelEdit {
  const frame = cropFrame(layer, canvas);
  const local = selectionPoints(selection).map((point) => {
    const turned = rotate({ x: point.x - frame.center.x, y: point.y - frame.center.y }, -frame.rotation);
    return { x: turned.x + frame.width / 2, y: turned.y + frame.height / 2 };
  });
  const bounds = boundsOf(local);
  const visible = { x: frame.box.left, y: frame.box.top, width: frame.box.width, height: frame.box.height };
  const box = bounds ? intersect(bounds, visible) : null;
  if (!box || box.width < 1 || box.height < 1) return fail("empty");
  const patch = applyCropBox(layer, frame, { left: box.x, top: box.y, width: box.width, height: box.height }, canvas);
  return checked(updateLayers(doc, [layer.id], patch), layer.id);
}

function shifted(op: PixelOp, dx: number, dy: number): PixelOp {
  const move = (points: readonly number[], stride: number) => points.map((value, i) => (i % stride === 0 ? value - dx : i % stride === 1 ? value - dy : value));
  if (op.kind === "stroke") return { ...op, points: move(op.points, op.pressure ? 3 : 2) };
  return { ...op, parts: op.parts.map((part) => ({ ...part, points: move(part.points, 2) })) };
}

function cropPaint(doc: ImageSurface, layer: Layer, frame: PixelFrame, selection: PixelSelection, canvas: CanvasSize): PixelEdit {
  const surface = layer.surface!;
  const bounds = boundsOf(selectionPoints(selection).map((point) => toSurface(frame, point)));
  const clipped = bounds ? clipRect(bounds, surface.width, surface.height) : null;
  if (!clipped) return fail("empty");
  const left = Math.floor(clipped.x);
  const top = Math.floor(clipped.y);
  const rect = { x: left, y: top, width: Math.max(1, Math.ceil(clipped.x + clipped.width) - left), height: Math.max(1, Math.ceil(clipped.y + clipped.height) - top) };
  const ops = surface.ops.filter((op) => {
    const reach = opReach(op, surface);
    return reach !== null && intersect(reach, rect) !== null;
  });
  const center = fromSurface(frame, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
  const transform: Transform = {
    ...layer.transform,
    x: clampTo(center.x / canvas.width, LAYER_RANGES.position),
    y: clampTo(center.y / canvas.height, LAYER_RANGES.position),
    w: clampTo(((rect.width / surface.width) * frame.width) / canvas.width, LAYER_RANGES.size),
    h: clampTo(((rect.height / surface.height) * frame.height) / canvas.height, LAYER_RANGES.size),
  };
  const next: PixelSurface = { width: rect.width, height: rect.height, ops: ops.map((op) => shifted(op, rect.x, rect.y)) };
  return checked(updateLayers(doc, [layer.id], { surface: next, transform }), layer.id);
}

export function cropToSelection(doc: ImageSurface, layerId: string, selection: PixelSelection, canvas: CanvasSize = doc.canvas): PixelEdit {
  const layer = usable(doc, layerId);
  if (typeof layer === "string") return fail(layer);
  if (selection.invert) return fail("empty");
  if (layer.type === "image") return cropPhoto(doc, layer, selection, canvas);
  const frame = pixelFrame(layer, canvas, "paint");
  return frame ? cropPaint(doc, layer, frame, selection, canvas) : fail("no_pixels");
}

export function copySelectionToLayer(doc: ImageSurface, layerId: string, selection: PixelSelection, canvas: CanvasSize = doc.canvas): PixelEdit {
  const layer = layerById(doc, layerId);
  if (!layer) return fail("missing");
  if (layer.type !== "image" && layer.type !== "paint") return fail("no_pixels");
  const copied = duplicateLayers(doc, [layer.id], 0);
  const copyId = copied.ids[0];
  const copy = layerById(copied.document, copyId)!;
  const unlocked = copy.locked ? updateLayers(copied.document, [copyId], { locked: undefined }) : copied.document;
  const target: Target = layer.type === "paint" ? { kind: "paint", mode: "erase" } : { kind: "mask", mode: "hide" };
  const result = paintOn(unlocked, { ...copy, locked: undefined }, target, { ...selection, invert: !selection.invert }, { opacity: 1 }, canvas);
  return result.ok ? { ...result, created: copyId } : result;
}
