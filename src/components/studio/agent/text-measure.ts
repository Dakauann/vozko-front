"use client";

import { estimateTextWidth, type TextMeasure } from "@/lib/studio/agent/design-check";
import { DEFAULT_FONT_ID, DEFAULT_FONT_WEIGHT, cssFontOf } from "@/lib/studio/fonts";

let context: CanvasRenderingContext2D | null | undefined;

function drawing(): CanvasRenderingContext2D | null {
  if (context === undefined) context = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  return context;
}

export const measureText: TextMeasure = (text, layer, fontPx) => {
  const ctx = drawing();
  if (!ctx) return estimateTextWidth(text, layer, fontPx);
  ctx.font = cssFontOf(layer.fontId ?? DEFAULT_FONT_ID, layer.fontWeight || DEFAULT_FONT_WEIGHT, Boolean(layer.italic), fontPx);
  return ctx.measureText(text).width + [...text].length * (layer.letterSpacing ?? 0) * fontPx;
};
