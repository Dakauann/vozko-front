import type { BlendMode } from "./document";

export type Rgb = [number, number, number];

type Channel = (backdrop: number, source: number) => number;

const multiply: Channel = (b, s) => b * s;
const screen: Channel = (b, s) => b + s - b * s;
const hardLight: Channel = (b, s) => (s <= 0.5 ? multiply(b, 2 * s) : screen(b, 2 * s - 1));

function softLight(b: number, s: number): number {
  if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
  const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
  return b + (2 * s - 1) * (d - b);
}

function colorDodge(b: number, s: number): number {
  if (b === 0) return 0;
  return s >= 1 ? 1 : Math.min(1, b / (1 - s));
}

function colorBurn(b: number, s: number): number {
  if (b >= 1) return 1;
  return s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s);
}

const SEPARABLE: Partial<Record<BlendMode, Channel>> = {
  normal: (_, s) => s,
  multiply,
  screen,
  overlay: (b, s) => hardLight(s, b),
  darken: Math.min,
  lighten: Math.max,
  "color-dodge": colorDodge,
  add: (b, s) => b + s,
  "color-burn": colorBurn,
  "hard-light": hardLight,
  "soft-light": softLight,
  difference: (b, s) => Math.abs(b - s),
  exclusion: (b, s) => b + s - 2 * b * s,
};

function lum([r, g, b]: Rgb): number {
  return 0.3 * r + 0.59 * g + 0.11 * b;
}

function clipColor(c: Rgb): Rgb {
  const l = lum(c);
  const n = Math.min(...c);
  const x = Math.max(...c);
  return c.map((v) => {
    let out = v;
    if (n < 0) out = l + ((out - l) * l) / (l - n);
    if (x > 1) out = l + ((out - l) * (1 - l)) / (x - l);
    return out;
  }) as Rgb;
}

function setLum(c: Rgb, l: number): Rgb {
  const d = l - lum(c);
  return clipColor([c[0] + d, c[1] + d, c[2] + d]);
}

function sat(c: Rgb): number {
  return Math.max(...c) - Math.min(...c);
}

function setSat(c: Rgb, s: number): Rgb {
  const max = Math.max(...c);
  const min = Math.min(...c);
  if (max <= min) return [0, 0, 0];
  return c.map((v) => ((v - min) * s) / (max - min)) as Rgb;
}

const NON_SEPARABLE: Partial<Record<BlendMode, (b: Rgb, s: Rgb) => Rgb>> = {
  hue: (b, s) => setLum(setSat(s, sat(b)), lum(b)),
  saturation: (b, s) => setLum(setSat(b, sat(s)), lum(b)),
  color: (b, s) => setLum(s, lum(b)),
  luminosity: (b, s) => setLum(b, lum(s)),
};

function unit(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function blendColor(mode: BlendMode, backdrop: Rgb, source: Rgb): Rgb {
  const whole = NON_SEPARABLE[mode];
  if (whole) return whole(backdrop, source).map(unit) as Rgb;
  const channel = SEPARABLE[mode] ?? SEPARABLE.normal!;
  return [unit(channel(backdrop[0], source[0])), unit(channel(backdrop[1], source[1])), unit(channel(backdrop[2], source[2]))];
}
