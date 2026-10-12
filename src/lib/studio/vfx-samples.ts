import { SPECTRUM_BANDS } from "./audio-spectrum";
import { NO_LEVELS, type TrackLevel, type TrackLevels } from "./behaviors";
import { emptyVideoDocument, newOverlayClip, newShapeLayer, type Clip, type ShapeKind, type Transform, type VideoDocument } from "./document";
import { LOUDNESS_STEP_MS } from "./loudness";
import { listensToTrack, newEffectClip, newVfx, refusedOnEffectClips, type Vfx, type VfxKind, type VfxParam } from "./vfx";

export const EFFECT_SAMPLE_SIZE = { width: 192, height: 108 } as const;

const SAMPLE_MS = 1000;
const SAMPLE_AT_MS = 520;
const SAMPLE_SEED = 7;
const BACKDROP = "#1d2433";
const MOVING_ID = "sun";
export const SAMPLE_SOUND_TRACK = "t-sound";

const SAMPLE_PARAMS: Partial<Record<VfxKind, Partial<Record<VfxParam, number>>>> = {
  grain: { amount: 0.8, size: 2 },
  glitch: { amount: 1, frequency: 30, split: 30 },
  particles: { count: 120, size: 10 },
  shake: { amount: 1, rotation: 4 },
  vignette: { amount: 0.85 },
  chromaticAberration: { amount: 1 },
  glow: { amount: 1, threshold: 0.45, size: 14 },
  mosaic: { size: 12 },
  posterize: { levels: 3 },
  mirror: { x: 0.45 },
  offset: { shiftX: 0.3, shiftY: 0.2 },
  directionalBlur: { length: 40 },
  zoomBlur: { length: 0.35, x: 0.64, y: 0.42 },
  spinBlur: { angle: 40, x: 0.64, y: 0.42 },
  waveWarp: { height: 8, length: 60 },
  ripple: { height: 6, length: 22, size: 1.2, x: 0.64, y: 0.42 },
  twirl: { angle: 300, size: 0.8, x: 0.5, y: 0.55 },
  bulge: { height: 1, size: 0.6, x: 0.64, y: 0.42 },
  cornerPin: { topLeftX: 0.15, topLeftY: 0.1, topRightX: 0.9, topRightY: 0.2, bottomRightX: 0.8, bottomRightY: 0.95, bottomLeftX: 0.05, bottomLeftY: 0.8 },
  fractalNoise: { amount: 0.85, size: 40 },
  gradientRamp: { amount: 0.8, radial: 0.3 },
  fourColorGradient: { amount: 0.8 },
  audioSpectrum: { size: 0.5, gap: 0.25 },
  audioWaveform: { size: 0.6 },
  posterizeTime: { rate: 1 },
  echo: { count: 4, delay: 120, decay: 0.7 },
};

const SHAPES: readonly { id: string; shape: Exclude<ShapeKind, "path">; fill: string; box: Omit<Transform, "rotation" | "opacity"> }[] = [
  { id: "sky", shape: "rect", fill: "#3b5b8c", box: { x: 0.5, y: 0.35, w: 1, h: 0.7 } },
  { id: MOVING_ID, shape: "ellipse", fill: "#f2c14e", box: { x: 0.64, y: 0.42, w: 0.26, h: 0.46 } },
  { id: "hill", shape: "rect", fill: "#e46a4f", box: { x: 0.3, y: 0.78, w: 0.5, h: 0.44 } },
];

const SUN_PATH = { from: 0.4, to: 0.8 } as const;

function backdropClip(entry: (typeof SHAPES)[number]): Clip {
  const transform: Transform = { ...entry.box, rotation: 0, opacity: 1 };
  const layer = { ...newShapeLayer(entry.shape, transform), id: `l-${entry.id}`, fill: entry.fill };
  const clip = { ...newOverlayClip(layer, 0, SAMPLE_MS, transform), id: `c-${entry.id}` };
  if (entry.id !== MOVING_ID) return clip;
  return { ...clip, keyframes: { x: [{ atMs: 0, value: SUN_PATH.from, easing: "linear" }, { atMs: SAMPLE_MS, value: SUN_PATH.to, easing: "linear" }] } };
}

function sampleVfx(kind: VfxKind): Vfx {
  const params = SAMPLE_PARAMS[kind];
  return { ...newVfx(kind, "vfx-sample", SAMPLE_SEED), ...(params ? { params } : {}), ...(listensToTrack(kind) ? { trackId: SAMPLE_SOUND_TRACK } : {}) };
}

export interface EffectSample {
  doc: VideoDocument;
  atMs: number;
  levels: TrackLevels;
}

function sampleFilm(effect: Clip[], onMoving: Vfx[] = []): VideoDocument {
  const doc = emptyVideoDocument("landscape", BACKDROP);
  doc.tracks = [
    ...SHAPES.map((entry, i) => {
      const clip = backdropClip(entry);
      return { id: `t-${entry.id}`, kind: "visual" as const, clips: [{ ...clip, id: `c-${i}-${entry.id}`, ...(entry.id === MOVING_ID && onMoving.length > 0 ? { vfx: onMoving } : {}) }] };
    }),
    ...(effect.length > 0 ? [{ id: "t-fx", kind: "visual" as const, clips: effect }] : []),
    { id: SAMPLE_SOUND_TRACK, kind: "audio" as const, clips: [] },
  ];
  doc.durationMs = SAMPLE_MS;
  return doc;
}

const SAMPLE_STEPS = SAMPLE_MS / LOUDNESS_STEP_MS + 1;

function sampleLevel(): TrackLevel {
  const db = Float32Array.from({ length: SAMPLE_STEPS }, (_, k) => -24 + 14 * Math.sin(k * 0.21) * Math.sin(k * 0.047));
  const bands = Array.from({ length: SPECTRUM_BANDS }, (_, band) => Float32Array.from({ length: SAMPLE_STEPS }, (_, k) => -14 - band * 0.55 + 9 * Math.sin(band * 0.9 + k * 0.13)));
  return { stepMs: LOUDNESS_STEP_MS, db, bands };
}

const SAMPLE_LEVEL = sampleLevel();

const SAMPLE_LEVELS: TrackLevels = (trackId) => (trackId === SAMPLE_SOUND_TRACK ? SAMPLE_LEVEL : undefined);

export function plainSample(): EffectSample {
  return { doc: sampleFilm([]), atMs: SAMPLE_AT_MS, levels: NO_LEVELS };
}

export function effectSample(kind: VfxKind): EffectSample {
  const vfx = sampleVfx(kind);
  const doc = refusedOnEffectClips(kind) ? sampleFilm([], [vfx]) : sampleFilm([{ ...newEffectClip([vfx], 0, SAMPLE_MS), id: "c-fx" }]);
  return { doc, atMs: SAMPLE_AT_MS, levels: listensToTrack(kind) ? SAMPLE_LEVELS : NO_LEVELS };
}
