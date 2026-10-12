import { videoCanvasSize, type Layer, type VideoDocument } from "../document";
import type { VisualItem } from "../playback";
import { mixedParts } from "./paint-mix";
import { revealPolygon } from "../transition-effects";
import { tintMatrix } from "./color-matrix";
import { layerReach, paintedContent, rasterPlan, stable } from "./raster";
import { haloPad, type HaloNode, type HaloPicture } from "../media-halo";
import { planReach } from "../clip-style";
import { repeatedNodes } from "./repeat-nodes";
import { pathOpsLayer } from "../path-ops";
import type { LineNode, RasterSource, Scene, SceneBox, SceneNode } from "./scene";
import { glyphNode } from "./glyph-scene";
import { blendHex } from "../color";
import { lineColorOf, strokelessLayer, type LineState } from "../line-animation";
import { isPlainMatte, type Matte } from "../matte";
import { lineNode } from "./line-node";
import { chartNodes } from "./chart-scene";
import { echoNode } from "./echo-nodes";
import { sceneLens, tiltMatrix } from "../clip-tilt";
import type { Lens } from "../perspective";
import { turnsInDepth } from "../text-selectors";

const FALLBACK_LINE_COLOR = "#000000";

function boxOf(item: VisualItem, width: number, height: number): SceneBox {
  const t = item.transform;
  return { x: t.x * width, y: t.y * height, width: t.w * width, height: t.h * height, rotation: t.rotation };
}

function strokeColor(item: VisualItem, layer: Layer): string {
  const segment = item.paint?.stroke;
  const color = segment ? blendHex(segment.from, segment.to, segment.weight) : lineColorOf(layer);
  return color ?? FALLBACK_LINE_COLOR;
}

function lineNodeOf(item: VisualItem, line: LineState, layer: Layer, source: RasterSource): LineNode {
  return lineNode(line, layer, source, strokeColor(item, layer));
}

function chartNode(item: VisualItem, width: number, height: number): SceneNode | null {
  if (!item.chart || item.layer?.type !== "chart") return null;
  const box = boxOf(item, width, height);
  const size = { width: item.base.w * width, height: item.base.h * height };
  const scene: Scene = { ...size, background: TRANSPARENT_BACKGROUND, nodes: chartNodes(item.clipId, item.layer, item.chart, size) };
  return {
    id: item.clipId,
    source: { kind: "group", scene },
    box,
    fit: "fill",
    opacity: item.opacity,
    visible: item.active,
    ...(item.layer.blendMode && item.layer.blendMode !== "normal" ? { blend: item.layer.blendMode } : {}),
    ...lookOf(item, box, width, height),
    ...(item.masks ? { clipMasks: item.masks } : {}),
    ...flipsOf(item),
    ...vfxOf(item),
    ...trailOf(item, width, height),
  };
}

function overlayNode(item: VisualItem, width: number, height: number): SceneNode | null {
  if (!item.layer) return null;
  const chart = chartNode(item, width, height);
  if (chart) return chart;
  const baseWidth = item.base.w * width;
  const baseHeight = item.base.h * height;
  const line = item.line;
  const geometry = item.shape ? pathOpsLayer(item.layer, { width: baseWidth, height: baseHeight }) : item.layer;
  const shown = line ? strokelessLayer(geometry) : geometry;
  const padPx = item.shape ? (line ? line.reachPx : layerReach(shown, height)) + item.shape.reachPx : (line?.reachPx ?? 0);
  const paint = line && item.paint ? { ...(item.paint.fill ? { fill: item.paint.fill } : {}) } : item.paint;
  const raster = (layer: Layer) => rasterPlan(paintedContent(layer), baseWidth, baseHeight, height, padPx).source;
  const animators = item.text?.animators ?? [];
  const glyphs = item.glyphs ? glyphNode(item.glyphs, shown, item.text, { width: baseWidth, height: baseHeight }, height, (sourceOf) => mixedParts(shown, paint, animators, sourceOf)) : undefined;
  const mixed = glyphs ? null : mixedParts(shown, paint, animators, raster);
  const mix = mixed?.parts ?? [];
  const source = glyphs ? glyphs.parts[0].source : mix[0].source;
  const display = boxOf(item, width, height);
  const scaleX = baseWidth > 0 ? display.width / baseWidth : 1;
  const scaleY = baseHeight > 0 ? display.height / baseHeight : 1;
  const box = source.kind === "glyphs" ? display : { ...display, width: source.widthPx * scaleX, height: source.heightPx * scaleY };
  return {
    id: item.clipId,
    source,
    box,
    fit: "fill",
    opacity: item.opacity,
    visible: item.active,
    ...(item.live ? { live: true } : {}),
    ...(item.layer.blendMode && item.layer.blendMode !== "normal" ? { blend: item.layer.blendMode } : {}),
    ...lookOf(item, box, width, height),
    ...(mix.length > 1 ? { mix } : {}),
    ...(mixed?.plan ? { textPaint: mixed.plan } : {}),
    ...(item.text && !glyphs ? { text: item.text } : {}),
    ...(glyphs ? { glyphs } : {}),
    ...(item.masks ? { clipMasks: item.masks } : {}),
    ...(line && source.kind === "raster" ? { line: lineNodeOf(item, line, geometry, source) } : {}),
    ...flipsOf(item),
    ...vfxOf(item),
    ...trailOf(item, width, height),
  };
}

