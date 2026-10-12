import { chromaOf, vividChroma, type Rgb } from "./chroma-key";
import { sourceAt } from "./clip-time";
import type { Clip, Layer } from "./document";

const RING_SHARE = 0.05;
const BINS = 32;
const DOMINANT_SHARE = 0.5;

type Family = "green" | "blue";

function familyOf([r, g, b]: Rgb): Family | null {
  if (!vividChroma([r, g, b])) return null;
  if (g > r && g > b) return "green";
  if (b > r && b > g) return "blue";
  return null;
}

function binOf(value: number): number {
  return Math.min(BINS - 1, Math.max(0, Math.floor(value * BINS)));
}

function inRing(x: number, y: number, width: number, height: number, ring: number): boolean {
  return x < ring || y < ring || x >= width - ring || y >= height - ring;
}

function hex(value: number): string {
  return Math.round(value).toString(16).padStart(2, "0");
}

interface Bin {
  family: Family;
  count: number;
  r: number;
  g: number;
  b: number;
}

function ringBins(data: Uint8ClampedArray, width: number, height: number): { bins: Map<number, Bin>; opaque: number } {
  const ring = Math.max(1, Math.round(Math.min(width, height) * RING_SHARE));
  const bins = new Map<number, Bin>();
  let opaque = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inRing(x, y, width, height, ring)) continue;
      const i = (y * width + x) * 4;
      if (data[i + 3] < 255) continue;
      opaque += 1;
      const rgb: Rgb = [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
      const family = familyOf(rgb);
      if (!family) continue;
      const [cb, cr] = chromaOf(rgb);
      const bin = binOf(cb) * BINS + binOf(cr);
      const entry = bins.get(bin) ?? { family, count: 0, r: 0, g: 0, b: 0 };
      entry.count += 1;
      entry.r += data[i];
      entry.g += data[i + 1];
      entry.b += data[i + 2];
      bins.set(bin, entry);
    }
  }
  return { bins, opaque };
}

function neighbours(bin: number): number[] {
  const cb = Math.floor(bin / BINS);
  const cr = bin % BINS;
  const around: number[] = [];
  for (let dcb = -1; dcb <= 1; dcb++) for (let dcr = -1; dcr <= 1; dcr++) if (cb + dcb >= 0 && cb + dcb < BINS && cr + dcr >= 0 && cr + dcr < BINS) around.push((cb + dcb) * BINS + cr + dcr);
  return around;
}

export function detectKeyColor(data: Uint8ClampedArray, width: number, height: number): string | null {
  if (width <= 0 || height <= 0) return null;
  const { bins, opaque } = ringBins(data, width, height);
  let peak: [number, Bin] | null = null;
  for (const entry of bins) if (!peak || entry[1].count > peak[1].count) peak = entry;
  if (!peak) return null;
  const family = peak[1].family;
  const share = [...bins.values()].reduce((sum, entry) => sum + (entry.family === family ? entry.count : 0), 0);
  if (share < opaque * DOMINANT_SHARE) return null;
  const cluster = neighbours(peak[0]).flatMap((bin) => {
    const entry = bins.get(bin);
    return entry && entry.family === family ? [entry] : [];
  });
  const total = cluster.reduce((sum, entry) => sum + entry.count, 0);
  const mean = (channel: "r" | "g" | "b") => hex(cluster.reduce((sum, entry) => sum + entry[channel], 0) / total);
  return `#${mean("r")}${mean("g")}${mean("b")}`;
}

export interface KeySample {
  assetId: string;
  sourceMs: number;
  still: boolean;
}

export function keyMoment(clip: Pick<Clip, "startMs" | "durationMs">, atMs: number | undefined, playheadMs: number): number {
  if (atMs !== undefined) return Math.min(clip.durationMs, Math.max(0, atMs));
  const local = playheadMs - clip.startMs;
  return local >= 0 && local <= clip.durationMs ? local : 0;
}

export function clipKeySample(clip: Clip, localMs: number): KeySample | null {
  if (!clip.assetId || (clip.type !== "video" && clip.type !== "image")) return null;
  if (clip.type === "image") return { assetId: clip.assetId, sourceMs: 0, still: true };
  return { assetId: clip.assetId, sourceMs: Math.round(sourceAt(clip, Math.min(clip.durationMs, Math.max(0, localMs)))), still: false };
}

export function keySampleId(sample: KeySample): string {
  return `${sample.assetId}@${sample.still ? "still" : sample.sourceMs}`;
}

export function layerKeySource(layer: Pick<Layer, "type" | "assetId" | "crop">): string | null {
  if (layer.type !== "image" || !layer.assetId) return null;
  const crop = layer.crop;
  return crop ? `${layer.assetId}:${crop.x},${crop.y},${crop.w},${crop.h}` : layer.assetId;
}
