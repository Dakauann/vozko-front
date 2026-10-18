import type { CanvasSize } from "./document";
import { DEFAULT_JPEG_QUALITY } from "./image-edits";
import { clampSpan, filmSpan, type TimeSpan } from "./work-area";

export const VIDEO_EXPORT_FORMATS = ["mp4", "gif", "webp", "png", "jpeg"] as const;
export type VideoExportFormat = (typeof VIDEO_EXPORT_FORMATS)[number];
export type ExportKind = "video" | "animation" | "frame";

export const GIF_DITHERS = ["none", "diffusion", "ordered"] as const;
export type GifDither = (typeof GIF_DITHERS)[number];

export const ANIMATION_WIDTHS = [320, 480, 640, 800] as const;
export const ANIMATION_FPS = [10, 12, 15, 20, 25] as const;

export const ANIMATION_RANGES = {
  width: [120, Number.POSITIVE_INFINITY],
  fps: [5, 30],
  colors: [2, 256],
  loop: [0, 65535],
  quality: [0.5, 1],
} as const;

const MIN_ANIMATION_DELAY_MS = 20;
export const MAX_GIF_DELAY_CS = 65535;
export const MAX_WEBP_DELAY_MS = 0xffffff;
const PALETTE_SAMPLE_FRAMES = 32;
const PALETTE_SAMPLE_PIXELS = 1 << 21;

interface AnimationSettings {
  width: number;
  fps: number;
  loop: number;
}

export interface GifSettings extends AnimationSettings {
  colors: number;
  dither: GifDither;
}

export interface WebpSettings extends AnimationSettings {
  quality: number;
}

interface Ranged {
  range?: TimeSpan;
}

export type GifExportRequest = { format: "gif" } & GifSettings & Ranged;
export type WebpExportRequest = { format: "webp" } & WebpSettings & Ranged;
export type AnimationExportRequest = GifExportRequest | WebpExportRequest;
export type Mp4ExportRequest = { format: "mp4" } & Ranged;
export type FilmExportRequest = Mp4ExportRequest | AnimationExportRequest;
export type FrameExportRequest = { format: "png"; atMs: number } | { format: "jpeg"; atMs: number; quality: number };
export type VideoExportRequest = FilmExportRequest | FrameExportRequest;

export const MP4_EXPORT: Mp4ExportRequest = { format: "mp4" };

const DEFAULT_WIDTH = 480;
const DEFAULT_FPS = 15;
const DEFAULT_COLORS = 256;
const DEFAULT_DITHER: GifDither = "diffusion";
const DEFAULT_QUALITY = 0.8;

const ANIMATION_OPTIONS = ["width", "fps", "loop"] as const;
const FORMAT_OPTIONS: Record<VideoExportFormat, readonly string[]> = {
  mp4: [],
  gif: [...ANIMATION_OPTIONS, "colors", "dither"],
  webp: [...ANIMATION_OPTIONS, "quality"],
  png: [],
  jpeg: ["quality"],
};
const RANGE_OPTIONS = ["from_ms", "to_ms"] as const;
const MOMENT_OPTIONS = ["at_ms"] as const;
const TIMING_OPTIONS: Record<VideoExportFormat, readonly string[]> = { mp4: RANGE_OPTIONS, gif: RANGE_OPTIONS, webp: RANGE_OPTIONS, png: MOMENT_OPTIONS, jpeg: MOMENT_OPTIONS };
const ALL_OPTIONS = new Set([...Object.values(FORMAT_OPTIONS).flat(), ...RANGE_OPTIONS, ...MOMENT_OPTIONS]);

export function isAnimation(request: VideoExportRequest): request is AnimationExportRequest {
  return request.format === "gif" || request.format === "webp";
}

export function isFrame(request: VideoExportRequest): request is FrameExportRequest {
  return request.format === "png" || request.format === "jpeg";
}

export function exportKind(request: VideoExportRequest): ExportKind {
  if (isFrame(request)) return "frame";
  return isAnimation(request) ? "animation" : "video";
}

