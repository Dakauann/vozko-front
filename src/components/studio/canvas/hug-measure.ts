"use client";

import Konva from "konva";

import type { HugMeasure } from "@/lib/studio/auto-layout";
import { cssFontOf, DEFAULT_FONT_ID, DEFAULT_FONT_WEIGHT, type FontId } from "@/lib/studio/fonts";
import type { Layer } from "@/lib/studio/document";
import { hasRuns, textSpans } from "@/lib/studio/text-runs";

import { ensureFont } from "./ensure-font";
import { layoutLayerText, runFontsOf } from "./rich-measure";
import { textBlockProps, textFontProps } from "./text-props";

const PROBE_PX = 32;

export function createHugMeasure(onFontReady: () => void): HugMeasure {
  const waiting = new Set<string>();
  const waitFor = (fontId: FontId, weight: number, italic: boolean): boolean => {
    const css = cssFontOf(fontId, weight, italic, PROBE_PX);
    if (document.fonts.check(css)) return true;
    if (!waiting.has(css)) {
      waiting.add(css);
      ensureFont(fontId, weight, italic).then(
        () => {
          waiting.delete(css);
          onFontReady();
        },
        () => waiting.delete(css),
      );
    }
    return false;
  };
  return (layer, widthPx, canvas) => {
    if (typeof document === "undefined" || layer.type !== "text") return null;
    if (hasRuns(layer)) return richHug(layer, widthPx, canvas.height, waitFor);
    const fontId = layer.fontId ?? DEFAULT_FONT_ID;
    const weight = layer.fontWeight || DEFAULT_FONT_WEIGHT;
    const italic = Boolean(layer.italic);
    if (!waitFor(fontId, weight, italic)) return null;
    const font = textFontProps(layer, canvas.height);
    const block = textBlockProps(layer, widthPx ?? 0, 0);
    const node = new Konva.Text({ ...font, text: block.text, align: block.align, lineHeight: block.lineHeight, wrap: widthPx === null ? "none" : block.wrap, ...(widthPx === null ? {} : { width: widthPx }) });
    try {
      return { width: widthPx ?? node.width(), height: node.height() };
    } finally {
      node.destroy();
    }
  };
}

function richHug(layer: Layer, widthPx: number | null, fontBasePx: number, waitFor: (fontId: FontId, weight: number, italic: boolean) => boolean): { width: number; height: number } | null {
  const fonts = runFontsOf(textSpans(layer));
  if (!fonts.map((font) => waitFor(font.fontId, font.weight, font.italic)).every(Boolean)) return null;
  const layout = layoutLayerText(layer, { box: { x: 0, y: 0, width: widthPx ?? 0, height: 0 }, fontBasePx, wrap: widthPx !== null, truncate: false });
  return { width: widthPx ?? layout.width, height: layout.height };
}
