import type { StillLook } from "./still-vfx";
import { CHROMATIC_REACH, flareFlicker, flareGhosts, glitchBurst, grainFrame, hash4, leakBlobs, lookValue, unitRgb, vignetteWeight, type VfxLook } from "./vfx";
import { eachPixel, LUMA, sampler, screen, smoothstep, tone, writePremultiplied, type Pixels, type Place, type Rgb, type VfxFrame } from "./vfx-pixel-kit";
import { PACK_PIXELS } from "./vfx-pixels-pack";

export type { VfxFrame } from "./vfx-pixel-kit";

const SCANLINE_STEP = 2.0943951;
const GRAIN_SALT = 7919;

function grain(pixels: Pixels, frame: VfxFrame, look: VfxLook): void {
  const amount = lookValue(look, "amount");
  const size = lookValue(look, "size");
  const chroma = lookValue(look, "chroma");
  const key = grainFrame(look) * 3;
  const tri = (x: number, y: number, channel: number) => hash4(look.seed, x, y, key + channel) + hash4(look.seed + GRAIN_SALT, x, y, key + channel) - 1;
  const at = (px: number, py: number, channel: number) => {
    const cx = Math.floor(px);
    const cy = Math.floor(py);
    const fx = (px - cx) * (px - cx) * (3 - 2 * (px - cx));
    const fy = (py - cy) * (py - cy) * (3 - 2 * (py - cy));
    const top = tri(cx, cy, channel) + (tri(cx + 1, cy, channel) - tri(cx, cy, channel)) * fx;
    const bottom = tri(cx, cy + 1, channel) + (tri(cx + 1, cy + 1, channel) - tri(cx, cy + 1, channel)) * fx;
    return top + (bottom - top) * fy;
  };
  tone(pixels, frame, (c, place) => {
    const px = place.px / size;
    const py = place.py / size;
    const mono = at(px, py, 0);
    const noise: Rgb = chroma > 0 ? [mono, mono + (at(px, py, 1) - mono) * chroma, mono + (at(px, py, 2) - mono) * chroma] : [mono, mono, mono];
    const l = c[0] * LUMA[0] + c[1] * LUMA[1] + c[2] * LUMA[2];
    const gain = amount * 0.35 * (0.35 + 2.6 * l * (1 - l));
    return [c[0] + noise[0] * gain, c[1] + noise[1] * gain, c[2] + noise[2] * gain];
  });
}

function lightLeak(pixels: Pixels, frame: VfxFrame, look: VfxLook): void {
  const amount = lookValue(look, "amount");
  const blobs = leakBlobs(look, frame.unitsWide, frame.unitsHigh);
  const a = unitRgb(look.colors.color);
  const b = unitRgb(look.colors.color2);
  tone(pixels, frame, (c, place) => {
    const light: Rgb = [0, 0, 0];
    for (const blob of blobs) {
      const d = Math.hypot(place.px - blob.x, place.py - blob.y) / Math.max(blob.radius, 1);
      const weight = Math.exp(-d * d * 2.2) * blob.weight;
      for (let k = 0; k < 3; k++) light[k] += (a[k] + (b[k] - a[k]) * blob.tone) * weight;
    }
    return screen(c, light.map((value) => (1 - Math.exp(-value * 1.4)) * amount) as Rgb);
  });
}

function vignette(pixels: Pixels, frame: VfxFrame, look: VfxLook): void {
  const amount = lookValue(look, "amount");
  const color = unitRgb(look.colors.color);
  tone(pixels, frame, (c, place) => {
    const weight = vignetteWeight(look, place.u, place.v, frame.unitsWide, frame.unitsHigh) * amount;
    return [c[0] + (color[0] - c[0]) * weight, c[1] + (color[1] - c[1]) * weight, c[2] + (color[2] - c[2]) * weight];
  });
}

