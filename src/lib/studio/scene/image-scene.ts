import type { ImageDocument, ImageSurface, Layer, Transform } from "../document";
import { clipRuns } from "../paint";
import { filterMatrix } from "./color-matrix";
import { paintedContent, rasterPlan, type RasterPlan } from "./raster";
import type { Scene, SceneNode } from "./scene";

const NEUTRAL: Transform = { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 };

export interface ImageSceneOptions {
  hidden: ReadonlySet<string>;
  overrides: ReadonlyMap<string, Transform>;
}

const plans = new WeakMap<Layer, { canvas: string; plan: RasterPlan }>();

function plannedRaster(layer: Layer, width: number, height: number): RasterPlan {
  const canvas = `${width}x${height}`;
  const known = plans.get(layer);
  if (known && known.canvas === canvas) return known.plan;
  const plan = rasterPlan({ ...paintedContent(layer), transform: NEUTRAL }, layer.transform.w * width, layer.transform.h * height, height);
  plans.set(layer, { canvas, plan });
  return plan;
}

function layerNode(layer: Layer, doc: ImageSurface, options: ImageSceneOptions, clipOf: string | undefined): SceneNode {
  const { width, height } = doc.canvas;
  const base = layer.transform;
  const shown = options.overrides.get(layer.id) ?? base;
  const { source } = plannedRaster(layer, width, height);
  const scaleX = base.w > 0 ? shown.w / base.w : 1;
  const scaleY = base.h > 0 ? shown.h / base.h : 1;
  const filters = layer.type === "image" ? layer.filters : undefined;
  const matrix = filterMatrix(filters);
  return {
    id: layer.id,
    source,
    box: { x: shown.x * width, y: shown.y * height, width: source.widthPx * scaleX, height: source.heightPx * scaleY, rotation: shown.rotation },
    fit: "fill",
    opacity: shown.opacity,
    visible: true,
    ...(layer.blendMode && layer.blendMode !== "normal" ? { blend: layer.blendMode } : {}),
    ...(matrix ? { colorMatrix: matrix } : {}),
    ...(filters?.blur ? { blurPx: filters.blur } : {}),
    ...(clipOf ? { clipOf } : {}),
  };
}

export function artboardScenes(doc: ImageDocument, options: ImageSceneOptions): Scene[] {
  return doc.artboards.map((artboard) => ({ ...imageScene(artboard, options), key: artboard.id, origin: { x: artboard.x, y: artboard.y } }));
}

export function imageScene(doc: ImageSurface, options: ImageSceneOptions): Scene {
  const shown = (layer: Layer) => !layer.hidden && !options.hidden.has(layer.id);
  const nodes = clipRuns(doc.layers).flatMap(([base, ...members]) => {
    if (!shown(base)) return [];
    return [layerNode(base, doc, options, undefined), ...members.filter(shown).map((member) => layerNode(member, doc, options, base.id))];
  });
  return { width: doc.canvas.width, height: doc.canvas.height, background: doc.canvas.background, ...(doc.canvas.gradient ? { gradient: doc.canvas.gradient } : {}), artboard: true, nodes };
}
