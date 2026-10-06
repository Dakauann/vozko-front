import type { ImageAspect } from "@/lib/media-generation/types";

import { VIDEO_ASPECT_SIZES, type CanvasSize, type ImageDocument, type Layer, type Transform } from "./document";
import { layerBounds, withGroupMembers, type Bounds, type LayerPatch } from "./layers";
import { clampTo, LAYER_RANGES, normalizedRotation } from "./layer-ranges";

export interface PixelBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface NodeAttrs {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export const DEFAULT_FIT_SHARE = 0.6;
export const KEEP_RATIO_TOLERANCE = 0.01;


export function boxPx(t: Transform, canvas: CanvasSize): PixelBox {
  const width = t.w * canvas.width;
  const height = t.h * canvas.height;
  return { left: t.x * canvas.width - width / 2, top: t.y * canvas.height - height / 2, width, height };
}

export function transformFromBoxPx(box: PixelBox, canvas: CanvasSize, base: Transform): Transform {
  const w = clampTo(box.width / canvas.width, LAYER_RANGES.size);
  const h = clampTo(box.height / canvas.height, LAYER_RANGES.size);
  return {
    ...base,
    x: clampTo((box.left + box.width / 2) / canvas.width, LAYER_RANGES.position),
    y: clampTo((box.top + box.height / 2) / canvas.height, LAYER_RANGES.position),
    w,
    h,
  };
}

export function nodeResizePatch(layer: Layer, node: NodeAttrs, canvas: CanvasSize): LayerPatch {
  const sx = Math.abs(node.scaleX);
  const sy = Math.abs(node.scaleY);
  const transform: Transform = {
    x: clampTo(node.x / canvas.width, LAYER_RANGES.position),
    y: clampTo(node.y / canvas.height, LAYER_RANGES.position),
    w: clampTo(layer.transform.w * sx, LAYER_RANGES.size),
    h: clampTo(layer.transform.h * sy, LAYER_RANGES.size),
    rotation: normalizedRotation(node.rotation),
    opacity: layer.transform.opacity,
  };
  const keptRatio = Math.abs(sx - sy) <= KEEP_RATIO_TOLERANCE * Math.max(sx, sy);
  if (layer.type === "text" && keptRatio && layer.fontSize !== undefined && Math.abs(sy - 1) > 1e-6) {
    return { transform, fontSize: clampTo(layer.fontSize * sy, LAYER_RANGES.fontSize) };
  }
  return { transform };
}

function centered(widthPx: number, heightPx: number, canvas: CanvasSize, base: Transform): Transform {
  return { ...base, w: clampTo(widthPx / canvas.width, LAYER_RANGES.size), h: clampTo(heightPx / canvas.height, LAYER_RANGES.size) };
}

function contain(naturalWidth: number, naturalHeight: number, maxWidth: number, maxHeight: number): [number, number] {
  const ratio = naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 1;
  const width = Math.min(maxWidth, maxHeight * ratio);
  return [width, width / ratio];
}

export function fittedTransform(naturalWidth: number, naturalHeight: number, canvas: CanvasSize, share: number = DEFAULT_FIT_SHARE): Transform {
  const [width, height] = contain(naturalWidth, naturalHeight, canvas.width * share, canvas.height * share);
  return centered(width, height, canvas, { x: 0.5, y: 0.5, w: 0, h: 0, rotation: 0, opacity: 1 });
}

export function fitInside(naturalWidth: number, naturalHeight: number, box: Transform, canvas: CanvasSize): Transform {
  const [width, height] = contain(naturalWidth, naturalHeight, box.w * canvas.width, box.h * canvas.height);
  return centered(width, height, canvas, box);
}

export function closestAspect(width: number, height: number): ImageAspect {
  const target = Math.log(width / height);
  const entries = (Object.entries(VIDEO_ASPECT_SIZES) as [ImageAspect, CanvasSize][]).map(([aspect, size]) => [aspect, size.width / size.height] as const);
  return entries.reduce((best, entry) => (Math.abs(Math.log(entry[1]) - target) < Math.abs(Math.log(best[1]) - target) ? entry : best))[0];
}

function normalized(rect: Bounds): Bounds {
  return {
    left: Math.min(rect.left, rect.right),
    right: Math.max(rect.left, rect.right),
    top: Math.min(rect.top, rect.bottom),
    bottom: Math.max(rect.top, rect.bottom),
  };
}

function intersects(a: Bounds, b: Bounds): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

export function layersInRect(doc: ImageDocument, rect: Bounds): string[] {
  const area = normalized(rect);
  const hits = doc.layers.filter((l) => !l.hidden && !l.locked && intersects(layerBounds(l.transform, doc.canvas), area)).map((l) => l.id);
  return hits.length === 0 ? [] : withGroupMembers(doc, hits);
}

export function clickSelection(doc: ImageDocument, current: readonly string[], id: string, additive: boolean): string[] {
  const members = withGroupMembers(doc, [id]);
  const chosen = new Set(current);
  if (!additive) return chosen.has(id) ? [...current] : members;
  const everyChosen = members.every((m) => chosen.has(m));
  for (const m of members) {
    if (everyChosen) chosen.delete(m);
    else chosen.add(m);
  }
  return doc.layers.filter((l) => chosen.has(l.id)).map((l) => l.id);
}

export function squareTransform(canvas: CanvasSize, share: number, heightShare: number = share): Transform {
  const side = Math.min(canvas.width, canvas.height);
  return centered(side * share, side * heightShare, canvas, { x: 0.5, y: 0.5, w: 0, h: 0, rotation: 0, opacity: 1 });
}