function vfxOf(item: VisualItem): Pick<SceneNode, "vfx"> {
  return item.vfx ? { vfx: item.vfx } : {};
}

function trailOf(item: VisualItem, width: number, height: number): Pick<SceneNode, "trail"> {
  return item.trail ? { trail: { box: boxOf(item, width, height), maps: item.trail.maps } } : {};
}

function effectNode(item: VisualItem, width: number, height: number): SceneNode {
  const box = { x: width / 2, y: height / 2, width, height, rotation: 0 };
  return {
    id: item.clipId,
    source: { kind: "effect" },
    box,
    fit: "fill",
    opacity: item.opacity,
    visible: item.active && item.opacity > 0,
    ...vfxOf(item),
    ...blurOf(item),
    ...(item.color ? { grade: item.color } : {}),
    ...(item.gradientMap ? { gradientMap: item.gradientMap } : {}),
    ...(item.masks ? { clipMasks: item.masks } : {}),
    ...(item.camera ? { camera: { box, maps: item.camera.maps } } : {}),
  };
}

function blurOf(item: VisualItem): { blurPx?: number } {
  return item.blurPx > 0 ? { blurPx: item.blurPx } : {};
}

function revealOf(item: VisualItem, box: SceneBox, width: number, height: number): Pick<SceneNode, "reveal"> {
  const reveal = item.reveal;
  if (!reveal) return {};
  const area = item.revealInBox ? box : { x: width / 2, y: height / 2, width, height, rotation: 0 };
  const inverse = reveal.inverse === true;
  if (reveal.kind === "field") return { reveal: { box: area, field: { field: reveal.field, progress: reveal.progress, softness: reveal.softness }, inverse } };
  return { reveal: { box: area, polygon: revealPolygon(reveal, area.width, area.height), inverse } };
}

function lookOf(item: VisualItem, box: SceneBox, width: number, height: number): Pick<SceneNode, "blurPx" | "colorMatrix" | "reveal"> {
  const matrix = item.tint ? tintMatrix(item.tint.color, item.tint.amount) : null;
  return { ...blurOf(item), ...(matrix ? { colorMatrix: matrix } : {}), ...revealOf(item, box, width, height) };
}

const STRETCH_EPSILON = 1e-9;

function flipsOf(item: VisualItem): Pick<SceneNode, "flipX" | "flipY"> {
  return { ...(item.flipX ? { flipX: true } : {}), ...(item.flipY ? { flipY: true } : {}) };
}

function fitBoxOf(item: VisualItem, width: number, height: number): Pick<SceneNode, "fitBox"> {
  const t = item.transform;
  const base = item.base;
  return Math.abs(t.w * base.h - t.h * base.w) > STRETCH_EPSILON ? { fitBox: { width: base.w * width, height: base.h * height } } : {};
}

export function haloNodeOf(item: VisualItem, width: number, height: number): HaloNode | null {
  if (!item.halo || (item.type !== "video" && item.type !== "image")) return null;
  const fit = item.fit === "contain" ? "contain" : "cover";
  const picture: HaloPicture = item.type === "image" && item.assetId ? { kind: "image", assetId: item.assetId, fit, flipX: Boolean(item.flipX), flipY: Boolean(item.flipY) } : { kind: "rect", fit };
  const node = { plan: item.halo.plan, ...(item.masks ? { masks: item.masks } : {}), base: { width: item.base.w * width, height: item.base.h * height }, padPx: haloPad(planReach(item.halo.plan)), picture, ...(item.halo.live ? { live: true } : {}) };
  return { ...node, key: stable(node) };
}

function haloOf(item: VisualItem, width: number, height: number): Pick<SceneNode, "halo"> {
  const halo = haloNodeOf(item, width, height);
  return halo ? { halo } : {};
}

