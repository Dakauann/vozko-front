import type { ChartSpec } from "@/lib/studio/chart";
import { emptyVideoDocument, type Artboard, type Clip, type Gradient, type Layer, type Transform, type VideoAspect, type VideoDocument } from "@/lib/studio/document";
import type { FontId } from "@/lib/studio/fonts";
import type { Keyframe } from "@/lib/studio/keyframes";
import type { Effect } from "@/lib/studio/layer-paint";

import { BENCH_ARTBOARD_ID } from "./model";

export function box(x: number, y: number, w: number, h: number, rotation = 0, opacity = 1): Transform {
  return { x, y, w, h, rotation, opacity };
}

export interface TextStyle {
  font: FontId;
  size: number;
  weight?: number;
  fill: string;
  align?: Layer["align"];
  spacing?: number;
  leading?: number;
  italic?: boolean;
}

export function text(id: string, value: string, transform: Transform, style: TextStyle, extra: Partial<Layer> = {}): Layer {
  return {
    id,
    type: "text",
    transform,
    text: value,
    fontId: style.font,
    fontSize: style.size,
    fontWeight: style.weight ?? 400,
    align: style.align ?? "center",
    lineHeight: style.leading ?? 1.15,
    fill: style.fill,
    ...(style.spacing ? { letterSpacing: style.spacing } : {}),
    ...(style.italic ? { italic: true } : {}),
    ...extra,
  };
}

export function rect(id: string, transform: Transform, fill: string, extra: Partial<Layer> = {}): Layer {
  return { id, type: "shape", shape: "rect", transform, fill, ...extra };
}

export function ellipse(id: string, transform: Transform, fill: string, extra: Partial<Layer> = {}): Layer {
  return { id, type: "shape", shape: "ellipse", transform, fill, ...extra };
}

export function star(id: string, transform: Transform, fill: string, points: number, inner: number, extra: Partial<Layer> = {}): Layer {
  return { id, type: "shape", shape: "star", transform, fill, points, inner, ...extra };
}

export function triangle(id: string, transform: Transform, fill: string, extra: Partial<Layer> = {}): Layer {
  return { id, type: "shape", shape: "triangle", transform, fill, ...extra };
}

export function polygon(id: string, transform: Transform, fill: string, points: number, extra: Partial<Layer> = {}): Layer {
  return { id, type: "shape", shape: "polygon", transform, fill, points, ...extra };
}

export function path(id: string, data: string, transform: Transform, fill: string, extra: Partial<Layer> = {}): Layer {
  return { id, type: "shape", shape: "path", path: data, transform, fill, ...extra };
}

export function icon(id: string, iconId: string, transform: Transform, fill: string): Layer {
  return { id, type: "icon", iconId, transform, fill };
}

export function photo(id: string, assetId: string, transform: Transform, extra: Partial<Layer> = {}): Layer {
  return { id, type: "image", assetId, transform, ...extra };
}

export function drop(id: string, color: string, opacity: number, x: number, y: number, blur: number, spread = 0): Effect {
  return { id, type: "drop-shadow", color, opacity, x, y, blur, spread };
}

export function glow(id: string, color: string, opacity: number, blur: number): Effect {
  return { id, type: "outer-glow", color, opacity, x: 0, y: 0, blur, spread: 0 };
}

export function inset(id: string, color: string, opacity: number, x: number, y: number, blur: number, spread = 0): Effect {
  return { id, type: "inner-shadow", color, opacity, x, y, blur, spread };
}

export function linear(from: string, to: string, angle: number, via?: string): Gradient {
  return { kind: "linear", from, to, angle, ...(via ? { via } : {}) };
}

export function radial(from: string, to: string, cx = 0.5, cy = 0.5, radius = 1): Gradient {
  return { kind: "radial", from, to, angle: 0, cx, cy, radius };
}

export function board(width: number, height: number, background: string, layers: Layer[], gradient?: Gradient): Artboard {
  return { id: BENCH_ARTBOARD_ID, name: "Arte", x: 0, y: 0, canvas: { width, height, background, ...(gradient ? { gradient } : {}) }, layers };
}

export interface Sheet {
  width: number;
  height: number;
  at: (left: number, top: number, w: number, h: number, rotation?: number, opacity?: number) => Transform;
  mid: (cx: number, cy: number, w: number, h: number, rotation?: number, opacity?: number) => Transform;
  font: (px: number) => number;
  round: (px: number, transform: Transform) => number;
  spin: (cx: number, cy: number, angle: number) => (dx: number, dy: number, w: number, h: number, opacity?: number) => Transform;
  label: (id: string, value: string, transform: Transform, px: number, style: Omit<TextStyle, "size">, extra?: Partial<Layer>) => Layer;
  card: (id: string, transform: Transform, fill: string, px: number, extra?: Partial<Layer>) => Layer;
  board: (background: string, layers: Layer[], gradient?: Gradient) => Artboard;
}

