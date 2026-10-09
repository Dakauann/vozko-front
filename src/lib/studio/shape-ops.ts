import { produce, type Draft } from "immer";

import { layerArrowheads } from "./arrowheads";

import { newStudioId, type FillRule, type ImageSurface, type Layer } from "./document";
import { cleanupGroups } from "./groups";
import { strokeStyle } from "./paint";
import { updateLayers, type LayerPatch } from "./layers";
import { booleanSubpaths, reverseSubpaths, type BooleanOp } from "./path-boolean";
import { mapSubpaths, segmentCount, subpathsToPath, type Subpath } from "./path-nodes";
import { simplifySubpaths } from "./path-simplify";
import { outlineStroke } from "./stroke-outline";
import { STROKE_STYLE_KEYS } from "./style";
import { surfaceIssue } from "./validate";
import { canvasSubpaths, layerSubpaths, pathGeometryFromCanvas, refitPathLayer, vectorLayerOf } from "./vector-layer";

export type ShapeCombine = BooleanOp | "flatten";
export type ShapeOpKind = ShapeCombine | "release" | "reverse" | "simplify" | "outline";
export type ShapeOpIssue = "too_few" | "unsupported" | "locked" | "empty" | "failed" | "too_large" | "invalid" | "unchanged";
export type ShapeOpResult = { ok: true; document: ImageSurface; ids: string[] } | { ok: false; issue: ShapeOpIssue };

const CARRIED_KEYS = ["name", "fill", "gradient", ...STROKE_STYLE_KEYS, "shadow", "blendMode"] as const;
const BOTTOM_STYLED = new Set<ShapeCombine>(["subtract", "exclude"]);
const STROKE_CLEARED: Partial<Layer> = Object.fromEntries([...STROKE_STYLE_KEYS, "arrowStart", "arrowEnd"].map((key) => [key, undefined]));
const SIMPLIFY_SHARE = 0.003;
const MIN_SIMPLIFY_PX = 0.5;

function refuse(issue: ShapeOpIssue): ShapeOpResult {
  return { ok: false, issue };
}

function picked(doc: ImageSurface, ids: readonly string[]): Layer[] {
  const wanted = new Set(ids);
  return doc.layers.filter((l) => wanted.has(l.id));
}

function settled(next: ImageSurface, ids: string[]): ShapeOpResult {
  const issue = surfaceIssue(next);
  if (!issue) return { ok: true, document: next, ids };
  return refuse(issue.code === "too_large" ? "too_large" : "invalid");
}

function carriedFrom(layer: Layer): Partial<Layer> {
  const carried: Partial<Layer> = {};
  for (const key of CARRIED_KEYS) if (layer[key] !== undefined) Object.assign(carried, { [key]: layer[key] });
  return carried;
}

function isPath(layer: Layer): boolean {
  return layer.type === "shape" && layer.shape === "path";
}

function combinedFillRule(op: ShapeCombine, layers: readonly Layer[]): FillRule | undefined {
  if (op !== "flatten") return "evenodd";
  return layers.every((l) => l.fillRule === "evenodd") ? "evenodd" : undefined;
}

function combinedSubpaths(op: ShapeCombine, layers: readonly Layer[], shapes: readonly Subpath[][]): Subpath[] | null {
  if (op === "flatten") return shapes.flat();
  return booleanSubpaths(layers.map((layer, i) => ({ subpaths: shapes[i], fillRule: layer.fillRule })), op);
}

export function combineShapes(doc: ImageSurface, ids: readonly string[], op: ShapeCombine): ShapeOpResult {
  const layers = picked(doc, ids);
  if (layers.length < 2) return refuse("too_few");
  if (layers.some((l) => l.locked)) return refuse("locked");
  const vectors = layers.flatMap((l) => vectorLayerOf(l, doc.canvas) ?? []);
  if (vectors.length !== layers.length) return refuse("unsupported");
  const shapes = vectors.map((v) => canvasSubpaths(v, doc.canvas));
  const subpaths = combinedSubpaths(op, layers, shapes);
  if (!subpaths) return refuse("failed");
  if (subpaths.length === 0) return refuse("empty");
  const top = layers[layers.length - 1];
  const source = BOTTOM_STYLED.has(op) ? layers[0] : top;
  const { path, transform } = pathGeometryFromCanvas(subpaths, doc.canvas);
  const fillRule = combinedFillRule(op, layers);
  const merged: Layer = {
    id: newStudioId("l"),
    type: "shape",
    shape: "path",
    path,
    transform: { ...transform, opacity: source.transform.opacity },
    ...carriedFrom(source),
    ...(fillRule ? { fillRule } : {}),
    ...(top.groupId ? { groupId: top.groupId } : {}),
  };
  const removed = new Set(layers.map((l) => l.id));
  const next = produce(doc, (draft) => {
    draft.layers.splice(draft.layers.findIndex((l) => l.id === top.id), 1, merged as Draft<Layer>);
    draft.layers = draft.layers.filter((l) => l.id === merged.id || !removed.has(l.id));
    cleanupGroups(draft);
  });
  return settled(next, [merged.id]);
}

