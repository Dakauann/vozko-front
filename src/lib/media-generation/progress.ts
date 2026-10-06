export const TYPICAL_GENERATION_MS = 30_000;
export const PROGRESS_CEILING = 99;

const TIME_CONSTANT_MS = TYPICAL_GENERATION_MS / Math.log(4);

export function estimatedProgress(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  const fraction = 1 - Math.exp(-elapsedMs / TIME_CONSTANT_MS);
  return Math.min(PROGRESS_CEILING, Math.floor(fraction * 100));
}
