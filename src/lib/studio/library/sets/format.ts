import type { CanvasSize, Layer } from "../../document";
import { pathToSubpaths } from "../../path-nodes";
import type { ArtPart, SvgTarget, VectorArt } from "../../svg-import";
import type { LibraryLocale } from "../model";
import { previewSvg } from "../preview";

export const ICON_WEIGHTS = ["regular", "thin", "light", "bold", "fill", "duotone"] as const;

export type IconWeight = (typeof ICON_WEIGHTS)[number];

export const ICON_FRAME = 256;

export const EMOJI_GROUPS = ["smileys", "people", "animals", "food", "travel", "activities", "objects", "symbols", "flags"] as const;

export type EmojiGroup = (typeof EMOJI_GROUPS)[number];

export type Names = readonly [en: string, pt: string, es: string, de: string];

export const NAME_ORDER: readonly LibraryLocale[] = ["en", "pt", "es", "de"];

export interface IconIndexEntry {
  n: string;
  l: Names;
  t: readonly string[];
  p: readonly string[];
}

export type IconPart = string | readonly [string, number];

export type IconPaths = readonly IconPart[];

export type StrokeShape = Partial<Pick<Layer, "lineCap" | "lineJoin" | "miterLimit" | "dashArray" | "dashOffset">>;

export interface PartStyle {
  o?: number;
  e?: 1;
  s?: string;
  w?: number;
  k?: StrokeShape;
}

export type EmojiPart = readonly [path: string, fill: string] | readonly [path: string, fill: string, style: PartStyle];

export interface EmojiArt {
  w: number;
  h: number;
  p: readonly EmojiPart[];
}

export interface EmojiIndexEntry {
  id: string;
  g: number;
  l: Names;
  t: readonly string[];
  p: readonly string[];
  k: number;
  i: number;
}

export interface SetNotice {
  id: string;
  name: string;
  version: string;
  url: string;
  license: string;
  text: string;
}

export function localizedNames(names: Names): Record<LibraryLocale, string> {
  return { en: names[0], pt: names[1], es: names[2], de: names[3] };
}

export function iconArt(paths: IconPaths, ink: string): VectorArt {
  const parts = paths.map((part): ArtPart => {
    const [data, opacity] = typeof part === "string" ? [part, 1] : part;
    return { subpaths: pathToSubpaths(data), open: false, opacity, fill: ink };
  });
  return { frame: { x: 0, y: 0, width: ICON_FRAME, height: ICON_FRAME }, parts };
}

function emojiPart([data, fill, style]: EmojiPart): ArtPart {
  const part: ArtPart = { subpaths: pathToSubpaths(data), open: fill === "", opacity: style?.o ?? 1 };
  if (fill !== "") part.fill = fill;
  if (style?.s && style.w) {
    part.stroke = style.s;
    part.strokeWidth = style.w;
    part.strokeShape = style.k ?? {};
  }
  if (style?.e) part.evenOdd = true;
  return part;
}

export function emojiPalette(art: EmojiArt | undefined): string[] {
  const colors = (art?.p ?? []).flatMap(([, fill, style]) => [...(fill !== "" ? [fill] : []), ...(style?.s && style.w ? [style.s] : [])]);
  return [...new Set(colors.map((color) => color.toLowerCase()))];
}

export function emojiArt(art: EmojiArt): VectorArt {
  return { frame: { x: 0, y: 0, width: art.w, height: art.h }, parts: art.p.map(emojiPart) };
}

function attribute(name: string, value: string | number | undefined): string {
  return value === undefined ? "" : ` ${name}="${value}"`;
}

export function iconMarkup(paths: IconPaths): string {
  const body = paths.map((part) => {
    const [data, opacity] = typeof part === "string" ? [part, 1] : part;
    return `<path d="${data}" fill="currentColor"${opacity < 1 ? attribute("opacity", opacity) : ""}/>`;
  });
  return previewSvg(body.join(""), ICON_FRAME);
}

export function emojiMarkup(art: EmojiArt): string {
  const body = art.p.map(([data, fill, style]) => {
    const stroke = style?.s && style.w ? attribute("stroke", style.s) + attribute("stroke-width", style.w) + attribute("stroke-linecap", style.k?.lineCap) + attribute("stroke-linejoin", style.k?.lineJoin) : "";
    return `<path d="${data}"${attribute("fill", fill === "" ? "none" : fill)}${style?.o !== undefined ? attribute("opacity", style.o) : ""}${style?.e ? attribute("fill-rule", "evenodd") : ""}${stroke}/>`;
  });
  return previewSvg(body.join(""), art.w, art.h);
}

export function svgDataUrl(markup: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

export function centeredTarget(canvas: CanvasSize, share: number, ratio = 1): SvgTarget {
  const side = Math.min(canvas.width, canvas.height) * share;
  return { center: { x: canvas.width / 2, y: canvas.height / 2 }, width: ratio >= 1 ? side : side * ratio, height: ratio >= 1 ? side / ratio : side, rotation: 0 };
}
