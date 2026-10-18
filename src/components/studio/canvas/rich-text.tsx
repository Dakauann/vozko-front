"use client";

import type Konva from "konva";
import { useEffect, useMemo, type ReactNode } from "react";
import { Group, Text } from "react-konva";

import type { Layer } from "@/lib/studio/document";
import { curvePath } from "@/lib/studio/paint";
import { baselineShift, curvedGlyphs, type RunFont } from "@/lib/studio/rich-text-layout";
import { flowsInLines } from "@/lib/studio/text-animation";
import { baseRunStyle, collapsedSpans, styledLayer, textSpans, type RunStyle } from "@/lib/studio/text-runs";

import { gradientFill } from "./konva-paint";
import { canvasMeasure, layoutLayerText, runFontsOf } from "./rich-measure";
import type { ContentProps } from "./rich-content";
import { DEFAULT_LINE_HEIGHT, textFontProps } from "./text-props";
import { useFontsReady } from "./use-fonts-ready";

export type TextPaint = Konva.ShapeConfig;

interface RichTextProps extends ContentProps {
  paint: TextPaint;
  highlight: (curved: boolean) => ReactNode;
}

interface Piece {
  key: string;
  text: string;
  style: RunStyle;
  font: RunFont;
  x: number;
  y: number;
  rotation: number;
  inner: number;
}

function piecesOf(layer: Layer, width: number, height: number, fontBasePx: number, curved: boolean): Piece[] {
  const lineHeight = layer.lineHeight || DEFAULT_LINE_HEIGHT;
  if (curved) {
    const glyphs = curvedGlyphs({ spans: collapsedSpans(layer), path: curvePath(width, height, layer.curve ?? 0), lineHeight, fontBasePx, measure: canvasMeasure });
    return glyphs.map((glyph, i) => ({ key: `g${i}`, text: glyph.text, style: glyph.style, font: glyph.font, x: glyph.x, y: glyph.y, rotation: glyph.rotation, inner: -glyph.lineHeightPx / 2 }));
  }
  const layout = layoutLayerText(layer, { box: { x: 0, y: 0, width, height }, fontBasePx });
  return layout.lines.flatMap((line, l) =>
    line.segments.map((segment, s) => ({ key: `s${l}:${s}`, text: segment.text, style: segment.style, font: segment.font, x: segment.x, y: line.baseline - baselineShift(segment.font, lineHeight, canvasMeasure), rotation: 0, inner: 0 })),
  );
}

function fillOf(layer: Layer, piece: Piece, base: RunStyle, width: number, height: number): Konva.ShapeConfig {
  if (piece.style.fill.toLowerCase() !== base.fill.toLowerCase()) return { fill: piece.style.fill };
  if (layer.gradient) return gradientFill(layer.gradient, { x: -piece.x, y: -piece.y, width, height });
  return { fill: layer.fill ? layer.fill : undefined };
}

export function RichTextContent({ layer, width, height, fontBasePx, ready, fail, paint, highlight }: RichTextProps) {
  const curved = !flowsInLines(layer);
  const spans = useMemo(() => (curved ? collapsedSpans(layer) : textSpans(layer)), [layer, curved]);
  const fonts = useMemo(() => runFontsOf(spans), [spans]);
  const loaded = useFontsReady(fonts, fail);

  useEffect(() => {
    if (loaded.ready) ready();
  }, [loaded.ready, layer, width, height, fontBasePx, ready]);

  const pieces = useMemo(() => (loaded.ready ? piecesOf(layer, width, height, fontBasePx, curved) : []), [loaded.ready, layer, width, height, fontBasePx, curved]);
  const base = baseRunStyle(layer);
  const lineHeight = layer.lineHeight || DEFAULT_LINE_HEIGHT;

  return (
    <>
      {highlight(curved)}
      {pieces.map((piece) => {
        const node = (
          <Text
            key={piece.key}
            x={curved ? 0 : piece.x}
            y={curved ? piece.inner : piece.y}
            text={piece.text}
            lineHeight={lineHeight}
            textDecoration={piece.style.underline ? "underline" : ""}
            {...textFontProps(styledLayer(layer, piece.style), fontBasePx)}
            {...paint}
            {...fillOf(layer, piece, base, width, height)}
          />
        );
        return curved ? (
          <Group key={piece.key} x={piece.x} y={piece.y} rotation={piece.rotation}>
            {node}
          </Group>
        ) : (
          node
        );
      })}
    </>
  );
}