function releasable(layer: Layer): boolean {
  return isPath(layer) && !layer.locked && layerSubpaths(layer).length > 1;
}

export function releaseCompound(doc: ImageSurface, ids: readonly string[]): ShapeOpResult {
  const targets = picked(doc, ids).filter(releasable);
  if (targets.length === 0) return refuse("unsupported");
  const parts = new Map<string, Layer[]>();
  for (const layer of targets) {
    const subpaths = layerSubpaths(layer);
    const pieces = subpaths.flatMap((subpath) => refitPathLayer(layer, [subpath], doc.canvas) ?? []);
    if (pieces.length !== subpaths.length) return refuse("invalid");
    parts.set(layer.id, pieces.map((piece) => ({ ...layer, ...piece, id: newStudioId("l") })));
  }
  const next = produce(doc, (draft) => {
    draft.layers = draft.layers.flatMap((l) => (parts.get(l.id) as Draft<Layer>[] | undefined) ?? [l]);
  });
  return settled(next, [...parts.values()].flat().map((l) => l.id));
}

export function reversePaths(doc: ImageSurface, ids: readonly string[]): ShapeOpResult {
  const targets = picked(doc, ids).filter((l) => isPath(l) && !l.locked);
  if (targets.length === 0) return refuse("unsupported");
  const paths = new Map(targets.map((l) => [l.id, subpathsToPath(reverseSubpaths(layerSubpaths(l)))]));
  const next = produce(doc, (draft) => {
    for (const layer of draft.layers) {
      const path = paths.get(layer.id);
      if (path) layer.path = path;
    }
  });
  return settled(next, targets.map((l) => l.id));
}

function nodeCount(subpaths: readonly Subpath[]): number {
  return subpaths.reduce((sum, subpath) => sum + subpath.nodes.length, 0);
}

export function layerNodeCount(layer: Layer): number {
  return nodeCount(layerSubpaths(layer));
}

function simplifiable(layer: Layer): boolean {
  return isPath(layer) && !layer.locked && layerSubpaths(layer).some((subpath) => segmentCount(subpath) > 1);
}

function simplifiedPatch(layer: Layer, doc: ImageSurface): LayerPatch | null | "unchanged" {
  const width = layer.transform.w * doc.canvas.width;
  const height = layer.transform.h * doc.canvas.height;
  const local = mapSubpaths(layerSubpaths(layer), (p) => ({ x: p.x * width, y: p.y * height }));
  const simpler = simplifySubpaths(local, Math.max(MIN_SIMPLIFY_PX, Math.hypot(width, height) * SIMPLIFY_SHARE));
  if (nodeCount(simpler) >= nodeCount(local)) return "unchanged";
  return refitPathLayer(layer, mapSubpaths(simpler, (p) => ({ x: p.x / width, y: p.y / height })), doc.canvas);
}

export function simplifyPaths(doc: ImageSurface, ids: readonly string[]): ShapeOpResult {
  const targets = picked(doc, ids).filter(simplifiable);
  if (targets.length === 0) return refuse("unsupported");
  const patches = new Map<string, LayerPatch>();
  for (const layer of targets) {
    const patch = simplifiedPatch(layer, doc);
    if (patch === null) return refuse("invalid");
    if (patch !== "unchanged") patches.set(layer.id, patch);
  }
  if (patches.size === 0) return refuse("unchanged");
  return settled(updateLayers(doc, [...patches.keys()], (layer) => patches.get(layer.id) ?? {}), [...patches.keys()]);
}

function isLine(layer: Layer): boolean {
  return layer.type === "shape" && (layer.shape === "line" || layer.shape === "arrow");
}

