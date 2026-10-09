import { FRAMES_PER_SECOND } from "./document";

export const EXPORT_SAMPLE_RATE = 48_000;
export const EXPORT_CHANNELS = 2;
export const EXPORT_AUDIO_BITRATE = 192_000;
export const MAX_BROWSER_EXPORT_BYTES = 95 * 1024 * 1024;

export function exportFrameCount(durationMs: number): number {
  return Math.max(0, Math.ceil((durationMs * FRAMES_PER_SECOND) / 1000 - 1e-9));
}

export function exportFrameMs(index: number): number {
  return (index * 1000) / FRAMES_PER_SECOND;
}

export function exportFrameUs(index: number): number {
  return Math.round((index * 1_000_000) / FRAMES_PER_SECOND);
}

export function exportSamples(durationMs: number): number {
  return Math.max(1, Math.ceil((durationMs * EXPORT_SAMPLE_RATE) / 1000));
}
