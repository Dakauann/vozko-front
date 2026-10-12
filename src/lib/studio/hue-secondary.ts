import type { IssueCode } from "./validate";

export interface HueSecondary {
  hue: number;
  width: number;
  softness?: number;
  desaturate?: number;
  shift?: number;
  saturation?: number;
}

export type HueField = keyof HueSecondary;

export const HUE_FIELDS = ["hue", "width", "softness", "desaturate", "shift", "saturation"] as const satisfies readonly HueField[];

export const HUE_RANGES: Record<HueField, readonly [number, number]> = {
  hue: [0, 360],
  width: [0, 360],
  softness: [0, 180],
  desaturate: [0, 100],
  shift: [-180, 180],
  saturation: [-100, 100],
};

export const HUE_NAMES = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "magenta"] as const;

export type HueName = (typeof HUE_NAMES)[number];

export const HUE_CENTERS: Record<HueName, number> = { red: 0, orange: 30, yellow: 60, green: 120, cyan: 180, blue: 225, purple: 270, magenta: 315 };

export const DEFAULT_HUE_SECONDARY: HueSecondary = { hue: 0, width: 40, softness: 30, desaturate: 100 };

export const CHROMA_KNEE = 0.1;

const LUMA = [0.2126, 0.7152, 0.0722] as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function within(value: number, [low, high]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= low && value <= high;
}

export function hueFault(secondary: HueSecondary): HueField | null {
  for (const field of HUE_FIELDS) {
    const value = secondary[field];
    if (value !== undefined && !within(value, HUE_RANGES[field])) return field;
  }
  return null;
}

export function hueIssue(secondary: HueSecondary): IssueCode | null {
  return hueFault(secondary) ? "out_of_range" : null;
}

export function isNeutralHue(secondary: HueSecondary | undefined): boolean {
  return !secondary || ((secondary.desaturate ?? 0) === 0 && (secondary.shift ?? 0) === 0 && (secondary.saturation ?? 0) === 0);
}

export function storedHue(secondary: HueSecondary | undefined): HueSecondary | undefined {
  if (!secondary || isNeutralHue(secondary)) return undefined;
  const stored: HueSecondary = { hue: secondary.hue, width: secondary.width };
  for (const field of ["softness", "desaturate", "shift", "saturation"] as const) {
    const value = secondary[field];
    if (value !== undefined && value !== 0) stored[field] = value;
  }
  return stored;
}

export interface HueUniforms {
  center: number;
  half: number;
  soft: number;
  desaturate: number;
  shift: number;
  saturation: number;
}

export function hueUniforms(secondary: HueSecondary): HueUniforms {
  return {
    center: (((secondary.hue % 360) + 360) % 360) / 360,
    half: secondary.width / 720,
    soft: (secondary.softness ?? 0) / 360,
    desaturate: (secondary.desaturate ?? 0) / 100,
    shift: (secondary.shift ?? 0) / 360,
    saturation: (secondary.saturation ?? 0) / 100,
  };
}

function hueOf(r: number, g: number, b: number, high: number, chroma: number): number {
  let h: number;
  if (high === r) h = (g - b) / chroma;
  else if (high === g) h = (b - r) / chroma + 2;
  else h = (r - g) / chroma + 4;
  h /= 6;
  return h < 0 ? h + 1 : h;
}

export function hueWeight(h: number, u: HueUniforms): number {
  const gap = Math.abs(h - u.center);
  const distance = Math.min(gap, 1 - gap);
  if (distance <= u.half) return 1;
  if (u.soft <= 0) return 0;
  const t = clamp01(1 - (distance - u.half) / u.soft);
  return t * t * (3 - 2 * t);
}

function channelOf(n: number, h: number, s: number, v: number): number {
  const k = (n + h * 6) % 6;
  return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
}

export function huePixel(rgb: readonly number[], u: HueUniforms): number[] {
  const [r, g, b] = rgb;
  const high = Math.max(r, g, b);
  const low = Math.min(r, g, b);
  const chroma = high - low;
  let out = [r, g, b];
  let weight = 0;
  if (chroma > 0) {
    const h = hueOf(r, g, b, high, chroma);
    weight = hueWeight(h, u) * clamp01(chroma / CHROMA_KNEE);
    if (weight > 0 && (u.shift !== 0 || u.saturation !== 0)) {
      const turned = (((h + u.shift * weight) % 1) + 1) % 1;
      const s = clamp01((chroma / high) * (1 + u.saturation * weight));
      out = [channelOf(5, turned, s, high), channelOf(3, turned, s, high), channelOf(1, turned, s, high)];
    }
  }
  const amount = u.desaturate * (1 - weight);
  if (amount <= 0) return out;
  const l = LUMA[0] * out[0] + LUMA[1] * out[1] + LUMA[2] * out[2];
  return out.map((v) => clamp01(v + (l - v) * amount));
}

export function hueImageData(data: Uint8ClampedArray, u: HueUniforms): void {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const [r, g, b] = huePixel([data[i] / 255, data[i + 1] / 255, data[i + 2] / 255], u);
    data[i] = Math.round(r * 255);
    data[i + 1] = Math.round(g * 255);
    data[i + 2] = Math.round(b * 255);
  }
}

export function hueOfColor(rgb: readonly number[]): number | null {
  const [r, g, b] = rgb;
  const high = Math.max(r, g, b);
  const chroma = high - Math.min(r, g, b);
  if (chroma <= 0) return null;
  return Math.round(hueOf(r, g, b, high, chroma) * 3600) / 10;
}

export function isHueName(value: string): value is HueName {
  return (HUE_NAMES as readonly string[]).includes(value);
}