function mediaNode(item: VisualItem, width: number, height: number): SceneNode | null {
  if (!item.assetId) return null;
  const source = item.type === "video" ? { kind: "video" as const, clipId: item.clipId, assetId: item.assetId, sourceMs: item.sourceMs, speed: item.speed, backward: item.backward, ...(item.window ? { window: item.window } : {}), ...(item.frameMix ? { frameMix: true } : {}) } : { kind: "image" as const, assetId: item.assetId };
  const box = boxOf(item, width, height);
  return { id: item.clipId, source, box, fit: item.fit, opacity: item.opacity, visible: item.active, ...lookOf(item, box, width, height), ...(item.color ? { grade: item.color } : {}), ...(item.gradientMap ? { gradientMap: item.gradientMap } : {}), ...(item.chromaKey ? { chroma: item.chromaKey } : {}), ...(item.lumaKey ? { lumaKey: item.lumaKey } : {}), ...(item.blendMode ? { blend: item.blendMode } : {}), ...(item.masks ? { clipMasks: item.masks } : {}), ...vfxOf(item), ...fitBoxOf(item, width, height), ...flipsOf(item), ...trailOf(item, width, height), ...haloOf(item, width, height) };
}

function groupNode(item: VisualItem, width: number, height: number): SceneNode | null {
  if (!item.group) return null;
  const scene: Scene = { ...videoScene(item.group.doc, item.group.items), background: TRANSPARENT_BACKGROUND };
  const box = boxOf(item, width, height);
  return { id: item.clipId, source: { kind: "group", scene }, box, fit: "fill", opacity: item.opacity, visible: item.active, ...lookOf(item, box, width, height), ...(item.color ? { grade: item.color } : {}), ...(item.blendMode ? { blend: item.blendMode } : {}), ...(item.masks ? { clipMasks: item.masks } : {}), ...vfxOf(item), ...flipsOf(item) };
}

function flatNodeOf(item: VisualItem, width: number, height: number): SceneNode | null {
  if (item.type === "effect") return effectNode(item, width, height);
  if (item.type === "overlay") return overlayNode(item, width, height);
  return item.type === "group" ? groupNode(item, width, height) : mediaNode(item, width, height);
}

function depthOf(item: VisualItem, lens: Lens, width: number, height: number): Pick<SceneNode, "tilt" | "lens"> {
  const tilt = item.tilt ? { tilt: { matrix: tiltMatrix(lens, boxOf(item, width, height), item.tilt), width, height } } : {};
  return { ...tilt, ...(item.text?.animators?.some((animator) => turnsInDepth(animator.properties)) ? { lens } : {}) };
}

function nodeOf(item: VisualItem, width: number, height: number, lens: Lens): SceneNode | null {
  const node = flatNodeOf(item, width, height);
  return node ? { ...node, ...depthOf(item, lens, width, height) } : null;
}

function withMattes(entries: readonly { node: SceneNode; matte: Matte | null }[]): SceneNode[] {
  let base: string | null = null;
  return entries.map(({ node, matte }) => {
    if (node.source.kind === "effect") return node;
    if (!matte) {
      if (node.visible) base = node.id;
      return node;
    }
    if (!base) return { ...node, visible: false };
    return isPlainMatte(matte) ? { ...node, clipOf: base } : { ...node, clipOf: base, clipMatte: matte };
  });
}

export function videoScene(doc: VideoDocument, items: readonly VisualItem[]): Scene {
  const { width, height } = videoCanvasSize(doc);
  const lens = sceneLens(doc.canvas, { width, height });
  const entries = items.flatMap((item) => {
    const node = nodeOf(item, width, height, lens);
    return node ? [{ node, matte: item.matte ?? null, item }] : [];
  });
  const expanded = (node: SceneNode, item: VisualItem) => (item.repeat && item.type === "overlay" ? repeatedNodes(node, item.repeat, boxOf(item, width, height)) : [node]);
  const nodes = withMattes(entries).flatMap((node, i) => {
    const { item } = entries[i];
    const echoes = (item.echo ?? []).flatMap((copy, k) => {
      const copied = nodeOf(copy, width, height, lens);
      return copied ? expanded(echoNode(copied, node, k + 1), copy) : [];
    });
    return [...echoes, ...expanded(node, item)];
  });
  return { width, height, background: doc.canvas.background, nodes };
}

export type ChromaView = { clipId: string; mode: "matte" | "original" } | null;

export const TRANSPARENT_BACKGROUND = "#00000000";

export function withTransparencyGrid(scene: Scene, grid: boolean): Scene {
  return grid ? { ...scene, background: TRANSPARENT_BACKGROUND } : scene;
}

export function withChromaView(scene: Scene, view: ChromaView): Scene {
  if (!view) return scene;
  return {
    ...scene,
    nodes: scene.nodes.map((node) => {
      if (node.id !== view.clipId || !(node.chroma || node.lumaKey)) return node;
      return view.mode === "matte" ? { ...node, keyMatte: true } : { ...node, chroma: undefined, lumaKey: undefined };
    }),
  };
}

