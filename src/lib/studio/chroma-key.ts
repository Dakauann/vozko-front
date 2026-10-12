import { editFieldValue, fieldKeyState, fieldValue, lanesIssue, setFieldKey, setFieldLane, toggleFieldKey, type AnimatedFields, type Lanes } from "./animated-fields";
import type { KeyState } from "./keyframe-edit";
import type { Keyframe } from "./keyframes";
import type { IssueCode } from "./validate";

export const CHROMA_PROPERTIES = ["similarity", "smoothness", "spill"] as const;
export type ChromaProperty = (typeof CHROMA_PROPERTIES)[number];

export interface ChromaKey {
  color: string;
  similarity: number;
  smoothness: number;
  spill: number;
  keyframes?: Lanes<ChromaProperty>;
}

export const CHROMA_RANGES: Record<ChromaProperty, readonly [number, number]> = {
  similarity: [0.001, 1],
  smoothness: [0.001, 1],
  spill: [0.001, 1],
};

export const CHROMA_PRESETS = { green: "#00ff00", blue: "#0099ff" } as const;
export type ChromaPreset = keyof typeof CHROMA_PRESETS;

export const CHROMA_DEFAULTS = { similarity: 0.4, smoothness: 0.08, spill: 0.1 } as const;

const CB = [-0.100644, -0.338572, 0.439216] as const;
const CR = [0.439216, -0.398942, -0.040274] as const;
const CHROMA_OFFSET = 0.501961;
const LUMA = [0.2126, 0.7152, 0.0722] as const;
const RAMP_EXPONENT = 1.5;
const LOW_CHROMA = 0.08;
const HEX_COLOR = /^#[0-9a-f]{6}$/;

export type Rgb = readonly [number, number, number];

export function newChromaKey(color: string = CHROMA_PRESETS.green): ChromaKey {
  return { color: color.toLowerCase(), ...CHROMA_DEFAULTS };
}

export const CHROMA_FIELDS: AnimatedFields<ChromaKey, ChromaProperty> = {
  staticValue: (key, property) => key[property],
  withStatic: (key, property, value) => ({ ...key, [property]: value }),
  range: (property) => CHROMA_RANGES[property],
};

export function chromaValue(key: ChromaKey, property: ChromaProperty, localMs: number): number {
  return fieldValue(CHROMA_FIELDS, key, property, localMs);
}

export function chromaAt(key: ChromaKey, localMs: number): ChromaKey {
  if (!key.keyframes) return key;
  return { color: key.color, similarity: chromaValue(key, "similarity", localMs), smoothness: chromaValue(key, "smoothness", localMs), spill: chromaValue(key, "spill", localMs) };
}

export function setChromaKey(key: ChromaKey, property: ChromaProperty, atMs: number, value: number): ChromaKey {
  return setFieldKey(CHROMA_FIELDS, key, property, atMs, value);
}

export function setChromaLane(key: ChromaKey, property: ChromaProperty, frames: readonly Keyframe[]): ChromaKey {
  return setFieldLane(CHROMA_FIELDS, key, property, frames);
}

export function toggleChromaKey(key: ChromaKey, property: ChromaProperty, atMs: number): ChromaKey {
  return toggleFieldKey(CHROMA_FIELDS, key, property, atMs);
}

export function chromaKeyState(key: ChromaKey, property: ChromaProperty, localMs: number | null): KeyState {
  return fieldKeyState(key, property, localMs);
}

export function editChromaValue(key: ChromaKey, property: ChromaProperty, value: number, localMs: number | null): ChromaKey | null {
  return editFieldValue(CHROMA_FIELDS, key, property, value, localMs);
}

function within(value: number, [low, high]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= low && value <= high;
}

export function chromaIssue(key: ChromaKey): IssueCode | null {
  if (!HEX_COLOR.test(key.color)) return "invalid";
  for (const property of CHROMA_PROPERTIES) if (!within(key[property], CHROMA_RANGES[property])) return "out_of_range";
  return lanesIssue(key.keyframes ?? {}, (property) => CHROMA_RANGES[property as ChromaProperty] ?? null);
}

