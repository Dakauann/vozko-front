import { coverCrop } from "./crop";
import { newImageLayer, type CanvasSize, type ImageSurface, type Layer } from "./document";
import { containsPoint } from "./geometry";
import { addLayersAbove, isPickable, updateLayers } from "./layers";
import { pathToSubpaths } from "./path-nodes";

export interface FillTarget {
  frameId: string;
  photoId?: string;
}

export type FillRefusal = "noFrame" | "locked";

export type FillOutcome = { ok: true; document: ImageSurface; photoId: string } | { ok: false; reason: FillRefusal };

const CLOSED_SHAPES = new Set<Layer["shape"]>(["rect", "ellipse", "triangle", "star"]);

function closedPath(path: string | undefined): boolean {
  if (!path) return false;
  const subpaths = pathToSubpaths(path);
  return subpaths.length > 0 && subpaths.every((subpath) => subpath.closed);
}

function isBase(surface: ImageSurface, layerId: string): boolean {
  return (surface.groups ?? []).some((group) => group.baseId === layerId);
}

export function isFrameSlot(surface: ImageSurface, layer: Layer): boolean {
  if (layer.type !== "shape" || layer.clip || isBase(surface, layer.id)) return false;
  return CLOSED_SHAPES.has(layer.shape) || (layer.shape === "path" && closedPath(layer.path));
}

function followerOf(surface: ImageSurface, index: number): Layer | undefined {
  const next = surface.layers[index + 1];
  return next && next.clip && next.type === "image" ? next : undefined;
}

export function fillTargetOf(surface: ImageSurface, layerId: string): FillTarget | null {
  const index = surface.layers.findIndex((layer) => layer.id === layerId);
  if (index < 0) return null;
  const layer = surface.layers[index];
  if (isFrameSlot(surface, layer)) {
    const photo = followerOf(surface, index);
    return { frameId: layer.id, ...(photo ? { photoId: photo.id } : {}) };
  }
  if (layer.type !== "image" || !layer.clip) return null;
  let base = index - 1;
  while (base >= 0 && surface.layers[base].clip) base--;
  if (base < 0 || base !== index - 1 || !isFrameSlot(surface, surface.layers[base])) return null;
  return { frameId: surface.layers[base].id, photoId: layer.id };
}

export function fillTargetAt(surface: ImageSurface, point: { x: number; y: number }): FillTarget | null {
  for (let i = surface.layers.length - 1; i >= 0; i--) {
    const layer = surface.layers[i];
    if (!isPickable(layer) || !containsPoint(layer.transform, surface.canvas, point)) continue;
    const target = fillTargetOf(surface, layer.id);
    if (target) return target;
    if (!(surface.groups ?? []).some((group) => group.baseId === layer.id && group.layout)) return null;
  }
  return null;
}

export function framedPhoto(frame: Layer, assetId: string, natural: CanvasSize, canvas: CanvasSize): Layer {
  const crop = coverCrop(natural, frame.transform, canvas);
  return { ...newImageLayer(assetId, { ...frame.transform, opacity: 1 }), clip: true, ...(crop ? { crop } : {}) };
}

export function fillFrame(surface: ImageSurface, target: FillTarget, assetId: string, natural: CanvasSize): FillOutcome {
  const frame = surface.layers.find((layer) => layer.id === target.frameId);
  if (!frame || !isFrameSlot(surface, frame)) return { ok: false, reason: "noFrame" };
  if (target.photoId) {
    const photo = surface.layers.find((layer) => layer.id === target.photoId);
    if (!photo) return { ok: false, reason: "noFrame" };
    if (photo.locked) return { ok: false, reason: "locked" };
    const crop = coverCrop(natural, photo.transform, surface.canvas);
    return { ok: true, document: updateLayers(surface, [photo.id], { assetId, crop }), photoId: photo.id };
  }
  if (frame.locked) return { ok: false, reason: "locked" };
  const photo = framedPhoto(frame, assetId, natural, surface.canvas);
  return { ok: true, document: addLayersAbove(surface, [photo], frame.id), photoId: photo.id };
}
