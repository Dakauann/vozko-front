import { CHROMATIC_REACH, hash4, lookValue, type VfxLook } from "./vfx";

export const MAX_BLUR_TAPS = 64;
const TAP_SPACING_PX = 1.5;
const EDGE_REACH_PX = 1;
const DEGENERATE = 1e-9;
const FULL_TURN = Math.PI * 2;

export interface FrameSize {
  width: number;
  height: number;
}

export function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function blurTaps(spanPx: number): number {
  return Math.min(MAX_BLUR_TAPS, Math.max(2, Math.ceil(spanPx / TAP_SPACING_PX) + 1));
}

export function centerOf(look: VfxLook, frame: FrameSize): [number, number] {
  return [lookValue(look, "x") * frame.width, lookValue(look, "y") * frame.height];
}

export function farthestCorner(cx: number, cy: number, frame: FrameSize): number {
  return Math.hypot(Math.max(cx, frame.width - cx), Math.max(cy, frame.height - cy));
}

export function directionalTaps(look: VfxLook): number {
  return blurTaps(lookValue(look, "length"));
}

export function zoomTaps(look: VfxLook, frame: FrameSize): number {
  const [cx, cy] = centerOf(look, frame);
  return blurTaps(lookValue(look, "length") * farthestCorner(cx, cy, frame));
}

export function spinTaps(look: VfxLook, frame: FrameSize): number {
  const [cx, cy] = centerOf(look, frame);
  return blurTaps(radians(lookValue(look, "angle")) * farthestCorner(cx, cy, frame));
}

export function tapPosition(index: number, taps: number): number {
  return index / (taps - 1);
}

export const GLOW_HALF_TAPS = 12;
export const GLOW_GAIN = 2;
const GLOW_SPREAD = 2.5;

export const GLOW_WEIGHTS: readonly number[] = (() => {
  const raw = Array.from({ length: GLOW_HALF_TAPS * 2 + 1 }, (_, i) => Math.exp(-0.5 * ((GLOW_SPREAD * (i - GLOW_HALF_TAPS)) / GLOW_HALF_TAPS) ** 2));
  const total = raw.reduce((sum, weight) => sum + weight, 0);
  return raw.map((weight) => weight / total);
})();

export function glowStep(look: VfxLook): number {
  return lookValue(look, "size") / GLOW_HALF_TAPS;
}

export function brightOf(channel: number, threshold: number): number {
  return Math.max(0, channel - threshold) / Math.max(1e-3, 1 - threshold);
}

export function posterized(channel: number, levels: number): number {
  return Math.min(1, Math.floor(channel * levels + 1e-4) / (levels - 1));
}

export function mosaicCenter(p: number, cell: number, extent: number): number {
  return Math.min(Math.max((Math.floor(p / cell) + 0.5) * cell, 0.5), Math.max(0.5, extent - 0.5));
}

export function wrap(value: number): number {
  return value - Math.floor(value);
}

export function seconds(look: VfxLook): number {
  return look.timeMs / 1000;
}

export function waveShift(look: VfxLook): number {
  return wrap(lookValue(look, "speed") * seconds(look));
}

export function wavePhase(look: VfxLook, along: number): number {
  return FULL_TURN * (along / lookValue(look, "length") - waveShift(look)) + radians(lookValue(look, "phase"));
}

export function rippleFalloff(r: number, radius: number): number {
  if (!(radius > 0)) return 0;
  const t = Math.min(1, r / radius);
  return 1 - t * t * (3 - 2 * t);
}

export function twirlTurn(look: VfxLook, r: number, radius: number): number {
  if (!(radius > 0) || r >= radius) return 0;
  const t = 1 - r / radius;
  return radians(lookValue(look, "angle")) * t * t;
}

export const BULGE_DEPTH = 0.75;

export function bulgeScale(look: VfxLook, r: number, radius: number): number {
  if (!(radius > 0) || r >= radius) return 1;
  const t = r / radius;
  const k = 1 - t * t;
  return 1 - lookValue(look, "height") * k * k * BULGE_DEPTH;
}

export function reachRadius(look: VfxLook, frame: FrameSize): number {
  return lookValue(look, "size") * Math.min(frame.width, frame.height);
}

export type Corners = readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]];

