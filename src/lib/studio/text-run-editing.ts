import type { Layer } from "./document";
import { DEFAULT_FONT_WEIGHT, nearestFontWeight, STUDIO_FONTS, type FontId } from "./fonts";
import { baseRunStyle, hasRuns, LAYER_RUN_KEYS, rangeValue, runLength, textStylePatch, type LayerRunKey, type RunStylePatch, type TextRange, type TextRun } from "./text-runs";

export const BOLD_WEIGHT = 700;

export interface TextEdit {
  text: string;
  runs: TextRun[] | undefined;
}

export type RunToggle = "bold" | "italic" | "underline";

type Styled = Parameters<typeof rangeValue>[0];

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

export function codePointIndex(text: string, utf16: number): number {
  const end = Math.max(0, Math.min(utf16, text.length));
  let count = 0;
  for (let i = 0; i < end; i++) {
    if (isHighSurrogate(text.charCodeAt(i)) && i + 1 < text.length) i++;
    count++;
  }
  return count;
}

export function utf16Index(text: string, codePoint: number): number {
  let offset = 0;
  let count = 0;
  for (const char of text) {
    if (count >= codePoint) break;
    offset += char.length;
    count++;
  }
  return offset;
}

export function styleRange(range: TextRange | null, length: number): TextRange | null {
  if (!range) return null;
  const start = Math.max(0, Math.min(range.start, range.end));
  const end = Math.min(length, Math.max(range.start, range.end));
  if (start >= end || (start <= 0 && end >= length)) return null;
  return { start, end };
}

function italicAllowed(layer: Styled, range: TextRange | null, length: number): boolean {
  const font = rangeValue(layer, range, "fontId", length);
  return font.mixed || STUDIO_FONTS[font.value].italic;
}

export function toggledPatch(layer: Styled, range: TextRange | null, toggle: RunToggle, length: number = runLength(layer)): RunStylePatch | null {
  if (toggle === "bold") {
    const weight = rangeValue(layer, range, "fontWeight", length);
    const font = rangeValue(layer, range, "fontId", length);
    const target = !weight.mixed && weight.value >= BOLD_WEIGHT ? DEFAULT_FONT_WEIGHT : BOLD_WEIGHT;
    return { fontWeight: font.mixed ? target : nearestFontWeight(font.value, target) };
  }
  if (toggle === "italic" && !italicAllowed(layer, range, length)) return null;
  const current = rangeValue(layer, range, toggle, length);
  return { [toggle]: !(!current.mixed && current.value) };
}

export function fontPatch(layer: Styled, range: TextRange | null, fontId: FontId, length: number = runLength(layer)): RunStylePatch {
  const weight = rangeValue(layer, range, "fontWeight", length);
  return {
    fontId,
    ...(weight.mixed ? {} : { fontWeight: nearestFontWeight(fontId, weight.value) }),
    ...(STUDIO_FONTS[fontId].italic ? {} : { italic: false }),
  };
}

export function wholeTextLayerPatch(layer: Layer, patch: Partial<Layer>): Partial<Layer> {
  if (!hasRuns(layer)) return patch;
  const runPatch: RunStylePatch = {};
  for (const key of LAYER_RUN_KEYS) if (key in patch) Object.assign(runPatch, { [key]: patch[key] ?? null });
  if (Object.keys(runPatch).length === 0) return patch;
  return { ...patch, ...textStylePatch(layer, null, runPatch) };
}

export function wholeTextField<T>(layer: Layer, key: LayerRunKey, read: (layer: Layer) => T): T | null {
  if (!hasRuns(layer)) return read(layer);
  const value = rangeValue(layer, null, key);
  if (value.mixed) return null;
  return read(value.value === baseRunStyle(layer)[key] ? layer : { ...layer, [key]: value.value });
}