function lensFlare(pixels: Pixels, frame: VfxFrame, look: VfxLook): void {
  const { unitsWide: w, unitsHigh: h } = frame;
  const amount = lookValue(look, "amount") * flareFlicker(look);
  const sx = lookValue(look, "x") * w;
  const sy = lookValue(look, "y") * h;
  const shortest = Math.min(w, h);
  const reach = shortest * lookValue(look, "size");
  const ghosts = lookValue(look, "ghosts");
  const streak = lookValue(look, "streak");
  const color = unitRgb(look.colors.color);
  const shifted: Rgb = [color[2] * 0.6, color[1] * 0.9, color[0] * 1.2];
  const axisX = w * 0.5 - sx;
  const axisY = h * 0.5 - sy;
  const placed = flareGhosts(look).map((ghost) => ({ ...ghost, x: sx + axisX * (1 + ghost.along), y: sy + axisY * (1 + ghost.along) }));
  tone(pixels, frame, (c, place) => {
    const d = Math.hypot(place.px - sx, place.py - sy) / reach;
    const ring = (d - 0.32) * 18;
    const core = Math.exp(-d * 18) * 1.2 + Math.exp(-d * 4) * 0.35 + Math.exp(-ring * ring) * 0.12;
    const light: Rgb = [color[0] * core, color[1] * core, color[2] * core];
    for (const ghost of placed) {
      const gd = Math.hypot(place.px - ghost.x, place.py - ghost.y) / Math.max(ghost.radius * reach, 1);
      const disk = (1 - smoothstep(0.7, 1, gd)) * (0.6 + 0.4 * gd) * ghost.strength * 0.25 * ghosts;
      for (let k = 0; k < 3; k++) light[k] += (color[k] + (shifted[k] - color[k]) * ghost.tint) * disk;
    }
    const line = Math.exp((-Math.abs(place.py - sy) / shortest) * 140) * Math.exp((-Math.abs(place.px - sx) / reach) * 1.6) * 0.8 * streak;
    return screen(c, [(light[0] + color[0] * line) * amount, (light[1] + color[1] * line) * amount, (light[2] + color[2] * line) * amount]);
  });
}

function splitChannels(pixels: Pixels, frame: VfxFrame, shift: (place: Place) => { u: number; v: number; du: number; dv: number; dim: number }): void {
  const sample = sampler(pixels, frame);
  const r = new Float32Array(4);
  const g = new Float32Array(4);
  const b = new Float32Array(4);
  eachPixel(pixels, frame, (i, place) => {
    const s = shift(place);
    sample(s.u + s.du, s.v + s.dv, r);
    sample(s.u, s.v, g);
    sample(s.u - s.du, s.v - s.dv, b);
    writePremultiplied(pixels.data, i, r[0] * s.dim, g[1] * s.dim, b[2] * s.dim, Math.max(g[3], r[3], b[3]));
  });
}

function chromaticAberration(pixels: Pixels, frame: VfxFrame, look: VfxLook): void {
  const { unitsWide: w, unitsHigh: h } = frame;
  const shiftPx = lookValue(look, "amount") * CHROMATIC_REACH;
  const radial = lookValue(look, "radial");
  const turn = (lookValue(look, "angle") * Math.PI) / 180;
  const half = Math.min(w, h) * 0.5;
  splitChannels(pixels, frame, (place) => {
    const dx = Math.cos(turn) + ((place.px - w * 0.5) / half - Math.cos(turn)) * radial;
    const dy = Math.sin(turn) + ((place.py - h * 0.5) / half - Math.sin(turn)) * radial;
    return { u: place.u, v: place.v, du: (dx * shiftPx) / w, dv: (dy * shiftPx) / h, dim: 1 };
  });
}

function glitch(pixels: Pixels, frame: VfxFrame, look: VfxLook): void {
  const { unitsWide: w, unitsHigh: h } = frame;
  const amount = lookValue(look, "amount");
  const burst = glitchBurst(look);
  const bandHeight = Math.max(1, lookValue(look, "size") * h);
  const offset = (lookValue(look, "split") * (0.25 + 0.75 * burst.strength)) / w;
  const scanlines = lookValue(look, "scanlines");
  splitChannels(pixels, frame, (place) => {
    const band = Math.floor(place.py / bandHeight);
    const block = Math.floor(place.py / (bandHeight * 3.7));
    let shift = 0;
    if (burst.strength > 0) {
      if (hash4(look.seed, band, burst.slot, 11) < 0.3 + 0.4 * amount) shift += (hash4(look.seed, band, burst.slot, 12) - 0.5) * 0.24 * amount * w * burst.strength;
      if (hash4(look.seed, block, burst.slot, 13) < 0.15 * amount) shift += (hash4(look.seed, block, burst.slot, 14) - 0.5) * 0.25 * amount * w * burst.strength;
    }
    const line = 0.5 + 0.5 * Math.cos(place.py * SCANLINE_STEP);
    return { u: place.u + shift / w, v: place.v, du: offset, dv: 0, dim: 1 - scanlines * 0.3 * line };
  });
}

const DRAW: Record<StillLook["kind"], (pixels: Pixels, frame: VfxFrame, look: VfxLook) => void> = { grain, lightLeak, vignette, lensFlare, chromaticAberration, glitch, ...PACK_PIXELS };

export function applyVfxPixels(data: Uint8ClampedArray, width: number, height: number, looks: readonly StillLook[], frame: VfxFrame): void {
  if (frame.width <= 0 || frame.height <= 0) return;
  for (const look of looks) DRAW[look.kind]({ data, width, height }, frame, look);
}
