import { lookValue, unitRgb, type VfxLook } from "./vfx";
import { eachPixel, mixInto, premultiplied, sampleFrom, tone, type Pixels, type Place, type Rgb, type VfxFrame } from "./vfx-pixel-kit";
import {
  brightOf,
  bulgeScale,
  centerOf,
  cornerPinInverse,
  directionalTaps,
  fractalValue,
  GLOW_GAIN,
  GLOW_HALF_TAPS,
  GLOW_WEIGHTS,
  glowStep,
  gradientWeights,
  mosaicCenter,
  pinnedSource,
  posterized,
  radians,
  rampPosition,
  reachRadius,
  rippleFalloff,
  spinTaps,
  tapPosition,
  twirlTurn,
  wavePhase,
  wrap,
  zoomTaps,
  type FrameSize,
} from "./vfx-shapes";

type Draw = (pixels: Pixels, frame: VfxFrame, look: VfxLook) => void;

type Point = [number, number];

const NEAR_CENTER = 1e-6;

function sizeOf(frame: VfxFrame): FrameSize {
  return { width: frame.unitsWide, height: frame.unitsHigh };
}

function remap(pixels: Pixels, frame: VfxFrame, weight: number, at: (place: Place) => Point | null): void {
  const original = premultiplied(pixels.data, pixels.width, pixels.height);
  const sample = sampleFrom(original, pixels.width, pixels.height, frame);
  const result = new Float32Array(4);
  eachPixel(pixels, frame, (i, place) => {
    const source = at(place);
    if (source) sample(source[0], source[1], result);
    else result.fill(0);
    mixInto(pixels.data, i, original, result, weight);
  });
}

function smear(pixels: Pixels, frame: VfxFrame, weight: number, taps: number, at: (place: Place, t: number) => Point): void {
  const original = premultiplied(pixels.data, pixels.width, pixels.height);
  const sample = sampleFrom(original, pixels.width, pixels.height, frame);
  const result = new Float32Array(4);
  const tap = new Float32Array(4);
  eachPixel(pixels, frame, (i, place) => {
    result.fill(0);
    for (let k = 0; k < taps; k++) {
      const [u, v] = at(place, tapPosition(k, taps));
      sample(u, v, tap);
      for (let c = 0; c < 4; c++) result[c] += tap[c];
    }
    for (let c = 0; c < 4; c++) result[c] /= taps;
    mixInto(pixels.data, i, original, result, weight);
  });
}

function fromPx(frame: VfxFrame, x: number, y: number): Point {
  return [x / frame.unitsWide, y / frame.unitsHigh];
}

function rotated(x: number, y: number, turn: number): Point {
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  return [x * c - y * s, x * s + y * c];
}

const directionalBlur: Draw = (pixels, frame, look) => {
  const turn = radians(lookValue(look, "angle"));
  const length = lookValue(look, "length");
  const dx = Math.cos(turn);
  const dy = Math.sin(turn);
  smear(pixels, frame, lookValue(look, "amount"), directionalTaps(look), (place, t) => {
    const along = (t - 0.5) * length;
    return fromPx(frame, place.px + dx * along, place.py + dy * along);
  });
};

const zoomBlur: Draw = (pixels, frame, look) => {
  const [cx, cy] = centerOf(look, sizeOf(frame));
  const length = lookValue(look, "length");
  smear(pixels, frame, lookValue(look, "amount"), zoomTaps(look, sizeOf(frame)), (place, t) => {
    const pull = length * t;
    return fromPx(frame, place.px + (cx - place.px) * pull, place.py + (cy - place.py) * pull);
  });
};

const spinBlur: Draw = (pixels, frame, look) => {
  const [cx, cy] = centerOf(look, sizeOf(frame));
  const arc = radians(lookValue(look, "angle"));
  smear(pixels, frame, lookValue(look, "amount"), spinTaps(look, sizeOf(frame)), (place, t) => {
    const [x, y] = rotated(place.px - cx, place.py - cy, (t - 0.5) * arc);
    return fromPx(frame, cx + x, cy + y);
  });
};

