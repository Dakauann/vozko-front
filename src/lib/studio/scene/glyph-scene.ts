import { fullFrame, type Layer } from "../document";
import type { GlyphRun } from "../glyph-layout";
import type { TextMotion, Tile } from "../text-animation";
import { textPathData } from "../text-path";
import type { GlyphFrame } from "../text-glyphs";
import { glyphCells } from "../text-run-glyphs";
import { layerReach, paintedContent, stable } from "./raster";
import type { MixedParts } from "./paint-mix";
import type { GlyphNode, GlyphsSource } from "./scene";

interface Size {
  width: number;
  height: number;
}

function layerBox(layer: Layer, size: Size): Tile {
  const t = layer.transform;
  return { x: (t.x - t.w / 2) * size.width, y: (t.y - t.h / 2) * size.height, width: t.w * size.width, height: t.h * size.height };
}

function glyphSourceFor(frame: GlyphFrame, box: Tile, fontBasePx: number): (layer: Layer) => GlyphsSource {
  return (layer) => {
    const backdrop = layer.highlight && !frame.path ? { width: Math.round(box.width), height: Math.round(box.height) } : undefined;
    const style: Layer = { ...paintedContent(layer), id: "glyphs", text: "", transform: fullFrame(), curve: undefined, highlight: backdrop ? layer.highlight : undefined };
    const { cells, styles } = glyphCells(frame, layer);
    const padPx = layerReach({ ...style, highlight: undefined }, fontBasePx);
    const key = stable({ style: { ...style, id: undefined }, cells, styles, fontBasePx, padPx, backdrop });
    return { kind: "glyphs", key, layer: style, cells, fontBasePx, padPx, ...(styles ? { styles } : {}), ...(backdrop ? { backdrop } : {}) };
  };
}

export function glyphNode(frame: GlyphFrame, layer: Layer, motion: TextMotion | undefined, size: Size, fontBasePx: number, mixed: (source: (layer: Layer) => GlyphsSource) => MixedParts<GlyphsSource>): GlyphNode {
  const box = layerBox(layer, size);
  const path = frame.path;
  const run: GlyphRun = {
    box,
    align: layer.align || "left",
    content: glyphCells(frame, layer).content,
    backdrop: Boolean(layer.highlight) && !path,
    ...(path ? { path: { data: textPathData(path.textPath, box.width, box.height), offset: path.offset, align: path.textPath.align, upright: Boolean(path.textPath.upright), reverse: Boolean(path.textPath.reverse) } } : {}),
    ...(motion ? { motion } : {}),
  };
  const { parts, plan } = mixed(glyphSourceFor(frame, box, fontBasePx));
  return { parts, run, frame: { width: size.width, height: size.height }, ...(plan ? { plan } : {}) };
}