export function defaultVideoExport(format: VideoExportFormat, canvas: CanvasSize): VideoExportRequest {
  const base = { width: Math.min(DEFAULT_WIDTH, canvas.width), fps: DEFAULT_FPS, loop: 0 };
  if (format === "gif") return { format, ...base, colors: DEFAULT_COLORS, dither: DEFAULT_DITHER };
  if (format === "webp") return { format, ...base, quality: DEFAULT_QUALITY };
  if (format === "png") return { format, atMs: 0 };
  if (format === "jpeg") return { format, atMs: 0, quality: DEFAULT_JPEG_QUALITY };
  return MP4_EXPORT;
}

export function withFormat(current: VideoExportRequest, format: VideoExportFormat, canvas: CanvasSize): VideoExportRequest {
  const next = defaultVideoExport(format, canvas);
  if (isFrame(next)) return isFrame(current) ? { ...next, atMs: current.atMs } : next;
  if (isFrame(current)) return next;
  const ranged: FilmExportRequest = current.range ? { ...next, range: current.range } : next;
  if (!isAnimation(ranged) || !isAnimation(current)) return ranged;
  return { ...ranged, width: current.width, fps: current.fps, loop: current.loop };
}

export function exportAt(request: VideoExportRequest, at: { playheadMs: number; durationMs: number; range: TimeSpan | null }): VideoExportRequest {
  if (isFrame(request)) return { ...request, atMs: Math.max(0, Math.min(Math.round(at.playheadMs), at.durationMs - 1)) };
  if (at.range) return { ...request, range: at.range };
  const whole: FilmExportRequest = { ...request };
  delete whole.range;
  return whole;
}

export function requestSpan(request: FilmExportRequest, durationMs: number): TimeSpan | null {
  if (request.range) return clampSpan(request.range, durationMs);
  return durationMs > 0 ? filmSpan(durationMs) : null;
}

function integerIn(value: number, [min, max]: readonly [number, number]): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

function qualityFits(quality: unknown): boolean {
  return typeof quality === "number" && quality >= ANIMATION_RANGES.quality[0] && quality <= ANIMATION_RANGES.quality[1];
}

function settingsFit(request: AnimationExportRequest, canvas: CanvasSize): boolean {
  if (!integerIn(request.width, [ANIMATION_RANGES.width[0], canvas.width])) return false;
  if (!integerIn(request.fps, ANIMATION_RANGES.fps) || !integerIn(request.loop, ANIMATION_RANGES.loop)) return false;
  if (request.format === "gif") return integerIn(request.colors, ANIMATION_RANGES.colors) && (GIF_DITHERS as readonly string[]).includes(request.dither);
  return qualityFits(request.quality);
}

function momentOf(atMs: unknown, durationMs: number): number | null {
  return typeof atMs === "number" && Number.isInteger(atMs) && atMs >= 0 && atMs < durationMs ? atMs : null;
}

export function frameFits(request: FrameExportRequest, durationMs: number): boolean {
  return momentOf(request.atMs, durationMs) !== null;
}

function rangeOf(fromMs: unknown, toMs: unknown, durationMs: number): TimeSpan | undefined | null {
  if (fromMs === undefined && toMs === undefined) return undefined;
  const startMs = fromMs ?? 0;
  const endMs = toMs ?? durationMs;
  if (typeof startMs !== "number" || typeof endMs !== "number" || !Number.isInteger(startMs) || !Number.isInteger(endMs)) return null;
  return startMs >= 0 && endMs > startMs && endMs <= durationMs ? { startMs, endMs } : null;
}