function blurPass(source: Float32Array, pixels: Pixels, frame: VfxFrame, du: number, dv: number, extract: (tap: Float32Array) => void): Float32Array {
  const sample = sampleFrom(source, pixels.width, pixels.height, frame);
  const out = new Float32Array(source.length);
  const tap = new Float32Array(4);
  eachPixel(pixels, frame, (i, place) => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let k = -GLOW_HALF_TAPS; k <= GLOW_HALF_TAPS; k++) {
      sample(place.u + k * du, place.v + k * dv, tap);
      extract(tap);
      const weight = GLOW_WEIGHTS[k + GLOW_HALF_TAPS];
      r += weight * tap[0];
      g += weight * tap[1];
      b += weight * tap[2];
    }
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = 1;
  });
  return out;
}

const glow: Draw = (pixels, frame, look) => {
  const threshold = lookValue(look, "threshold");
  const step = glowStep(look);
  const strength = lookValue(look, "amount") * GLOW_GAIN;
  const tint = unitRgb(look.colors.color);
  const original = premultiplied(pixels.data, pixels.width, pixels.height);
  const across = blurPass(original, pixels, frame, step / frame.unitsWide, 0, (tap) => {
    const alpha = tap[3];
    for (let c = 0; c < 3; c++) tap[c] = alpha > 0 ? brightOf(tap[c] / alpha, threshold) * alpha : 0;
  });
  const light = blurPass(across, pixels, frame, 0, step / frame.unitsHigh, () => undefined);
  const result = new Float32Array(4);
  eachPixel(pixels, frame, (i) => {
    const alpha = original[i + 3];
    let lit = 0;
    for (let c = 0; c < 3; c++) {
      const g = Math.min(1, light[i + c] * strength * tint[c]);
      result[c] = original[i + c] + g - original[i + c] * g;
      lit = Math.max(lit, g);
    }
    result[3] = alpha + lit - alpha * lit;
    mixInto(pixels.data, i, original, result, 1);
  });
};

const mosaic: Draw = (pixels, frame, look) => {
  const size = lookValue(look, "size");
  remap(pixels, frame, lookValue(look, "amount"), (place) => fromPx(frame, mosaicCenter(place.px, size, frame.unitsWide), mosaicCenter(place.py, size, frame.unitsHigh)));
};

const posterize: Draw = (pixels, frame, look) => {
  const amount = lookValue(look, "amount");
  const levels = lookValue(look, "levels");
  tone(pixels, frame, (c) => c.map((channel) => channel + (posterized(channel, levels) - channel) * amount) as Rgb);
};

const mirror: Draw = (pixels, frame, look) => {
  const [cx, cy] = centerOf(look, sizeOf(frame));
  const turn = radians(lookValue(look, "angle"));
  const nx = Math.cos(turn);
  const ny = Math.sin(turn);
  remap(pixels, frame, lookValue(look, "amount"), (place) => {
    const d = (place.px - cx) * nx + (place.py - cy) * ny;
    return d > 0 ? fromPx(frame, place.px - 2 * d * nx, place.py - 2 * d * ny) : [place.u, place.v];
  });
};

const offset: Draw = (pixels, frame, look) => {
  const sx = lookValue(look, "shiftX");
  const sy = lookValue(look, "shiftY");
  remap(pixels, frame, lookValue(look, "amount"), (place) => [wrap(place.u - sx), wrap(place.v - sy)]);
};

const waveWarp: Draw = (pixels, frame, look) => {
  const turn = radians(lookValue(look, "angle"));
  const dx = Math.cos(turn);
  const dy = Math.sin(turn);
  const height = lookValue(look, "height");
  remap(pixels, frame, lookValue(look, "amount"), (place) => {
    const shift = height * Math.sin(wavePhase(look, place.px * dx + place.py * dy));
    return fromPx(frame, place.px + dy * shift, place.py - dx * shift);
  });
};

