import { boxCorners } from "../arrange";
import { mixColors, parseColor, type Rgba } from "../color";
import { convexArea, convexIntersection, insideConvex, type Point } from "../convex";
import { videoCanvasSize, type CanvasSize, type Gradient, type ImageSurface, type Layer, type TextAlign, type Track, type Transform, type VideoDocument } from "../document";
import type { Effect } from "../layer-paint";
import { visualPlan, type VisualItem } from "../playback";

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SceneElement {
  id: string;
  layer?: Layer;
  media: boolean;
  box: Box;
  transform: Transform;
  opacity: number;
  rotation: number;
}

export interface SceneGround {
  canvas: CanvasSize;
  background: Rgba | null;
  elements: SceneElement[];
  still: boolean;
}

export type EdgeName = "left" | "center" | "right" | "top" | "middle" | "bottom";

export const EDGES: Record<EdgeName, (b: Box) => number> = {
  left: (b) => b.left,
  center: (b) => (b.left + b.right) / 2,
  right: (b) => b.right,
  top: (b) => b.top,
  middle: (b) => (b.top + b.bottom) / 2,
  bottom: (b) => b.bottom,
};

export function textAnchor(layer: Layer): TextAlign {
  return layer.align ?? "left";
}

function boxOf(t: Transform, canvas: CanvasSize): Box {
  const radians = (t.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const halfW = (t.w * canvas.width) / 2;
  const halfH = (t.h * canvas.height) / 2;
  const spanX = (cos * halfW + sin * halfH) / canvas.width;
  const spanY = (sin * halfW + cos * halfH) / canvas.height;
  return { left: t.x - spanX, right: t.x + spanX, top: t.y - spanY, bottom: t.y + spanY };
}

export function area(b: Box): number {
  return Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);
}

export function intersection(a: Box, b: Box): number {
  return area({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });
}

export function cornersOf(el: Pick<SceneElement, "transform">, canvas: CanvasSize): Point[] {
  return boxCorners(el.transform, canvas);
}

export function sharedArea(a: readonly Point[], b: readonly Point[]): number {
  return convexArea(convexIntersection(a, b));
}

export function unitBounds(points: readonly Point[], canvas: CanvasSize): Box {
  const xs = points.map(([x]) => x / canvas.width);
  const ys = points.map(([, y]) => y / canvas.height);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

export function overlapShare(a: readonly Point[], b: readonly Point[]): number {
  return sharedArea(a, b) / Math.max(1, Math.min(convexArea(a), convexArea(b)));
}

export function insideElement(el: Pick<SceneElement, "transform">, canvas: CanvasSize, x: number, y: number): boolean {
  return insideConvex([x * canvas.width, y * canvas.height], cornersOf(el, canvas));
}

function gradientColor(gradient: Gradient): Rgba | null {
  const stops = [gradient.from, gradient.via, gradient.to].map(parseColor).filter((c): c is Rgba => c !== null);
  if (stops.length === 0) return null;
  const sum = stops.reduce((acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b, a: acc.a + c.a }), { r: 0, g: 0, b: 0, a: 0 });
  return { r: Math.round(sum.r / stops.length), g: Math.round(sum.g / stops.length), b: Math.round(sum.b / stops.length), a: sum.a / stops.length };
}

export function paintOf(layer: Layer): Rgba | null {
  return layer.gradient ? gradientColor(layer.gradient) : parseColor(layer.fill);
}

function canvasPaint(background: string, gradient: Gradient | undefined): Rgba | null {
  return gradient ? gradientColor(gradient) : parseColor(background);
}

export function covers(el: SceneElement): boolean {
  if (el.opacity < 0.99) return false;
  if (el.media) return true;
  const layer = el.layer;
  if (layer?.type !== "shape" || layer.shape !== "rect") return false;
  const paint = paintOf(layer);
  return paint !== null && paint.a >= 0.99;
}

export function backdrop(scene: SceneGround, index: number, x: number, y: number): Rgba | null {
  let color = scene.background;
  for (const el of scene.elements.slice(0, index)) {
    if (!insideElement(el, scene.canvas, x, y)) continue;
    if (el.media) {
      color = el.opacity >= 0.99 ? null : color;
      continue;
    }
    const layer = el.layer;
    if (layer?.type !== "shape" || layer.shape === "line" || layer.shape === "arrow") continue;
    const paint = paintOf(layer);
    if (!paint) continue;
    const alpha = paint.a * el.opacity;
    color = alpha >= 0.99 ? { ...paint, a: 1 } : color ? mixColors(color, paint, alpha) : null;
  }
  return color;
}

function nested(outer: Transform, inner: Transform): Transform {
  return {
    x: outer.x + (inner.x - 0.5) * outer.w,
    y: outer.y + (inner.y - 0.5) * outer.h,
    w: inner.w * outer.w,
    h: inner.h * outer.h,
    rotation: outer.rotation + inner.rotation,
    opacity: outer.opacity * inner.opacity,
  };
}

function itemElement(item: VisualItem, canvas: CanvasSize, effects: ReadonlyMap<string, Effect[]>): SceneElement {
  const transform = item.layer ? nested(item.transform, item.layer.transform) : item.transform;
  const styled = effects.get(item.clipId);
  const layer = item.layer && styled ? { ...item.layer, effects: styled } : item.layer;
  return { id: item.clipId, layer, media: !item.layer, box: boxOf(transform, canvas), transform, opacity: item.opacity * (item.layer ? item.layer.transform.opacity : 1), rotation: transform.rotation };
}

function clipEffects(tracks: readonly Track[], into: Map<string, Effect[]> = new Map()): Map<string, Effect[]> {
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.effects?.length) into.set(clip.id, clip.effects.filter((effect) => !effect.hidden));
      if (clip.tracks) clipEffects(clip.tracks, into);
    }
  }
  return into;
}

export function videoSceneAt(doc: VideoDocument, atMs: number): SceneGround {
  const canvas = videoCanvasSize(doc);
  const effects = clipEffects(doc.tracks);
  return {
    canvas,
    background: parseColor(doc.canvas.background),
    elements: visualPlan(doc, atMs, 0)
      .filter((item) => item.active && item.opacity > 0 && item.type !== "effect")
      .map((item) => itemElement(item, canvas, effects)),
    still: false,
  };
}

export function imageScene(doc: ImageSurface): SceneGround {
  const canvas = { width: doc.canvas.width, height: doc.canvas.height };
  return {
    canvas,
    background: canvasPaint(doc.canvas.background || "#ffffff", doc.canvas.gradient),
    elements: doc.layers
      .filter((layer) => !layer.hidden)
      .map((layer) => ({ id: layer.id, layer, media: layer.type === "image", box: boxOf(layer.transform, canvas), transform: layer.transform, opacity: layer.transform.opacity, rotation: layer.transform.rotation })),
    still: true,
  };
}
