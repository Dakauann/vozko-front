import { counterText, counterValueAt, formatCounterNumber, type Counter } from "./counter";
import type { Clip, Layer } from "./document";
import { pathOffsetAt, type TextPath } from "./text-path";
import { counterTextRuns } from "./text-runs";

export interface GlyphFrame {
  counter?: { counter: Counter; value: number };
  path?: { textPath: TextPath; offset: number };
}

function composesGlyphs(clip: Pick<Clip, "type" | "layer" | "counter" | "textPath">): boolean {
  return clip.type === "overlay" && clip.layer?.type === "text" && (clip.counter !== undefined || clip.textPath !== undefined);
}

export function glyphFrameAt(clip: Clip, localMs: number): GlyphFrame | undefined {
  if (!composesGlyphs(clip)) return undefined;
  return {
    ...(clip.counter ? { counter: { counter: clip.counter, value: counterValueAt(clip, localMs) } } : {}),
    ...(clip.textPath ? { path: { textPath: clip.textPath, offset: pathOffsetAt(clip, localMs) } } : {}),
  };
}

export function lineText(layer: Pick<Layer, "text">): string {
  return (layer.text ?? "").replace(/\s+/g, " ");
}

export function shownLayer(layer: Layer, frame: GlyphFrame | undefined): Layer {
  const counted = frame?.counter;
  if (!counted) return layer;
  const { counter, value } = counted;
  return { ...layer, text: counterText(counter, value), runs: counterTextRuns(layer, counter, formatCounterNumber(value, counter.decimals, counter.locale, counter.grouping)) };
}
