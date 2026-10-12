import { FRAMES_PER_SECOND } from "./document";

export const EXPORT_SAMPLE_RATE = 48_000;
export const EXPORT_CHANNELS = 2;
export const EXPORT_AUDIO_BITRATE = 192_000;
export const EXPORT_VIDEO_BITRATE = 6_000_000;
export const EXPORT_SIZE_MARGIN = 1.15;
export const MAX_BROWSER_EXPORT_BYTES = 512 * 1024 * 1024;

export function exportFrameCount(durationMs: number, fps: number = FRAMES_PER_SECOND): number {
  return Math.max(0, Math.ceil((durationMs * fps) / 1000 - 1e-9));
}

export function exportFrameMs(index: number, fps: number = FRAMES_PER_SECOND): number {
  return (index * 1000) / fps;
}

export function frameTimes(durationMs: number, fps: number = FRAMES_PER_SECOND): number[] {
  return Array.from({ length: exportFrameCount(durationMs, fps) }, (_, index) => exportFrameMs(index, fps));
}

export function exportFrameUs(index: number): number {
  return Math.round((index * 1_000_000) / FRAMES_PER_SECOND);
}

export function exportSamples(durationMs: number): number {
  return Math.max(1, Math.ceil((durationMs * EXPORT_SAMPLE_RATE) / 1000));
}
