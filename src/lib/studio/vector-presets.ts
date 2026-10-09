import { newPathLayer, newShapeLayer, type CanvasSize, type Layer } from "./document";
import { squareTransform } from "./geometry";

export const VECTOR_PRESET_IDS = [
  "diagonalBand",
  "diagonalSplit",
  "arch",
  "ribbon",
  "chevron",
  "wave",
  "blob",
  "speechBubble",
  "heart",
  "swoosh",
  "tornPaper",
  "cornerBracket",
  "squiggle",
  "burst",
  "seal",
] as const;

export type VectorPresetId = (typeof VECTOR_PRESET_IDS)[number];

export type VectorPreset = { kind: "path"; data: string; ratio: number; open?: boolean } | { kind: "star"; points: number; inner: number; ratio: number };

const TORN_TEETH = [0.86, 0.95, 0.88, 0.98, 0.84, 0.93, 0.9, 0.99, 0.85, 0.94, 0.87, 0.97, 0.83, 0.92, 0.89, 1, 0.86, 0.95, 0.88, 0.96];

function tornPaper(): string {
  const step = 1 / (TORN_TEETH.length - 1);
  const edge = TORN_TEETH.map((y, i) => `L${Math.round((1 - i * step) * 1000) / 1000} ${y}`).join(" ");
  return `M0 0 L1 0 ${edge} Z`;
}

export const VECTOR_PRESETS: Record<VectorPresetId, VectorPreset> = {
  diagonalBand: { kind: "path", data: "M0 0.3 L1 0 L1 0.7 L0 1 Z", ratio: 3 },
  diagonalSplit: { kind: "path", data: "M0 0.6 L1 0.4 L1 1 L0 1 Z", ratio: 1 },
  arch: { kind: "path", data: "M0 1 L0 0.5 A0.5 0.5 0 0 1 1 0.5 L1 1 Z", ratio: 0.8 },
  ribbon: { kind: "path", data: "M0 0 L1 0 L0.92 0.5 L1 1 L0 1 L0.08 0.5 Z", ratio: 5 },
  chevron: { kind: "path", data: "M0 0 L0.65 0 L1 0.5 L0.65 1 L0 1 L0.35 0.5 Z", ratio: 1.2 },
  wave: { kind: "path", data: "M0 0.35 C0.17 0.05 0.33 0.05 0.5 0.35 C0.67 0.65 0.83 0.65 1 0.35 L1 1 L0 1 Z", ratio: 3 },
  blob: {
    kind: "path",
    data: "M0.52 0.03 C0.76 0.01 0.97 0.18 0.96 0.42 C0.95 0.6 0.85 0.7 0.88 0.85 C0.91 1 0.64 1 0.46 0.95 C0.27 0.9 0.04 0.85 0.04 0.57 C0.04 0.33 0.22 0.05 0.52 0.03 Z",
    ratio: 1,
  },
  speechBubble: {
    kind: "path",
    data: "M0.1 0 L0.9 0 Q1 0 1 0.1 L1 0.62 Q1 0.72 0.9 0.72 L0.42 0.72 L0.2 1 L0.26 0.72 L0.1 0.72 Q0 0.72 0 0.62 L0 0.1 Q0 0 0.1 0 Z",
    ratio: 1.3,
  },
  heart: {
    kind: "path",
    data: "M0.5 0.95 C0.2 0.75 0 0.55 0 0.32 C0 0.14 0.14 0 0.3 0 C0.4 0 0.47 0.06 0.5 0.14 C0.53 0.06 0.6 0 0.7 0 C0.86 0 1 0.14 1 0.32 C1 0.55 0.8 0.75 0.5 0.95 Z",
    ratio: 1,
  },
  swoosh: { kind: "path", data: "M0 0.85 C0.25 0.3 0.6 0.05 1 0.15 C0.62 0.2 0.32 0.45 0 0.85 Z", ratio: 2.5 },
  tornPaper: { kind: "path", data: tornPaper(), ratio: 4 },
  cornerBracket: { kind: "path", data: "M0 1 L0 0 L1 0", ratio: 1, open: true },
  squiggle: { kind: "path", data: "M0 0.5 C0.08 0.1 0.17 0.1 0.25 0.5 S0.42 0.9 0.5 0.5 S0.67 0.1 0.75 0.5 S0.92 0.9 1 0.5", ratio: 6, open: true },
  burst: { kind: "star", points: 16, inner: 0.72, ratio: 1 },
  seal: { kind: "star", points: 24, inner: 0.88, ratio: 1 },
};

export const VECTOR_PRESET_SHARE = 0.4;

export function isVectorPreset(id: string): id is VectorPresetId {
  return (VECTOR_PRESET_IDS as readonly string[]).includes(id);
}

export function vectorPresetLayer(id: VectorPresetId, canvas: CanvasSize, share: number = VECTOR_PRESET_SHARE): Layer {
  const preset = VECTOR_PRESETS[id];
  const wide = preset.ratio >= 1;
  const transform = squareTransform(canvas, wide ? share : share * preset.ratio, wide ? share / preset.ratio : share);
  if (preset.kind === "star") return { ...newShapeLayer("star", transform), points: preset.points, inner: preset.inner };
  return newPathLayer(preset.data, transform, preset.open);
}
