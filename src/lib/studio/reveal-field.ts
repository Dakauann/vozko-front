import { hash01 } from "./vfx";

export const GRADIENT_WIPE_MAPS = ["linear", "radial", "diamond", "clouds"] as const;
export type GradientWipeMap = (typeof GRADIENT_WIPE_MAPS)[number];

export type RevealField =
  | { pattern: "gradient"; map: GradientWipeMap; angle: number; originX: number; originY: number; reverse: boolean }
  | { pattern: "image"; assetId: string; reverse: boolean }
  | { pattern: "blinds"; angle: number; size: number }
  | { pattern: "blocks"; size: number }
  | { pattern: "fan"; angle: number; originX: number; originY: number };

export type RevealPattern = RevealField["pattern"];

export const REVEAL_PATTERN_CODES: Record<RevealPattern, number> = { gradient: 0, image: 1, blinds: 2, blocks: 3, fan: 4 };
export const GRADIENT_MAP_CODES: Record<GradientWipeMap, number> = { linear: 0, radial: 1, diamond: 2, clouds: 3 };

export const CLOUD_CELLS = 4;
export const CLOUD_OCTAVES = 4;
export const CLOUD_LOW = 0.25;
export const CLOUD_HIGH = 0.75;
export const BLOCK_SALT = 24_301;
export const MIN_SOFTNESS = 1 / 1024;
export const LUMA_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;

export interface FieldPoint {
  u: number;
  v: number;
  width: number;
  height: number;
}

export type LumaSampler = (u: number, v: number) => number;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function projectionSpan(width: number, height: number, nx: number, ny: number): { low: number; high: number } {
  return { low: Math.min(0, width * nx) + Math.min(0, height * ny), high: Math.max(0, width * nx) + Math.max(0, height * ny) };
}

function normal(angle: number): { nx: number; ny: number } {
  const radians = (angle * Math.PI) / 180;
  return { nx: Math.cos(radians), ny: Math.sin(radians) };
}

function linearValue(at: FieldPoint, angle: number): number {
  const { nx, ny } = normal(angle);
  const { low, high } = projectionSpan(at.width, at.height, nx, ny);
  return high > low ? clamp01((at.u * at.width * nx + at.v * at.height * ny - low) / (high - low)) : 0;
}

function reach(origin: number, size: number): number {
  return Math.max(origin, 1 - origin) * size;
}

function offsetOf(at: FieldPoint, originX: number, originY: number): { dx: number; dy: number } {
  return { dx: (at.u - originX) * at.width, dy: (at.v - originY) * at.height };
}

function radialValue(at: FieldPoint, originX: number, originY: number): number {
  const { dx, dy } = offsetOf(at, originX, originY);
  const far = Math.hypot(reach(originX, at.width), reach(originY, at.height));
  return far > 0 ? clamp01(Math.hypot(dx, dy) / far) : 0;
}

function diamondValue(at: FieldPoint, originX: number, originY: number): number {
  const { dx, dy } = offsetOf(at, originX, originY);
  const far = reach(originX, at.width) + reach(originY, at.height);
  return far > 0 ? clamp01((Math.abs(dx) + Math.abs(dy)) / far) : 0;
}

function smooth(f: number): number {
  return f * f * (3 - 2 * f);
}

function valueNoise(octave: number, x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash01(octave, ix, iy);
  const b = hash01(octave, ix + 1, iy);
  const c = hash01(octave, ix, iy + 1);
  const d = hash01(octave, ix + 1, iy + 1);
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return top + (bottom - top) * fy;
}

function cloudValue(at: FieldPoint): number {
  const cell = Math.min(at.width, at.height) / CLOUD_CELLS;
  if (cell <= 0) return 0;
  const x = (at.u * at.width) / cell;
  const y = (at.v * at.height) / cell;
  let sum = 0;
  let total = 0;
  for (let octave = 0; octave < CLOUD_OCTAVES; octave++) {
    const scale = 2 ** octave;
    const weight = 0.5 ** octave;
    sum += weight * valueNoise(octave, x * scale, y * scale);
    total += weight;
  }
  return clamp01((sum / total - CLOUD_LOW) / (CLOUD_HIGH - CLOUD_LOW));
}

function blindsValue(at: FieldPoint, angle: number, size: number): number {
  const band = size * Math.min(at.width, at.height);
  if (band <= 0) return 0;
  const { nx, ny } = normal(angle);
  const { low } = projectionSpan(at.width, at.height, nx, ny);
  const t = (at.u * at.width * nx + at.v * at.height * ny - low) / band;
  return t - Math.floor(t);
}

function blocksValue(at: FieldPoint, size: number): number {
  const block = size * Math.min(at.width, at.height);
  if (block <= 0) return 0;
  return hash01(BLOCK_SALT, Math.floor((at.u * at.width) / block), Math.floor((at.v * at.height) / block));
}

function fanValue(at: FieldPoint, angle: number, originX: number, originY: number): number {
  const { dx, dy } = offsetOf(at, originX, originY);
  const heading = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const turn = ((((heading - angle) % 360) + 540) % 360) - 180;
  return Math.abs(turn) / 180;
}

export function revealValue(field: RevealField, at: FieldPoint, luma?: LumaSampler): number {
  switch (field.pattern) {
    case "gradient": {
      const value = field.map === "linear" ? linearValue(at, field.angle) : field.map === "radial" ? radialValue(at, field.originX, field.originY) : field.map === "diamond" ? diamondValue(at, field.originX, field.originY) : cloudValue(at);
      return field.reverse ? 1 - value : value;
    }
    case "image": {
      if (!luma) return 1;
      const value = clamp01(luma(clamp01(at.u), clamp01(at.v)));
      return field.reverse ? 1 - value : value;
    }
    case "blinds":
      return blindsValue(at, field.angle, field.size);
    case "blocks":
      return blocksValue(at, field.size);
    case "fan":
      return fanValue(at, field.angle, field.originX, field.originY);
  }
}

export function revealCoverage(value: number, progress: number, softness: number): number {
  const soft = Math.max(softness, MIN_SOFTNESS);
  return clamp01((clamp01(progress) * (1 + soft) - value) / soft);
}

export function lumaOf(r: number, g: number, b: number): number {
  return (LUMA_WEIGHTS[0] * r + LUMA_WEIGHTS[1] * g + LUMA_WEIGHTS[2] * b) / 255;
}