const ripple: Draw = (pixels, frame, look) => {
  const [cx, cy] = centerOf(look, sizeOf(frame));
  const radius = reachRadius(look, sizeOf(frame));
  const height = lookValue(look, "height");
  remap(pixels, frame, lookValue(look, "amount"), (place) => {
    const vx = place.px - cx;
    const vy = place.py - cy;
    const r = Math.hypot(vx, vy);
    if (r < NEAR_CENTER) return [place.u, place.v];
    const shift = height * Math.sin(wavePhase(look, r)) * rippleFalloff(r, radius);
    return fromPx(frame, place.px - (vx / r) * shift, place.py - (vy / r) * shift);
  });
};

const twirl: Draw = (pixels, frame, look) => {
  const [cx, cy] = centerOf(look, sizeOf(frame));
  const radius = reachRadius(look, sizeOf(frame));
  remap(pixels, frame, lookValue(look, "amount"), (place) => {
    const vx = place.px - cx;
    const vy = place.py - cy;
    const [x, y] = rotated(vx, vy, twirlTurn(look, Math.hypot(vx, vy), radius));
    return fromPx(frame, cx + x, cy + y);
  });
};

const bulge: Draw = (pixels, frame, look) => {
  const [cx, cy] = centerOf(look, sizeOf(frame));
  const radius = reachRadius(look, sizeOf(frame));
  remap(pixels, frame, lookValue(look, "amount"), (place) => {
    const vx = place.px - cx;
    const vy = place.py - cy;
    const s = bulgeScale(look, Math.hypot(vx, vy), radius);
    return fromPx(frame, cx + vx * s, cy + vy * s);
  });
};

const cornerPin: Draw = (pixels, frame, look) => {
  const inverse = cornerPinInverse(look);
  remap(pixels, frame, lookValue(look, "amount"), (place) => (inverse ? pinnedSource(inverse, place.u, place.v) : null));
};

function paint(pixels: Pixels, frame: VfxFrame, look: VfxLook, colorAt: (place: Place) => Rgb): void {
  const amount = lookValue(look, "amount");
  tone(pixels, frame, (c, place) => {
    const generated = colorAt(place);
    return [c[0] + (generated[0] - c[0]) * amount, c[1] + (generated[1] - c[1]) * amount, c[2] + (generated[2] - c[2]) * amount];
  });
}

function between(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const fractalNoise: Draw = (pixels, frame, look) => {
  const dark = unitRgb(look.colors.color);
  const light = unitRgb(look.colors.color2);
  paint(pixels, frame, look, (place) => between(dark, light, fractalValue(look, place.px, place.py)));
};

const gradientRamp: Draw = (pixels, frame, look) => {
  const from = unitRgb(look.colors.color);
  const to = unitRgb(look.colors.color2);
  paint(pixels, frame, look, (place) => between(from, to, rampPosition(look, sizeOf(frame), place.px, place.py)));
};

const fourColorGradient: Draw = (pixels, frame, look) => {
  const colors = [look.colors.color, look.colors.color2, look.colors.color3, look.colors.color4].map(unitRgb);
  paint(pixels, frame, look, (place) => {
    const weights = gradientWeights(look, sizeOf(frame), place.px, place.py);
    return [0, 1, 2].map((c) => weights.reduce((sum, weight, k) => sum + weight * colors[k][c], 0)) as Rgb;
  });
};

export const PACK_PIXELS = {
  glow,
  mosaic,
  posterize,
  mirror,
  offset,
  directionalBlur,
  zoomBlur,
  spinBlur,
  waveWarp,
  ripple,
  twirl,
  bulge,
  cornerPin,
  fractalNoise,
  gradientRamp,
  fourColorGradient,
} satisfies Record<string, Draw>;