function dot(rgb: Rgb, weights: Rgb): number {
  return rgb[0] * weights[0] + rgb[1] * weights[1] + rgb[2] * weights[2];
}

export function hexRgb(color: string): Rgb {
  const value = parseInt(color.slice(1, 7), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export function chromaOf(rgb: Rgb): readonly [number, number] {
  return [dot(rgb, CB) + CHROMA_OFFSET, dot(rgb, CR) + CHROMA_OFFSET];
}

function ramp(value: number): number {
  return Math.min(1, Math.max(0, value)) ** RAMP_EXPONENT;
}

function keyDistance(keyChroma: readonly [number, number], rgb: Rgb): number {
  const [cb, cr] = chromaOf(rgb);
  return Math.hypot(cb - keyChroma[0], cr - keyChroma[1]);
}

function keyed(key: ChromaKey, distance: number, rgb: Rgb): { alpha: number; rgb: Rgb } {
  const base = distance - key.similarity;
  const spill = ramp(base / key.spill);
  const luma = dot(rgb, LUMA);
  return { alpha: ramp(base / key.smoothness), rgb: [luma + (rgb[0] - luma) * spill, luma + (rgb[1] - luma) * spill, luma + (rgb[2] - luma) * spill] };
}

export function chromaPixel(key: ChromaKey, rgb: Rgb): { alpha: number; rgb: Rgb } {
  return keyed(key, keyDistance(chromaOf(hexRgb(key.color)), rgb), rgb);
}

function straightAt(data: Uint8ClampedArray, i: number): Rgb {
  return [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
}

function cornerDistances(data: Uint8ClampedArray, width: number, height: number, keyChroma: readonly [number, number]): Float32Array {
  const corners = new Float32Array((width + 1) * (height + 1));
  const clampX = (x: number) => Math.min(width - 1, Math.max(0, x));
  const clampY = (y: number) => Math.min(height - 1, Math.max(0, y));
  for (let cy = 0; cy <= height; cy++) {
    for (let cx = 0; cx <= width; cx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (const y of [clampY(cy - 1), clampY(cy)]) {
        for (const x of [clampX(cx - 1), clampX(cx)]) {
          const i = (y * width + x) * 4;
          const alpha = data[i + 3] / 255;
          r += (data[i] / 255) * alpha;
          g += (data[i + 1] / 255) * alpha;
          b += (data[i + 2] / 255) * alpha;
          a += alpha;
        }
      }
      corners[cy * (width + 1) + cx] = keyDistance(keyChroma, a > 0 ? [r / a, g / a, b / a] : [0, 0, 0]);
    }
  }
  return corners;
}

export function keyImageData(data: Uint8ClampedArray, width: number, height: number, key: ChromaKey): void {
  if (width <= 0 || height <= 0) return;
  const keyChroma = chromaOf(hexRgb(key.color));
  const corners = cornerDistances(data, width, height, keyChroma);
  const row = width + 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      const rgb = straightAt(data, i);
      const around = corners[y * row + x] + corners[y * row + x + 1] + corners[(y + 1) * row + x] + corners[(y + 1) * row + x + 1];
      const out = keyed(key, (keyDistance(keyChroma, rgb) + 2 * around) / 9, rgb);
      data[i] = out.rgb[0] * 255;
      data[i + 1] = out.rgb[1] * 255;
      data[i + 2] = out.rgb[2] * 255;
      data[i + 3] = data[i + 3] * out.alpha;
    }
  }
}

export function vividChroma(rgb: Rgb): boolean {
  const [cb, cr] = chromaOf(rgb);
  return Math.hypot(cb - CHROMA_OFFSET, cr - CHROMA_OFFSET) >= LOW_CHROMA;
}

export function lowChroma(color: string): boolean {
  return !vividChroma(hexRgb(color));
}