export function sheet(width: number, height: number): Sheet {
  const mid = (cx: number, cy: number, w: number, h: number, rotation = 0, opacity = 1) => box(cx / width, cy / height, w / width, h / height, rotation, opacity);
  const round = (px: number, t: Transform) => Math.min(1, (2 * px) / Math.max(1, Math.min(t.w * width, t.h * height)));
  return {
    width,
    height,
    mid,
    at: (left, top, w, h, rotation = 0, opacity = 1) => mid(left + w / 2, top + h / 2, w, h, rotation, opacity),
    font: (px) => px / height,
    round,
    spin: (cx, cy, angle) => {
      const cos = Math.cos((angle * Math.PI) / 180);
      const sin = Math.sin((angle * Math.PI) / 180);
      return (dx, dy, w, h, opacity = 1) => mid(cx + dx * cos - dy * sin, cy + dx * sin + dy * cos, w, h, angle, opacity);
    },
    label: (id, value, transform, px, style, extra = {}) => text(id, value, transform, { ...style, size: px / height }, extra),
    card: (id, transform, fill, px, extra = {}) => rect(id, transform, fill, { radius: round(px, transform), ...extra }),
    board: (background, layers, gradient) => board(width, height, background, layers, gradient),
  };
}

export function arc(share: number, inset: number): string {
  const r = 0.5 - inset;
  const end = share * 2 * Math.PI - Math.PI / 2;
  const x = 0.5 + r * Math.cos(end);
  const y = 0.5 + r * Math.sin(end);
  return `M0.5 ${0.5 - r} A${r} ${r} 0 ${share > 0.5 ? 1 : 0} 1 ${x.toFixed(4)} ${y.toFixed(4)}`;
}

export function chart(kind: ChartSpec["kind"], labels: string[], values: number[], palette: string[], extra: Partial<ChartSpec["style"]> = {}): ChartSpec {
  return {
    kind,
    data: { labels, series: [{ name: "Vendas", values }] },
    style: { palette, fontId: "plus-jakarta-sans", fontSize: 0.05, textColor: "#334155", gridColor: "#e2e8f0", axes: true, gridlines: true, legend: "none", valueLabels: true, barRadius: 0.3, barGap: 0.35, lineWidth: 0.006, smooth: false, points: false, hole: 0.62, ...extra },
    format: { locale: "pt-BR", decimals: 0, percent: false },
  };
}

export const FULL: Transform = { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 };

export function key(atMs: number, value: number, easing: Keyframe["easing"] = "easeOut"): Keyframe {
  return { atMs, value, easing };
}

export function overlay(id: string, layer: Omit<Layer, "id" | "transform">, startMs: number, durationMs: number, transform: Transform, extra: Partial<Clip> = {}): Clip {
  return { id, type: "overlay", startMs, durationMs, trimInMs: 0, volume: 1, fadeInMs: 0, fadeOutMs: 0, transform, layer: { ...layer, id: `${id}-layer`, transform: FULL }, ...extra };
}

export function film(aspect: VideoAspect, background: string, durationMs: number, clips: Clip[]): VideoDocument {
  const doc = emptyVideoDocument(aspect, background);
  doc.tracks = [...clips.map((clip, i) => ({ id: `v${i + 1}`, kind: "visual" as const, clips: [clip] })), { id: "a1", kind: "audio", clips: [] }];
  doc.durationMs = durationMs;
  return doc;
}

export function caption(value: string, font: FontId, size: number, weight: number, fill: string): Omit<Layer, "id" | "transform"> {
  return { type: "text", text: value, fontId: font, fontSize: size, fontWeight: weight, align: "center", lineHeight: 1.1, fill };
}

export type Writer = (id: string, value: string, left: number, top: number, w: number, h: number, px: number, weight: number, fill: string, align?: Layer["align"], extra?: Partial<Layer>) => Layer;

export function writer(s: Sheet, font: FontId): Writer {
  return (id, value, left, top, w, h, px, weight, fill, align = "left", extra = {}) => s.label(id, value, s.at(left, top, w, h), px, { font, weight, fill, align }, extra);
}

export function soft(id: string, color: string, opacity: number, y: number, blur: number): Effect[] {
  return [drop(`${id}_near`, color, opacity * 0.6, 0, Math.round(y / 4), Math.round(blur / 4)), drop(`${id}_far`, color, opacity, 0, y, blur)];
}

export function raised(id: string, light: string, dark: string, distance: number, blur: number): Effect[] {
  return [drop(`${id}_light`, light, 0.9, -distance, -distance, blur), drop(`${id}_dark`, dark, 0.6, distance, distance, blur)];
}

export function pressed(id: string, light: string, dark: string, distance: number, blur: number): Effect[] {
  return [inset(`${id}_dark`, dark, 0.55, distance, distance, blur), inset(`${id}_light`, light, 0.9, -distance, -distance, blur)];
}

export const CLEAR = "#00000000";

export function archPath(width: number, height: number): string {
  const ry = Math.min(0.5, width / (2 * height));
  return `M0 1 L0 ${ry.toFixed(4)} A0.5 ${ry.toFixed(4)} 0 0 1 1 ${ry.toFixed(4)} L1 1 Z`;
}
