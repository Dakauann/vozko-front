import type { ImageCanvas, ImageDocument, ImageSurface, Layer, Transform } from "../document";
import { isNeutralGrade } from "../color-grade";
import { clipRuns } from "../paint";
import { repeatedLayers } from "../repeat-edits";
import { resolvedSurface } from "../components";
import { filterMatrix } from "./color-matrix";
import { paintedContent, rasterPlan, type RasterPlan } from "./raster";
import type { PixelLive } from "../pixel-surface";
import { paintNode, pixelMaskOf } from "./pixel-scene";
import type { Scene, SceneBox, SceneNode } from "./scene";
import { stillLooks } from "../still-vfx";

const NEUTRAL: Transform = { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 };
const SINGLE_SURFACE = "surface";

export interface ImageSceneOptions {
  hidden: ReadonlySet<string>;
  overrides: ReadonlyMap<string, Transform>;
  live?: PixelLive | null;
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

interface RememberedNode {
  shown: Transform;
  width: number;
  height: number;
  clipOf: string | undefined;
  live: PixelLive | null;
  node: SceneNode;
}

const rememberedNodes = new WeakMap<Layer, RememberedNode>();

function layerNode(layer: Layer, doc: ImageSurface, options: ImageSceneOptions, clipOf: string | undefined): SceneNode {
  const { width, height } = doc.canvas;
  const shown = options.overrides.get(layer.id) ?? layer.transform;
  const live = layer.surface || layer.mask ? (options.live ?? null) : null;
  const known = rememberedNodes.get(layer);
  if (known && known.shown === shown && known.width === width && known.height === height && known.clipOf === clipOf && known.live === live) return known.node;
  const node = freshLayerNode(layer, doc, shown, live, clipOf);
  rememberedNodes.set(layer, { shown, width, height, clipOf, live, node });
  return node;
}

function freshLayerNode(layer: Layer, doc: ImageSurface, shown: Transform, live: PixelLive | null, clipOf: string | undefined): SceneNode {
  const { width, height } = doc.canvas;
  const base = layer.transform;
  const painted = layer.type === "paint" ? paintNode(layer, shown, doc.canvas, live, clipOf) : null;
  if (painted) return painted;
  const plan = plannedRaster(layer, width, height);
  const { source } = plan;
  const pixelMask = layer.mask ? pixelMaskOf(layer, plan, doc.canvas, live) : undefined;
  const scaleX = base.w > 0 ? shown.w / base.w : 1;
  const scaleY = base.h > 0 ? shown.h / base.h : 1;
  const filters = layer.type === "image" ? layer.filters : undefined;
  const matrix = filterMatrix(filters);
  const looks = layer.type === "image" ? stillLooks(layer.vfx) : [];
  const frame: SceneBox = { x: shown.x * width, y: shown.y * height, width: shown.w * width, height: shown.h * height, rotation: shown.rotation };
  return {
    id: layer.id,
    source,
    box: { x: shown.x * width, y: shown.y * height, width: source.widthPx * scaleX, height: source.heightPx * scaleY, rotation: shown.rotation },
    fit: "fill",
    opacity: shown.opacity,
    visible: true,
    ...(layer.blendMode && layer.blendMode !== "normal" ? { blend: layer.blendMode } : {}),
    ...(matrix ? { colorMatrix: matrix } : {}),
    ...(layer.type === "image" && !isNeutralGrade(layer.color) ? { grade: layer.color } : {}),
    ...(layer.type === "image" && layer.gradientMap ? { gradientMap: layer.gradientMap } : {}),
    ...(filters?.blur ? { blurPx: filters.blur } : {}),
    ...(clipOf ? { clipOf } : {}),
    ...(pixelMask ? { pixelMask } : {}),
    ...(looks.length > 0 ? { vfx: looks, vfxFrame: frame } : {}),
  };
}

const adjustments = new WeakMap<ImageCanvas, { key: string; nodes: SceneNode[] }>();

function adjustNode(doc: ImageSurface, key: string): SceneNode[] {
  const known = adjustments.get(doc.canvas);
  if (known && known.key === key) return known.nodes;
  const looks = stillLooks(doc.canvas.vfx);
  const { width, height } = doc.canvas;
  const nodes: SceneNode[] = looks.length === 0 ? [] : [{ id: `${key}:vfx`, source: { kind: "effect" }, box: { x: width / 2, y: height / 2, width, height, rotation: 0 }, fit: "fill", opacity: 1, visible: true, vfx: looks }];
  adjustments.set(doc.canvas, { key, nodes });
  return nodes;
}

export function artboardScenes(doc: ImageDocument, options: ImageSceneOptions): Scene[] {
  return doc.artboards.map((artboard) => ({ ...imageScene(resolvedSurface(doc, artboard), options, artboard.id), key: artboard.id, origin: { x: artboard.x, y: artboard.y } }));
}

export function imageScene(doc: ImageSurface, options: ImageSceneOptions, key: string = SINGLE_SURFACE): Scene {
  const shown = (layer: Layer) => !layer.hidden && !options.hidden.has(layer.id);
  const nodes = clipRuns(repeatedLayers(doc)).flatMap(([base, ...members]) => {
    if (!shown(base)) return [];
    return [layerNode(base, doc, options, undefined), ...members.filter(shown).map((member) => layerNode(member, doc, options, base.id))];
  });
  return { width: doc.canvas.width, height: doc.canvas.height, background: doc.canvas.background, ...(doc.canvas.gradient ? { gradient: doc.canvas.gradient } : {}), artboard: true, nodes: [...nodes, ...adjustNode(doc, key)] };
}
