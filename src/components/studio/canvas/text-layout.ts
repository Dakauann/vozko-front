"use client";

import Konva from "konva";

import { DEFAULT_FONT_ID, DEFAULT_FONT_WEIGHT } from "@/lib/studio/fonts";
import type { Layer } from "@/lib/studio/document";
import type { LaidLine } from "@/lib/studio/text-animation";
import { laidLines } from "@/lib/studio/text-layout";
import { richLaidLines } from "@/lib/studio/rich-text-layout";
import { hasRuns, textSpans } from "@/lib/studio/text-runs";

import { ensureFont } from "./ensure-font";
import { ensureRunFonts, layoutLayerText } from "./rich-measure";
import { textBlockProps, textFontProps } from "./text-props";

export async function measureTextLayout(layer: Layer, widthPx: number, heightPx: number, fontBasePx: number): Promise<LaidLine[]> {
  const t = layer.transform;
  const box = { x: (t.x - t.w / 2) * widthPx, y: (t.y - t.h / 2) * heightPx, width: t.w * widthPx, height: t.h * heightPx };
  if (hasRuns(layer)) {
    await ensureRunFonts(textSpans(layer));
    return richLaidLines(layoutLayerText(layer, { box, fontBasePx }));
  }
  await ensureFont(layer.fontId ?? DEFAULT_FONT_ID, layer.fontWeight || DEFAULT_FONT_WEIGHT, Boolean(layer.italic));
  const font = textFontProps(layer, fontBasePx);
  const block = textBlockProps(layer, box.width, box.height);
  const node = new Konva.Text({ ...block, ...font });
  try {
    return laidLines({
      lines: node.textArr.map((line) => ({ text: line.text, width: line.width })),
      align: block.align,
      box,
      lineHeightPx: block.lineHeight * font.fontSize,
      letterSpacingPx: font.letterSpacing,
      measure: (text) => node.measureSize(text).width,
    });
  } finally {
    node.destroy();
  }
}
