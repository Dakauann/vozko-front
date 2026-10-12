import type { GifDither } from "./animated-export";

export type Palette = number[][];

const CACHE_BITS = 6;
const CACHE_SHIFT = 8 - CACHE_BITS;
const UNKNOWN = -1;
const DIFFUSION_STRENGTH = 0.75;
const BAYER_SIZE = 8;
const BAYER: readonly number[] = bayerMatrix(BAYER_SIZE);

function bayerMatrix(size: number): number[] {
  let matrix = [0];
  for (let side = 1; side < size; side *= 2) {
    const next = new Array<number>(side * 2 * side * 2);
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        const base = matrix[y * side + x] * 4;
        next[y * side * 2 + x] = base;
        next[y * side * 2 + x + side] = base + 2;
        next[(y + side) * side * 2 + x] = base + 3;
        next[(y + side) * side * 2 + x + side] = base + 1;
      }
    }
    matrix = next;
  }
  return matrix.map((value) => (value + 0.5) / (size * size) - 0.5);
}

export type NearestIndex = (r: number, g: number, b: number) => number;

export function createNearestIndex(palette: Palette): NearestIndex {
  const cache = new Int16Array(1 << (CACHE_BITS * 3)).fill(UNKNOWN);
  return (r, g, b) => {
    const key = ((r >> CACHE_SHIFT) << (CACHE_BITS * 2)) | ((g >> CACHE_SHIFT) << CACHE_BITS) | (b >> CACHE_SHIFT);
    const cached = cache[key];
    if (cached !== UNKNOWN) return cached;
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < palette.length; i++) {
      const [pr, pg, pb] = palette[i];
      const distance = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    cache[key] = best;
    return best;
  };
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : Math.round(value);
}

function indexPlain(rgba: ArrayLike<number>, out: Uint8Array, nearest: NearestIndex): void {
  for (let i = 0; i < out.length; i++) out[i] = nearest(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
}

function indexOrdered(rgba: ArrayLike<number>, width: number, out: Uint8Array, palette: Palette, nearest: NearestIndex): void {
  const spread = 255 / Math.cbrt(palette.length);
  for (let i = 0; i < out.length; i++) {
    const x = i % width;
    const y = Math.floor(i / width);
    const offset = BAYER[(y % BAYER_SIZE) * BAYER_SIZE + (x % BAYER_SIZE)] * spread;
    out[i] = nearest(clampByte(rgba[i * 4] + offset), clampByte(rgba[i * 4 + 1] + offset), clampByte(rgba[i * 4 + 2] + offset));
  }
}

function spread(current: Float32Array, next: Float32Array, at: number, error: number): void {
  current[at + 3] += (error * 7) / 16;
  next[at - 3] += (error * 3) / 16;
  next[at] += (error * 5) / 16;
  next[at + 3] += error / 16;
}

function indexDiffused(rgba: ArrayLike<number>, width: number, height: number, out: Uint8Array, palette: Palette, nearest: NearestIndex): void {
  let current = new Float32Array((width + 2) * 3);
  let next = new Float32Array((width + 2) * 3);
  for (let y = 0; y < height; y++) {
    next.fill(0);
    for (let x = 0; x < width; x++) {
      const pixel = y * width + x;
      const cell = (x + 1) * 3;
      const r = clampByte(rgba[pixel * 4] + current[cell]);
      const g = clampByte(rgba[pixel * 4 + 1] + current[cell + 1]);
      const b = clampByte(rgba[pixel * 4 + 2] + current[cell + 2]);
      const index = nearest(r, g, b);
      out[pixel] = index;
      const chosen = palette[index];
      spread(current, next, cell, (r - chosen[0]) * DIFFUSION_STRENGTH);
      spread(current, next, cell + 1, (g - chosen[1]) * DIFFUSION_STRENGTH);
      spread(current, next, cell + 2, (b - chosen[2]) * DIFFUSION_STRENGTH);
    }
    [current, next] = [next, current];
  }
}

export function indexPixels(rgba: ArrayLike<number>, width: number, height: number, palette: Palette, dither: GifDither, nearest: NearestIndex = createNearestIndex(palette)): Uint8Array {
  const out = new Uint8Array(width * height);
  if (dither === "diffusion") indexDiffused(rgba, width, height, out, palette, nearest);
  else if (dither === "ordered") indexOrdered(rgba, width, out, palette, nearest);
  else indexPlain(rgba, out, nearest);
  return out;
}
