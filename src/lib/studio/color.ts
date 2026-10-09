export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const HEX = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/;

export function parseColor(value: string | undefined): Rgba | null {
  const match = value ? HEX.exec(value) : null;
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: match[2] ? parseInt(match[2], 16) / 255 : 1 };
}

export function typedColor(raw: string, alpha: boolean): string | null {
  const clean = raw.trim().toLowerCase();
  const hex = clean.startsWith("#") ? clean : `#${clean}`;
  if (!HEX.test(hex)) return null;
  return alpha || hex.length === 7 ? hex : null;
}

export function swatchOf(value: string | null | undefined): string | null {
  return value && HEX.test(value) ? value.slice(0, 7).toLowerCase() : null;
}

export function withSwatch(value: string | null | undefined, swatch: string): string {
  const alpha = value && HEX.test(value) ? value.slice(7) : "";
  return `${swatch.toLowerCase()}${alpha.toLowerCase()}`;
}

export function hexOf(color: Pick<Rgba, "r" | "g" | "b">): string {
  return `#${[color.r, color.g, color.b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;
}

export function mixColors(base: Rgba, over: Rgba, amount: number): Rgba {
  const t = Math.max(0, Math.min(1, amount));
  const channel = (from: number, to: number) => Math.round(from + (to - from) * t);
  return { r: channel(base.r, over.r), g: channel(base.g, over.g), b: channel(base.b, over.b), a: 1 };
}

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(color: Rgba): number {
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
}

export function contrastRatio(a: Rgba, b: Rgba): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
