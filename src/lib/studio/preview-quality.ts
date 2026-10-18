export const PREVIEW_QUALITIES = ["full", "half", "quarter", "auto"] as const;

export type PreviewQuality = (typeof PREVIEW_QUALITIES)[number];

type FixedQuality = Exclude<PreviewQuality, "auto">;

const SCALES: Record<FixedQuality, number> = { full: 1, half: 0.5, quarter: 0.25 };

const AUTO_PLAYING_QUALITY: FixedQuality = "half";

export function previewScale(quality: PreviewQuality, playing: boolean): number {
  if (quality === "auto") return SCALES[playing ? AUTO_PLAYING_QUALITY : "full"];
  return SCALES[quality];
}

interface PreviewBlurState {
  frameWidth: number;
  canvasWidth: number;
  resolution: number;
  scrubbing: boolean;
  blurWhileScrubbing: boolean;
}

export function previewBlurScale(state: PreviewBlurState): number | null {
  if (state.scrubbing && !state.blurWhileScrubbing) return null;
  const scale = (state.frameWidth / state.canvasWidth) * state.resolution;
  return Number.isFinite(scale) && scale > 0 ? scale : null;
}
