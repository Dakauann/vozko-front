import { produce, type Draft } from "immer";

import type { Artboard, Gradient, ImageCanvas, ImageDocument, Layer, Shadow } from "./document";
import type { FontId } from "./fonts";
import type { LayerPatch } from "./layers";
import { isValidToken } from "./tokens";

export const STYLE_KINDS = ["color", "text", "effect"] as const;

export type StyleKind = (typeof STYLE_KINDS)[number];

export const STYLE_ROLES = ["heading", "subheading", "body"] as const;

export type StyleRole = (typeof STYLE_ROLES)[number];

export const TEXT_STYLE_FIELDS = ["fontId", "fontWeight", "italic", "fontSizePx", "lineHeight", "letterSpacing"] as const;

export type TextStyleField = (typeof TEXT_STYLE_FIELDS)[number];

export const STYLE_RANGES = { fontSizePx: [1, 2000], descriptionRunes: 500 } as const;

export interface StudioStyle {
  id: string;
  kind: StyleKind;
  name: string;
  description?: string;
  color?: string;
  gradient?: Gradient;
  role?: StyleRole;
  fontId?: FontId;
  fontWeight?: number;
  italic?: boolean;
  fontSizePx?: number;
  lineHeight?: number;
  letterSpacing?: number;
  shadow?: Shadow;
}

export const LAYER_SLOTS = ["fill", "stroke", "text", "effect"] as const;

export type LayerSlot = (typeof LAYER_SLOTS)[number];

export type StyleSlot = LayerSlot | "background";

export const SLOT_KEYS = { fill: "fillStyleId", stroke: "strokeStyleId", text: "textStyleId", effect: "effectStyleId" } as const satisfies Record<LayerSlot, keyof Layer>;

export const SLOT_KIND: Record<StyleSlot, StyleKind> = { fill: "color", stroke: "color", text: "text", effect: "effect", background: "color" };

const FONT_PX_TOLERANCE = 0.01;
const NUMBER_TOLERANCE = 1e-6;

export function styleById(doc: Pick<ImageDocument, "styles">, id: string | undefined): StudioStyle | undefined {
  return id ? doc.styles?.find((s) => s.id === id) : undefined;
}

export function withoutLinks(layer: Layer): Layer {
  const plain: Layer = { ...layer };
  for (const slot of LAYER_SLOTS) delete plain[SLOT_KEYS[slot]];
  return plain;
}

export function linksOf(raw: unknown): Partial<Layer> {
  if (typeof raw !== "object" || raw === null) return {};
  const source = raw as Record<string, unknown>;
  return Object.fromEntries(LAYER_SLOTS.map((slot) => SLOT_KEYS[slot]).flatMap((key) => (typeof source[key] === "string" && isValidToken(source[key] as string) ? [[key, source[key]]] : [])));
}

export function linkedSlots(layer: Layer): [LayerSlot, string][] {
  return LAYER_SLOTS.flatMap((slot) => {
    const id = layer[SLOT_KEYS[slot]];
    return id ? [[slot, id] as [LayerSlot, string]] : [];
  });
}

function strokedShape(layer: Layer): boolean {
  return layer.type === "shape" && (layer.shape === "line" || layer.shape === "arrow");
}

export function slotSuits(layer: Layer, slot: LayerSlot, style: StudioStyle): boolean {
  if (style.kind !== SLOT_KIND[slot]) return false;
  switch (slot) {
    case "fill":
      if (!(layer.type === "text" || layer.type === "icon" || layer.type === "shape") || strokedShape(layer) || (layer.fills ?? []).length > 0) return false;
      return !(style.gradient && layer.type === "icon");
    case "stroke":
      return !style.gradient && (layer.type === "text" || layer.type === "shape" || layer.type === "image") && (layer.strokes ?? []).length === 0 && (strokedShape(layer) || (layer.strokeWidth ?? 0) > 0);
    case "text":
      return layer.type === "text";
    case "effect":
      return (layer.type === "text" || layer.type === "shape" || layer.type === "image" || layer.type === "icon") && (layer.effects ?? []).length === 0;
  }
}

function sameColor(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
}

function sameNumber(a: number | undefined, b: number | undefined): boolean {
  return Math.abs((a ?? 0) - (b ?? 0)) <= NUMBER_TOLERANCE;
}

export function sameGradient(a: Gradient | undefined, b: Gradient | undefined): boolean {
  if (!a || !b) return !a && !b;
  return sameColor(a.from, b.from) && sameColor(a.to, b.to) && sameColor(a.via, b.via) && (a.kind ?? "") === (b.kind ?? "") && sameNumber(a.angle, b.angle) && sameNumber(a.cx, b.cx) && sameNumber(a.cy, b.cy) && sameNumber(a.radius, b.radius);
}

function sameShadow(a: Shadow | undefined, b: Shadow | undefined): boolean {
  if (!a || !b) return !a && !b;
  return sameColor(a.color, b.color) && sameNumber(a.blur, b.blur) && sameNumber(a.x, b.x) && sameNumber(a.y, b.y);
}

