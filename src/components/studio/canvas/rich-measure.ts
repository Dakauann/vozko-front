"use client";

import Konva from "konva";

import type { Layer } from "@/lib/studio/document";
import { layoutRichText, type RichLayout, type RichMeasure, type RunFont } from "@/lib/studio/rich-text-layout";
import { textSpans, type RunStyle, type TextSpan } from "@/lib/studio/text-runs";

import { ensureFont, konvaFontFamily, konvaFontStyle } from "./ensure-font";
import { DEFAULT_LINE_HEIGHT } from "./text-props";

const FALLBACK_ASCENT = 0.91;
const FALLBACK_DESCENT = 0.21;

let context: CanvasRenderingContext2D | null = null;

function measuring(): CanvasRenderingContext2D {
  context ??= Konva.Util.createCanvasElement().getContext("2d");
  if (!context) throw new Error("studio text cannot be measured without a 2d canvas");
  return context;
}

export function runFontCss(font: RunFont): string {
  return `${konvaFontStyle(font.fontId, font.weight, font.italic)} normal ${font.sizePx}px ${konvaFontFamily(font.fontId)}`;
}

function prepared(font: RunFont): CanvasRenderingContext2D {
  const ctx = measuring();
  ctx.font = runFontCss(font);
  ctx.fontKerning = font.letterSpacingPx !== 0 ? "none" : "auto";
  return ctx;
}

export const canvasMeasure: RichMeasure = {
  width: (text, font) => prepared(font).measureText(text).width,
  metrics: (font) => {
    const sample = prepared(font).measureText("M");
    return { ascent: sample.fontBoundingBoxAscent ?? FALLBACK_ASCENT * font.sizePx, descent: sample.fontBoundingBoxDescent ?? FALLBACK_DESCENT * font.sizePx };
  },
};

export function runFontsOf(spans: readonly { style: RunStyle }[]): { fontId: RunStyle["fontId"]; weight: number; italic: boolean }[] {
  const seen = new Map<string, { fontId: RunStyle["fontId"]; weight: number; italic: boolean }>();
  for (const { style } of spans) seen.set(`${style.fontId}:${style.fontWeight}:${style.italic}`, { fontId: style.fontId, weight: style.fontWeight, italic: style.italic });
  return [...seen.values()];
}

export async function ensureRunFonts(spans: readonly TextSpan[]): Promise<void> {
  await Promise.all(runFontsOf(spans).map((font) => ensureFont(font.fontId, font.weight, font.italic)));
}

export interface RichBlock {
  box: { x: number; y: number; width: number; height: number };
  fontBasePx: number;
  wrap?: boolean;
  truncate?: boolean;
}

export function layoutLayerText(layer: Layer, block: RichBlock): RichLayout {
  return layoutRichText({
    spans: textSpans(layer),
    box: block.box,
    align: layer.align || "left",
    lineHeight: layer.lineHeight || DEFAULT_LINE_HEIGHT,
    fontBasePx: block.fontBasePx,
    measure: canvasMeasure,
    wrap: block.wrap ?? true,
    truncate: block.truncate ?? true,
  });
}
