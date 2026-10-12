"use client";

import Konva from "konva";

import type { Layer } from "@/lib/studio/document";
import { DEFAULT_FONT_ID, DEFAULT_FONT_WEIGHT } from "@/lib/studio/fonts";
import { measureCell, sheetLayers, sheetLayout, type MeasuredCell } from "@/lib/studio/glyph-layout";
import { fittedRatio, type GlyphSheetPicture } from "@/lib/studio/render/renderer";
import { runFont } from "@/lib/studio/rich-text-layout";
import type { GlyphsSource } from "@/lib/studio/scene/scene";
import { baseRunStyle, styledLayer, type RunStyle } from "@/lib/studio/text-runs";

import { ensureFont } from "./ensure-font";
import { rasterizeRegion } from "./rasterize";
import { canvasMeasure } from "./rich-measure";
import { textBlockProps, textFontProps } from "./text-props";

interface CellLook {
  layer: Layer;
  style: RunStyle;
}

function cellLooks(source: GlyphsSource): CellLook[] {
  const base = baseRunStyle(source.layer);
  return source.cells.map((_, index) => {
    const style = source.styles?.[index] ?? base;
    return { style, layer: source.styles ? styledLayer(source.layer, style) : source.layer };
  });
}

function paintOf(look: CellLook, text: string): Partial<Layer> {
  const fields = { fill: look.layer.fill, fontId: look.layer.fontId, fontWeight: look.layer.fontWeight, fontSize: look.layer.fontSize, italic: look.layer.italic, letterSpacing: look.layer.letterSpacing };
  return look.style.underline ? { ...fields, runs: [{ start: 0, end: [...text].length, underline: true }] } : fields;
}

function rise(style: RunStyle, fontBasePx: number): number {
  const metrics = canvasMeasure.metrics(runFont(style, fontBasePx));
  return (metrics.ascent - metrics.descent) / 2;
}

export async function rasterizeGlyphSheet(source: GlyphsSource, pixelRatio: number): Promise<GlyphSheetPicture> {
  const layer = source.layer;
  const looks = cellLooks(source);
  await Promise.all([...new Set(looks.map((look) => look.layer))].map((styled) => ensureFont(styled.fontId ?? DEFAULT_FONT_ID, styled.fontWeight || DEFAULT_FONT_WEIGHT, Boolean(styled.italic))));
  const block = textBlockProps(layer, 1, 1);
  const fonts = looks.map((look) => textFontProps(look.layer, source.fontBasePx));
  const rises = source.styles ? looks.map((look) => rise(look.style, source.fontBasePx)) : looks.map(() => 0);
  const highest = Math.max(0, ...rises);
  const cells: MeasuredCell[] = source.cells.map((text, index) => {
    const node = new Konva.Text({ ...fonts[index], text: "" });
    try {
      const measured = measureCell(text, (part) => node.measureSize(part).width, fonts[index].letterSpacing);
      return source.styles ? { ...measured, paint: paintOf(looks[index], text), dropPx: highest - rises[index] } : measured;
    } finally {
      node.destroy();
    }
  });
  const fontSizePx = Math.max(...fonts.map((font) => font.fontSize));
  const sheet = sheetLayout(cells, block.lineHeight * fontSizePx, source.padPx, source.backdrop);
  const region = { x: 0, y: 0, width: sheet.width, height: sheet.height };
  const image = await rasterizeRegion(sheetLayers(layer, sheet, fontSizePx), sheet.width, sheet.height, region, { fontBasePx: source.fontBasePx, pixelRatio: fittedRatio(sheet, pixelRatio) });
  return { image, sheet };
}