function paintMatches(color: string | undefined, gradient: Gradient | undefined, style: StudioStyle): boolean {
  if (style.gradient) return sameGradient(gradient, style.gradient) && sameColor(color, style.gradient.from);
  return !gradient && sameColor(color, style.color);
}

function textMatches(layer: Layer, style: StudioStyle, surfaceHeight: number): boolean {
  return TEXT_STYLE_FIELDS.every((field) => {
    const want: unknown = style[field];
    if (want === undefined || want === "" || want === 0) return true;
    switch (field) {
      case "fontSizePx":
        return Math.abs((layer.fontSize ?? 0) * surfaceHeight - (want as number)) <= FONT_PX_TOLERANCE;
      case "italic":
        return Boolean(layer.italic) === want;
      case "lineHeight":
      case "letterSpacing":
        return sameNumber(layer[field], want as number);
      default:
        return layer[field] === want;
    }
  });
}

export function slotIssue(layer: Layer, slot: LayerSlot, style: StudioStyle | undefined, surfaceHeight: number): "invalid" | null {
  if (!style || !slotSuits(layer, slot, style)) return "invalid";
  switch (slot) {
    case "fill":
      return paintMatches(layer.fill, layer.gradient, style) ? null : "invalid";
    case "stroke":
      return sameColor(layer.stroke, style.color) ? null : "invalid";
    case "text":
      return textMatches(layer, style, surfaceHeight) ? null : "invalid";
    case "effect":
      return sameShadow(layer.shadow, style.shadow) ? null : "invalid";
  }
}

export function backgroundIssue(canvas: ImageCanvas, style: StudioStyle | undefined): "invalid" | null {
  return style && style.kind === "color" && paintMatches(canvas.background, canvas.gradient, style) ? null : "invalid";
}

export function styleValues(style: StudioStyle, slot: LayerSlot, surfaceHeight: number): LayerPatch {
  switch (slot) {
    case "fill":
      return style.gradient ? { fill: style.gradient.from, gradient: style.gradient } : { fill: style.color, gradient: undefined };
    case "stroke":
      return { stroke: style.color };
    case "effect":
      return { shadow: style.shadow };
    case "text": {
      const patch: LayerPatch = {};
      for (const field of TEXT_STYLE_FIELDS) {
        const value = style[field];
        if (value === undefined) continue;
        if (field === "fontSizePx") patch.fontSize = (value as number) / surfaceHeight;
        else Object.assign(patch, { [field]: value });
      }
      return patch;
    }
  }
}

export function backgroundValues(style: StudioStyle): Pick<ImageCanvas, "background" | "gradient"> {
  return style.gradient ? { background: style.gradient.from, gradient: style.gradient } : { background: style.color ?? "", gradient: undefined };
}

function settledArtboard(artboard: Artboard, doc: ImageDocument): Artboard {
  const height = artboard.canvas.height;
  const stale = (layer: Layer) => linkedSlots(layer).filter(([slot, id]) => slotIssue(layer, slot, styleById(doc, id), height));
  const background = artboard.canvas.backgroundStyleId;
  const backgroundStale = background !== undefined && backgroundIssue(artboard.canvas, styleById(doc, background)) !== null;
  if (!backgroundStale && artboard.layers.every((layer) => stale(layer).length === 0)) return artboard;
  return produce(artboard, (draft) => {
    if (backgroundStale) delete draft.canvas.backgroundStyleId;
    for (const layer of draft.layers) for (const [slot] of stale(layer as Layer)) delete (layer as Draft<Layer>)[SLOT_KEYS[slot]];
  });
}

export function settleStyles(before: ImageDocument, after: ImageDocument): ImageDocument {
  if (before === after) return after;
  const unchanged = new Set(before.styles === after.styles ? before.artboards : []);
  const artboards = after.artboards.map((artboard) => (unchanged.has(artboard) ? artboard : settledArtboard(artboard, after)));
  const emptied = after.styles !== undefined && after.styles.length === 0;
  if (!emptied && artboards.every((artboard, i) => artboard === after.artboards[i])) return after;
  return produce(after, (draft) => {
    draft.artboards = artboards as Draft<Artboard>[];
    if (emptied) delete draft.styles;
  });
}

function rounded(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function styleSummary(style: StudioStyle): string {
  if (style.kind === "color") return style.gradient ? `${style.gradient.kind || "linear"} ${style.gradient.from} to ${style.gradient.to} ${rounded(style.gradient.angle)}°` : (style.color ?? "");
  if (style.kind === "effect") return style.shadow ? `shadow ${rounded(style.shadow.x)} ${rounded(style.shadow.y)} ${rounded(style.shadow.blur)} ${style.shadow.color}` : "";
  const size = style.fontSizePx !== undefined ? `${rounded(style.fontSizePx)}px${style.lineHeight !== undefined ? `/${rounded(style.lineHeight)}` : ""}` : style.lineHeight !== undefined ? `/${rounded(style.lineHeight)}` : "";
  return [style.fontId, style.fontWeight, style.italic ? "italic" : undefined, size, style.letterSpacing !== undefined ? `${rounded(style.letterSpacing)}em` : undefined].filter((part) => part !== undefined && part !== "").join(" ");
}
