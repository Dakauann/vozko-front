export type Range = readonly [number, number];

export const LAYER_RANGES = {
  position: [-1, 2],
  size: [0.001, 4],
  rotation: [-360, 360],
  opacity: [0, 1],
  fontSize: [0.005, 0.5],
  lineHeight: [0.5, 4],
  letterSpacing: [-0.5, 2],
  strokeWidth: [0, 200],
  radius: [0, 1],
  shadowBlur: [0, 200],
  shadowOffset: [-500, 500],
  brightness: [-1, 1],
  contrast: [-100, 100],
  saturation: [-2, 10],
  blur: [0, 40],
  cropSide: [0.01, 1],
  starPoints: [3, 64],
  starInner: [0.05, 1],
  miterLimit: [1, 20],
  dashValue: [0, 100],
  dashOffset: [-1000, 1000],
} as const satisfies Record<string, Range>;

export function clampTo(value: number, [lo, hi]: Range): number {
  if (!Number.isFinite(value)) return lo;
  return Math.min(Math.max(value, lo), hi);
}

export function normalizedRotation(degrees: number): number {
  const turned = ((((degrees + 180) % 360) + 360) % 360) - 180;
  return Math.abs(turned) < 1e-9 ? 0 : turned;
}
