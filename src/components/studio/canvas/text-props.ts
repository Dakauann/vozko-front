import { DEFAULT_FONT_ID, DEFAULT_FONT_WEIGHT } from "@/lib/studio/fonts";
import type { Layer, TextAlign } from "@/lib/studio/document";

import { konvaFontFamily, konvaFontStyle } from "./ensure-font";

export const DEFAULT_LINE_HEIGHT = 1.2;

export interface TextFontProps {
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
  letterSpacing: number;
}

export interface TextBlockProps {
  text: string;
  width: number;
  height: number;
  verticalAlign: "middle";
  align: TextAlign;
  wrap: "word";
  lineHeight: number;
}

export function textFontProps(layer: Layer, fontBasePx: number): TextFontProps {
  const fontId = layer.fontId ?? DEFAULT_FONT_ID;
  const fontSize = (layer.fontSize ?? 0) * fontBasePx;
  return {
    fontFamily: konvaFontFamily(fontId),
    fontStyle: konvaFontStyle(fontId, layer.fontWeight || DEFAULT_FONT_WEIGHT, Boolean(layer.italic)),
    fontSize,
    letterSpacing: (layer.letterSpacing ?? 0) * fontSize,
  };
}

export function textBlockProps(layer: Layer, width: number, height: number): TextBlockProps {
  return { text: layer.text ?? "", width, height, verticalAlign: "middle", align: layer.align || "left", wrap: "word", lineHeight: layer.lineHeight || DEFAULT_LINE_HEIGHT };
}
