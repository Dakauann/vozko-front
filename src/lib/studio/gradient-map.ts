import { blendHex, parseColor, type Rgba } from "./color";
import type { IssueCode } from "./validate";

export const GRADIENT_MAP_INTERPOLATIONS = ["perceptual", "srgb"] as const;

export type GradientMapInterpolation = (typeof GRADIENT_MAP_INTERPOLATIONS)[number];

export interface GradientMapStop {
  at: number;
  color: string;
}

export interface GradientMap {
  stops: GradientMapStop[];
  intensity: number;
  reverse?: boolean;
  interpolation?: GradientMapInterpolation | "";
}

export const GRADIENT_MAP_PRESETS = {
  noite: ["#1b1464", "#ffd166"],
  coral: ["#3d0c4b", "#ff7a6b"],
  oceano: ["#002b45", "#7ae7ff"],
  menta: ["#123b2e", "#b8f5d2"],
  vinho: ["#2a0612", "#f7b2c4"],
  sepia: ["#2b1a0a", "#f3e1c2"],
  neon: ["#20004d", "#00ffc6"],
  pb: ["#000000", "#ffffff"],
  "por-do-sol": ["#2d0a3d", "#e8505b", "#ffd27d"],
  aurora: ["#0b1d3a", "#2bb3a3", "#f4f1bb"],
} as const satisfies Record<string, readonly string[]>;

export type GradientMapPreset = keyof typeof GRADIENT_MAP_PRESETS;

export const GRADIENT_MAP_PRESET_IDS = Object.keys(GRADIENT_MAP_PRESETS) as GradientMapPreset[];

export const LUT_SIZE = 256;

const LUMA = [0.2126, 0.7152, 0.0722] as const;
const INTERPOLATION_VALUES = new Set<string>(["", ...GRADIENT_MAP_INTERPOLATIONS]);

function within(value: number, lo: number, hi: number): boolean {
  return Number.isFinite(value) && value >= lo && value <= hi;
}

export function isGradientMapPreset(id: string): id is GradientMapPreset {
  return Object.hasOwn(GRADIENT_MAP_PRESETS, id);
}

export function gradientMapOfPreset(id: GradientMapPreset): GradientMapStop[] {
  const colors = GRADIENT_MAP_PRESETS[id];
  return colors.map((color, i) => ({ at: i / (colors.length - 1), color }));
}

export function gradientMapIssue(map: GradientMap): IssueCode | null {
  if (map.stops.length < 2) return "invalid";
  let last = 0;
  for (const stop of map.stops) {
    if (!within(stop.at, 0, 1)) return "out_of_range";
    if (stop.at < last || parseColor(stop.color) === null) return "invalid";
    last = stop.at;
  }
  if (!INTERPOLATION_VALUES.has(map.interpolation ?? "")) return "unknown";
  return within(map.intensity, 0, 1) ? null : "out_of_range";
}

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function toDisplay(linear: number): number {
  const c = Math.min(Math.max(linear, 0), 1);
  return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
}

type Lab = [number, number, number];

function oklabOf(color: Rgba): Lab {
  const r = toLinear(color.r);
  const g = toLinear(color.g);
  const b = toLinear(color.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

function rgbOfOklab([L, a, b]: Lab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    toDisplay(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toDisplay(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toDisplay(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

function mixed(from: Rgba, to: Rgba, u: number, perceptual: boolean): [number, number, number, number] {
  const alpha = lerp(from.a, to.a, u) * 255;
  if (!perceptual) return [lerp(from.r, to.r, u), lerp(from.g, to.g, u), lerp(from.b, to.b, u), alpha];
  const a = oklabOf(from);
  const b = oklabOf(to);
  return [...rgbOfOklab([lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]), alpha];
}

function colorAt(stops: readonly { at: number; color: Rgba }[], t: number, perceptual: boolean): [number, number, number, number] {
  let k = 0;
  for (let i = 0; i < stops.length; i++) if (stops[i].at <= t) k = i;
  const first = stops[0];
  if (t <= first.at) return mixed(first.color, first.color, 0, false);
  if (k === stops.length - 1) return mixed(stops[k].color, stops[k].color, 0, false);
  const from = stops[k];
  const to = stops[k + 1];
  return mixed(from.color, to.color, (t - from.at) / (to.at - from.at), perceptual);
}

export function gradientMapLut(map: GradientMap): Uint8ClampedArray {
  const stops = map.stops.map((stop) => ({ at: stop.at, color: parseColor(stop.color) ?? { r: 0, g: 0, b: 0, a: 1 } }));
  const perceptual = (map.interpolation ?? "") !== "srgb";
  const lut = new Uint8ClampedArray(LUT_SIZE * 4);
  for (let i = 0; i < LUT_SIZE; i++) {
    const tone = i / (LUT_SIZE - 1);
    const rgba = colorAt(stops, map.reverse ? 1 - tone : tone, perceptual);
    for (let c = 0; c < 4; c++) lut[i * 4 + c] = Math.round(rgba[c]);
  }
  return lut;
}

export function lumaIndex(r: number, g: number, b: number): number {
  return Math.round(LUMA[0] * r + LUMA[1] * g + LUMA[2] * b);
}

export function mapGradientPixels(data: Uint8ClampedArray, lut: Uint8ClampedArray, intensity: number): void {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const at = lumaIndex(data[i], data[i + 1], data[i + 2]) * 4;
    const k = (intensity * lut[at + 3]) / 255;
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] + (lut[at + c] - data[i + c]) * k);
  }
}

export const DEFAULT_GRADIENT_MAP_PRESET: GradientMapPreset = "noite";

export function presetOfStops(stops: readonly GradientMapStop[]): GradientMapPreset | null {
  const same = (preset: GradientMapPreset) => {
    const wanted = gradientMapOfPreset(preset);
    return wanted.length === stops.length && wanted.every((stop, i) => Math.abs(stop.at - stops[i].at) < 1e-6 && stop.color.toLowerCase() === stops[i].color.toLowerCase());
  };
  return GRADIENT_MAP_PRESET_IDS.find(same) ?? null;
}

export function movedStop(map: GradientMap, index: number, at: number): GradientMap {
  const low = index > 0 ? map.stops[index - 1].at : 0;
  const high = index < map.stops.length - 1 ? map.stops[index + 1].at : 1;
  const clamped = Math.min(Math.max(at, low), high);
  return { ...map, stops: map.stops.map((stop, i) => (i === index ? { ...stop, at: clamped } : stop)) };
}

export function addedStop(map: GradientMap): GradientMap {
  const last = map.stops.length - 1;
  const from = map.stops[last - 1];
  const to = map.stops[last];
  const color = blendHex(from.color, to.color, 0.5) ?? to.color;
  return { ...map, stops: [...map.stops.slice(0, last), { at: (from.at + to.at) / 2, color }, to] };
}

export function removedStop(map: GradientMap, index: number): GradientMap {
  if (map.stops.length <= 2) return map;
  return { ...map, stops: map.stops.filter((_, i) => i !== index) };
}