function localStrokePath(layer: Layer, doc: ImageSurface, width: number, height: number): Subpath[] | null {
  if (isLine(layer)) return [{ closed: false, nodes: [{ x: 0, y: height / 2 }, { x: width, y: height / 2 }] }];
  const vector = vectorLayerOf(layer, doc.canvas);
  return vector ? mapSubpaths(layerSubpaths(vector), (p) => ({ x: p.x * width, y: p.y * height })) : null;
}

function outlinable(layer: Layer, doc: ImageSurface): boolean {
  return layer.type === "shape" && !layer.locked && (layer.strokeWidth ?? 0) > 0 && Boolean(layer.stroke) && (isLine(layer) || vectorLayerOf(layer, doc.canvas) !== null);
}

function visiblyFilled(layer: Layer): boolean {
  if (isLine(layer)) return false;
  if (layer.gradient) return true;
  const fill = layer.fill ?? "";
  return fill !== "" && !(fill.length === 9 && fill.endsWith("00"));
}

function outlinedLayers(layer: Layer, doc: ImageSurface): Layer[] | ShapeOpIssue {
  const width = layer.transform.w * doc.canvas.width;
  const height = layer.transform.h * doc.canvas.height;
  const local = localStrokePath(layer, doc, width, height);
  if (!local) return "unsupported";
  const style = strokeStyle(layer);
  const heads = layerArrowheads(layer, width, height).map((flat) => [0, 2, 4].map((i) => ({ x: flat[i], y: flat[i + 1] })));
  const outline = outlineStroke(local, { width: layer.strokeWidth ?? 0, cap: style.lineCap, join: style.lineJoin, miterLimit: style.miterLimit, dash: style.dash, dashOffset: style.dashOffset }, heads);
  if (!outline) return "failed";
  if (outline.length === 0) return "empty";
  const patch = refitPathLayer(layer, mapSubpaths(outline, (p) => ({ x: p.x / width, y: p.y / height })), doc.canvas);
  if (!patch?.transform || !patch.path) return "invalid";
  const shell: Layer = {
    id: newStudioId("l"),
    type: "shape",
    shape: "path",
    path: patch.path,
    transform: patch.transform,
    fill: layer.stroke,
    ...(layer.name ? { name: layer.name } : {}),
    ...(layer.shadow ? { shadow: layer.shadow } : {}),
    ...(layer.blendMode ? { blendMode: layer.blendMode } : {}),
    ...(layer.groupId ? { groupId: layer.groupId } : {}),
  };
  return visiblyFilled(layer) ? [{ ...layer, ...STROKE_CLEARED }, shell] : [shell];
}

export function outlineStrokes(doc: ImageSurface, ids: readonly string[]): ShapeOpResult {
  const targets = picked(doc, ids).filter((l) => outlinable(l, doc));
  if (targets.length === 0) return refuse("unsupported");
  const replacements = new Map<string, Layer[]>();
  for (const layer of targets) {
    const outlined = outlinedLayers(layer, doc);
    if (typeof outlined === "string") return refuse(outlined);
    replacements.set(layer.id, outlined);
  }
  const next = produce(doc, (draft) => {
    draft.layers = draft.layers.flatMap((l) => (replacements.get(l.id) as Draft<Layer>[] | undefined) ?? [l]);
  });
  return settled(next, [...replacements.values()].flat().map((l) => l.id));
}

export interface ShapeOps {
  combine: boolean;
  release: boolean;
  reverse: boolean;
  simplify: boolean;
  outline: boolean;
}

export function shapeOpsFor(doc: ImageSurface, ids: readonly string[]): ShapeOps {
  const layers = picked(doc, ids);
  const unlocked = layers.length > 0 && layers.every((l) => !l.locked);
  return {
    combine: unlocked && layers.length > 1 && layers.every((l) => vectorLayerOf(l, doc.canvas) !== null),
    release: layers.some(releasable),
    reverse: unlocked && layers.every(isPath),
    simplify: layers.some(simplifiable),
    outline: layers.some((l) => outlinable(l, doc)),
  };
}

export function runShapeOp(doc: ImageSurface, ids: readonly string[], kind: ShapeOpKind): ShapeOpResult {
  switch (kind) {
    case "release":
      return releaseCompound(doc, ids);
    case "reverse":
      return reversePaths(doc, ids);
    case "simplify":
      return simplifyPaths(doc, ids);
    case "outline":
      return outlineStrokes(doc, ids);
    default:
      return combineShapes(doc, ids, kind);
  }
}