export function pinCorners(look: VfxLook): Corners {
  return [
    [lookValue(look, "topLeftX"), lookValue(look, "topLeftY")],
    [lookValue(look, "topRightX"), lookValue(look, "topRightY")],
    [lookValue(look, "bottomRightX"), lookValue(look, "bottomRightY")],
    [lookValue(look, "bottomLeftX"), lookValue(look, "bottomLeftY")],
  ];
}

function squareToQuad(corners: Corners): number[] | null {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = corners;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < DEGENERATE) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const h = (dx1 * dy3 - dx3 * dy1) / det;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}

function inverted(m: readonly number[]): number[] | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < DEGENERATE) return null;
  return [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((value) => value / det);
}

export function cornerPinInverse(look: VfxLook): number[] | null {
  const corners = pinCorners(look);
  const forward = squareToQuad(corners);
  const inverse = forward ? inverted(forward) : null;
  if (!inverse) return null;
  const cx = corners.reduce((sum, [x]) => sum + x, 0) / 4;
  const cy = corners.reduce((sum, [, y]) => sum + y, 0) / 4;
  const w = inverse[6] * cx + inverse[7] * cy + inverse[8];
  return w < 0 ? inverse.map((value) => -value) : inverse;
}

export function pinnedSource(inverse: readonly number[], u: number, v: number): [number, number] | null {
  const w = inverse[6] * u + inverse[7] * v + inverse[8];
  if (!(w > 0)) return null;
  const su = (inverse[0] * u + inverse[1] * v + inverse[2]) / w;
  const sv = (inverse[3] * u + inverse[4] * v + inverse[5]) / w;
  return su >= 0 && su <= 1 && sv >= 0 && sv <= 1 ? [su, sv] : null;
}

export const NOISE_CONTRAST = 1.8;
export const NOISE_TIME_CHANNELS = 8;

export function noiseTime(look: VfxLook): number {
  return seconds(look) * lookValue(look, "speed");
}

function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

export function valueNoise(seed: number, octave: number, x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = fade(x - ix);
  const fy = fade(y - iy);
  const fz = fade(z - iz);
  const corner = (dx: number, dy: number, dz: number) => hash4(seed, ix + dx, iy + dy, (iz + dz) * NOISE_TIME_CHANNELS + octave);
  const layer = (dz: number) => {
    const top = corner(0, 0, dz) + (corner(1, 0, dz) - corner(0, 0, dz)) * fx;
    const bottom = corner(0, 1, dz) + (corner(1, 1, dz) - corner(0, 1, dz)) * fx;
    return top + (bottom - top) * fy;
  };
  const near = layer(0);
  return near + (layer(1) - near) * fz;
}

export function fractalValue(look: VfxLook, px: number, py: number): number {
  const complexity = lookValue(look, "complexity");
  const size = lookValue(look, "size");
  const z = noiseTime(look);
  const octaves = Math.ceil(complexity);
  let sum = 0;
  let total = 0;
  let amp = 1;
  let scale = 1 / size;
  for (let octave = 0; octave < octaves; octave++) {
    const weight = Math.min(1, complexity - octave) * amp;
    sum += valueNoise(look.seed, octave, px * scale, py * scale, z) * weight;
    total += weight;
    amp *= 0.5;
    scale *= 2;
  }
  const v = sum / total;
  return Math.min(1, Math.max(0, (v - 0.5) * lookValue(look, "contrast") * NOISE_CONTRAST + 0.5 + lookValue(look, "brightness")));
}

const MIN_RAMP = 1e-6;

export function rampPosition(look: VfxLook, frame: FrameSize, px: number, py: number): number {
  const sx = lookValue(look, "x") * frame.width;
  const sy = lookValue(look, "y") * frame.height;
  const ex = lookValue(look, "toX") * frame.width - sx;
  const ey = lookValue(look, "toY") * frame.height - sy;
  const span = Math.max(ex * ex + ey * ey, MIN_RAMP);
  const linear = ((px - sx) * ex + (py - sy) * ey) / span;
  const round = Math.hypot(px - sx, py - sy) / Math.sqrt(span);
  const radial = lookValue(look, "radial");
  return Math.min(1, Math.max(0, linear + (round - linear) * radial));
}

export const GRADIENT_POWER = [6, 1] as const;
const MIN_DISTANCE = 1e-3;