export function videoExportRequestOf(args: Record<string, unknown>, canvas: CanvasSize, durationMs: number): VideoExportRequest | null {
  const format = args.format ?? "mp4";
  if (!(VIDEO_EXPORT_FORMATS as readonly unknown[]).includes(format)) return null;
  const known = format as VideoExportFormat;
  const settings = FORMAT_OPTIONS[known];
  const given = Object.keys(args).filter((key) => ALL_OPTIONS.has(key) && args[key] !== undefined);
  if (given.some((key) => !settings.includes(key) && !TIMING_OPTIONS[known].includes(key))) return null;
  const base = defaultVideoExport(known, canvas);
  const defaults: Record<string, unknown> = { ...base };
  const chosen = given.filter((key) => settings.includes(key));
  if (chosen.some((key) => typeof args[key] !== typeof defaults[key])) return null;
  const request = { ...base, ...Object.fromEntries(chosen.map((key) => [key, args[key]])) } as VideoExportRequest;
  if (isFrame(request)) {
    const atMs = momentOf(args.at_ms, durationMs);
    if (atMs === null || (request.format === "jpeg" && !qualityFits(request.quality))) return null;
    return { ...request, atMs };
  }
  if (isAnimation(request) && !settingsFit(request, canvas)) return null;
  const range = rangeOf(args.from_ms, args.to_ms, durationMs);
  if (range === null) return null;
  return range ? { ...request, range } : request;
}

export function animationSize(canvas: CanvasSize, width: number): CanvasSize {
  return { width, height: Math.max(1, Math.round((width * canvas.height) / canvas.width)) };
}

function steppedDelays(times: readonly number[], durationMs: number, unitMs: number, minimum: number): number[] {
  const marks = [...times, durationMs].map((ms) => Math.round(ms / unitMs));
  return times.map((_, i) => Math.max(minimum, marks[i + 1] - marks[i]));
}

export function gifDelaysCs(times: readonly number[], durationMs: number): number[] {
  return steppedDelays(times, durationMs, 10, MIN_ANIMATION_DELAY_MS / 10);
}

export function webpDelaysMs(times: readonly number[], durationMs: number): number[] {
  return steppedDelays(times, durationMs, 1, MIN_ANIMATION_DELAY_MS);
}

export function gifRepeat(plays: number): number {
  if (plays === 0) return 0;
  return plays === 1 ? -1 : plays - 1;
}

interface FrameHold<T> {
  add(frame: T, delay: number): void;
  extend(delay: number): void;
  flush(): void;
}

export function createFrameHold<T>(write: (frame: T, delay: number) => void, maxDelay: number): FrameHold<T> {
  let pending: { frame: T; delay: number } | null = null;
  const flush = () => {
    if (pending) write(pending.frame, pending.delay);
    pending = null;
  };
  return {
    add(frame, delay) {
      flush();
      pending = { frame, delay };
    },
    extend(delay) {
      if (!pending) return;
      if (pending.delay + delay <= maxDelay) {
        pending.delay += delay;
        return;
      }
      const frame = pending.frame;
      flush();
      pending = { frame, delay };
    },
    flush,
  };
}

export function samePixels(a: Uint8ClampedArray, b: Uint8ClampedArray | null): boolean {
  if (!b || a.length !== b.length) return false;
  const left = new Uint32Array(a.buffer, a.byteOffset, a.length >> 2);
  const right = new Uint32Array(b.buffer, b.byteOffset, b.length >> 2);
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return false;
  return true;
}

export function paletteSampleTimes(times: readonly number[], count: number = PALETTE_SAMPLE_FRAMES): number[] {
  if (times.length <= count) return [...times];
  return Array.from({ length: count }, (_, i) => times[Math.round((i * (times.length - 1)) / (count - 1))]);
}

export class PaletteSample {
  private readonly stride: number;
  private readonly data: Uint8Array;
  private filled = 0;

  constructor(frames: number, framePixels: number, budget: number = PALETTE_SAMPLE_PIXELS) {
    this.stride = Math.max(1, Math.ceil((frames * framePixels) / budget));
    this.data = new Uint8Array(frames * Math.ceil(framePixels / this.stride) * 4);
  }

  add(rgba: Uint8ClampedArray): void {
    for (let pixel = 0; pixel * 4 < rgba.length && this.filled < this.data.length; pixel += this.stride) {
      this.data.set(rgba.subarray(pixel * 4, pixel * 4 + 4), this.filled);
      this.filled += 4;
    }
  }

  pixels(): Uint8Array {
    return this.data.slice(0, this.filled);
  }
}
