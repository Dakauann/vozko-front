import { hexOf } from "../color";

export const TRACE_MODES = ["color", "grayscale", "bw"] as const;

export type TraceMode = (typeof TRACE_MODES)[number];

export interface QuantizeOptions {
  mode: TraceMode;
  colors: number;
  threshold: number;
}

export interface Quantized {
  classes: Int16Array;
  palette: string[];
}

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const OPAQUE = 128;
const MAX_SAMPLES = 20_000;
const KMEANS_ROUNDS = 12;

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function byLuminance(image: RgbaImage, levels: number, threshold: number | null): Quantized {
  const count = image.width * image.height;
  const classes = new Int16Array(count);
  for (let i = 0; i < count; i++) {
    const at = i * 4;
    if (image.data[at + 3] < OPAQUE) {
      classes[i] = -1;
      continue;
    }
    const value = luminance(image.data[at], image.data[at + 1], image.data[at + 2]);
    classes[i] = threshold === null ? Math.round((value / 255) * (levels - 1)) : value >= threshold ? 1 : 0;
  }
  const palette = Array.from({ length: levels }, (_, level) => {
    const gray = (level * 255) / (levels - 1);
    return hexOf({ r: gray, g: gray, b: gray });
  });
  return { classes, palette };
}

function distance(a: readonly number[], data: Uint8ClampedArray, at: number): number {
  const dr = a[0] - data[at];
  const dg = a[1] - data[at + 1];
  const db = a[2] - data[at + 2];
  return dr * dr + dg * dg + db * db;
}

function byKMeans(image: RgbaImage, colors: number): Quantized {
  const count = image.width * image.height;
  const data = image.data;
  const opaque: number[] = [];
  for (let i = 0; i < count; i++) if (data[i * 4 + 3] >= OPAQUE) opaque.push(i * 4);
  const stride = Math.max(1, Math.floor(opaque.length / MAX_SAMPLES));
  const samples = opaque.filter((_, i) => i % stride === 0);
  const centers: number[][] = [];
  if (samples.length > 0) centers.push([data[samples[0]], data[samples[0] + 1], data[samples[0] + 2]]);
  while (centers.length < colors && samples.length > 0) {
    let farthest = -1;
    let reach = 0;
    for (const at of samples) {
      const nearest = Math.min(...centers.map((c) => distance(c, data, at)));
      if (nearest > reach) {
        reach = nearest;
        farthest = at;
      }
    }
    if (farthest < 0) break;
    centers.push([data[farthest], data[farthest + 1], data[farthest + 2]]);
  }
  const nearestOf = (at: number) => {
    let best = 0;
    let bestDistance = Infinity;
    centers.forEach((c, k) => {
      const d = distance(c, data, at);
      if (d < bestDistance) {
        bestDistance = d;
        best = k;
      }
    });
    return best;
  };
  for (let round = 0; round < KMEANS_ROUNDS; round++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const at of samples) {
      const sum = sums[nearestOf(at)];
      sum[0] += data[at];
      sum[1] += data[at + 1];
      sum[2] += data[at + 2];
      sum[3]++;
    }
    sums.forEach((sum, k) => {
      if (sum[3] > 0) centers[k] = [sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3]];
    });
  }
  const classes = new Int16Array(count);
  const used = new Set<number>();
  for (let i = 0; i < count; i++) {
    const at = i * 4;
    if (data[at + 3] < OPAQUE) {
      classes[i] = -1;
      continue;
    }
    classes[i] = nearestOf(at);
    used.add(classes[i]);
  }
  const kept = [...used].sort((a, b) => a - b);
  const remap = new Map(kept.map((k, index) => [k, index]));
  for (let i = 0; i < count; i++) if (classes[i] >= 0) classes[i] = remap.get(classes[i])!;
  return { classes, palette: kept.map((k) => hexOf({ r: centers[k][0], g: centers[k][1], b: centers[k][2] })) };
}

export function quantize(image: RgbaImage, options: QuantizeOptions): Quantized {
  const colors = Math.min(16, Math.max(2, Math.round(options.colors)));
  if (options.mode === "bw") return byLuminance(image, 2, options.threshold);
  if (options.mode === "grayscale") return byLuminance(image, colors, null);
  return byKMeans(image, colors);
}