export function gradientPower(look: VfxLook): number {
  return GRADIENT_POWER[0] + (GRADIENT_POWER[1] - GRADIENT_POWER[0]) * lookValue(look, "softness");
}

export function gradientWeights(look: VfxLook, frame: FrameSize, px: number, py: number): [number, number, number, number] {
  const diagonal = Math.hypot(frame.width, frame.height);
  const power = gradientPower(look);
  const weights = pinCorners(look).map(([x, y]) => Math.max(Math.hypot(px - x * frame.width, py - y * frame.height) / diagonal, MIN_DISTANCE) ** -power);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => weight / total) as [number, number, number, number];
}

export function lookReach(look: VfxLook, frame: FrameSize): number {
  switch (look.kind) {
    case "glitch":
      return lookValue(look, "split");
    case "chromaticAberration":
      return lookValue(look, "amount") * CHROMATIC_REACH;
    case "glow":
      return lookValue(look, "size");
    case "directionalBlur":
      return lookValue(look, "length") / 2 + EDGE_REACH_PX;
    case "zoomBlur": {
      const [cx, cy] = centerOf(look, frame);
      return lookValue(look, "length") * farthestCorner(cx, cy, frame) + EDGE_REACH_PX;
    }
    case "spinBlur": {
      const [cx, cy] = centerOf(look, frame);
      return Math.sin(Math.min(Math.PI / 2, radians(lookValue(look, "angle")) / 2)) * farthestCorner(cx, cy, frame) + EDGE_REACH_PX;
    }
    case "waveWarp":
    case "ripple":
      return lookValue(look, "height") + EDGE_REACH_PX;
    case "cornerPin": {
      const over = pinCorners(look).flatMap(([x, y]) => [Math.max(0, -x, x - 1) * frame.width, Math.max(0, -y, y - 1) * frame.height]);
      return Math.max(...over) + EDGE_REACH_PX;
    }
    case "mosaic":
    case "mirror":
    case "offset":
    case "twirl":
    case "bulge":
      return EDGE_REACH_PX;
    default:
      return 0;
  }
}

export const SOUND_MIN_BAR_PX = 2;

export interface BarLayout {
  left: number;
  slot: number;
  barWidth: number;
  inset: number;
  baseline: number;
  reach: number;
  radius: number;
  centered: boolean;
}

export function barLayout(look: VfxLook, frame: FrameSize, count: number): BarLayout {
  const span = lookValue(look, "width") * frame.width;
  const slot = span / count;
  const barWidth = slot * (1 - lookValue(look, "gap"));
  return {
    left: lookValue(look, "x") * frame.width - span / 2,
    slot,
    barWidth,
    inset: (slot - barWidth) / 2,
    baseline: lookValue(look, "y") * frame.height,
    reach: lookValue(look, "size") * frame.height,
    radius: (lookValue(look, "roundness") * barWidth) / 2,
    centered: look.kind === "audioWaveform",
  };
}

export function barHeight(layout: BarLayout, share: number): number {
  return Math.max(SOUND_MIN_BAR_PX, share * layout.reach);
}

function roundRectDistance(qx: number, qy: number, halfW: number, halfH: number, radius: number): number {
  const r = Math.min(radius, halfW, halfH);
  const dx = Math.abs(qx) - halfW + r;
  const dy = Math.abs(qy) - halfH + r;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
}

export interface BarHit {
  cover: number;
  tone: number;
}

export function barAt(layout: BarLayout, bars: readonly number[], px: number, py: number): BarHit {
  if (!(layout.slot > 0)) return { cover: 0, tone: 0 };
  const index = Math.floor((px - layout.left) / layout.slot);
  if (index < 0 || index >= bars.length) return { cover: 0, tone: 0 };
  const height = barHeight(layout, bars[index]);
  const cx = layout.left + (index + 0.5) * layout.slot;
  const cy = layout.centered ? layout.baseline : layout.baseline - height / 2;
  const distance = roundRectDistance(px - cx, py - cy, layout.barWidth / 2, height / 2, layout.radius);
  const cover = Math.min(1, Math.max(0, 0.5 - distance));
  const rise = layout.centered ? Math.abs(py - layout.baseline) * 2 : layout.baseline - py;
  return { cover, tone: Math.min(1, Math.max(0, rise / Math.max(layout.reach, 1))) };
}
