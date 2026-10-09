export const STILL_JPEG_QUALITY = 0.72;
export const STILL_END_MARGIN_SEC = 0.05;

export function stillSeconds(seconds: number, durationSec: number): number {
  return Math.max(0, Math.min(seconds, durationSec - STILL_END_MARGIN_SEC));
}
