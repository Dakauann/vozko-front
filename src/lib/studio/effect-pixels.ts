import { blendColor, type Rgb } from "./blend-modes";
import { parseColor } from "./color";
import { isOuterEffect, type Effect, type EffectPlan, type StrokePaint } from "./layer-paint";

const FAR = 1e20;
const SEED = 0.5;
const KNOCKOUT_GAIN = 4;
const BOXES = 3;

function edt1d(f: Float64Array, n: number, out: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -FAR;
  z[1] = FAR;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = FAR;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    out[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

export function distanceToSeeds(matte: Float32Array, width: number, height: number, seedsAbove: boolean): Float32Array {
  const longest = Math.max(width, height);
  const f = new Float64Array(longest);
  const line = new Float64Array(longest);
  const v = new Int32Array(longest);
  const z = new Float64Array(longest + 1);
  const squared = new Float64Array(width * height);
  for (let i = 0; i < squared.length; i++) squared[i] = (matte[i] >= SEED) === seedsAbove ? 0 : FAR;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) f[y] = squared[y * width + x];
    edt1d(f, height, line, v, z);
    for (let y = 0; y < height; y++) squared[y * width + x] = line[y];
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) f[x] = squared[y * width + x];
    edt1d(f, width, line, v, z);
    for (let x = 0; x < width; x++) squared[y * width + x] = line[x];
  }
  const distance = new Float32Array(width * height);
  for (let i = 0; i < distance.length; i++) distance[i] = Math.sqrt(squared[i]);
  return distance;
}

function unit(value: number): number {
  return value <= 0 ? 0 : value >= 1 ? 1 : value;
}

export function spreadMatte(matte: Float32Array, width: number, height: number, radius: number): Float32Array {
  if (radius === 0) return matte;
  const out = new Float32Array(matte.length);
  if (radius > 0) {
    const distance = distanceToSeeds(matte, width, height, true);
    for (let i = 0; i < out.length; i++) out[i] = Math.max(matte[i], unit(radius + 1 - distance[i]));
    return out;
  }
  const distance = distanceToSeeds(matte, width, height, false);
  for (let i = 0; i < out.length; i++) out[i] = Math.min(matte[i], unit(distance[i] + radius));
  return out;
}

export function shiftedMatte(matte: Float32Array, width: number, height: number, dx: number, dy: number, fill: number): Float32Array {
  if (dx === 0 && dy === 0) return matte;
  const out = new Float32Array(matte.length);
  for (let y = 0; y < height; y++) {
    const sy = y - dy;
    for (let x = 0; x < width; x++) {
      const sx = x - dx;
      out[y * width + x] = sx >= 0 && sx < width && sy >= 0 && sy < height ? matte[sy * width + sx] : fill;
    }
  }
  return out;
}

function boxSizes(sigma: number): number[] {
  const ideal = Math.sqrt((12 * sigma * sigma) / BOXES + 1);
  let lower = Math.floor(ideal);
  if (lower % 2 === 0) lower--;
  const upper = lower + 2;
  const count = Math.round((12 * sigma * sigma - BOXES * lower * lower - 4 * BOXES * lower - 3 * BOXES) / (-4 * lower - 4));
  return Array.from({ length: BOXES }, (_, i) => (i < count ? lower : upper));
}

function boxPass(source: Float32Array, target: Float32Array, lines: number, length: number, step: number, stride: number, radius: number, edge: number): void {
  const scale = 1 / (2 * radius + 1);
  for (let l = 0; l < lines; l++) {
    const start = l * stride;
    let sum = 0;
    for (let i = -radius; i <= radius; i++) sum += i < 0 || i >= length ? edge : source[start + i * step];
    for (let i = 0; i < length; i++) {
      target[start + i * step] = sum * scale;
      const incoming = i + radius + 1;
      const outgoing = i - radius;
      sum += (incoming < length ? source[start + incoming * step] : edge) - (outgoing >= 0 ? source[start + outgoing * step] : edge);
    }
  }
}

export function gaussianBlur(values: Float32Array, width: number, height: number, sigma: number, edge: number): Float32Array {
  if (sigma < 0.5) return values;
  let current = Float32Array.from(values);
  let spare = new Float32Array(values.length);
  for (const size of boxSizes(sigma)) {
    const radius = (size - 1) / 2;
    if (radius < 1) continue;
    boxPass(current, spare, height, width, 1, width, radius, edge);
    [current, spare] = [spare, current];
    boxPass(current, spare, width, height, width, 1, radius, edge);
    [current, spare] = [spare, current];
  }
  return current;
}

interface Pixels {
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
  a: Float32Array;
}

function premultiplied(data: Uint8ClampedArray, count: number): Pixels {
  const pixels = { r: new Float32Array(count), g: new Float32Array(count), b: new Float32Array(count), a: new Float32Array(count) };
  for (let i = 0; i < count; i++) {
    const alpha = data[i * 4 + 3] / 255;
    pixels.a[i] = alpha;
    pixels.r[i] = (data[i * 4] / 255) * alpha;
    pixels.g[i] = (data[i * 4 + 1] / 255) * alpha;
    pixels.b[i] = (data[i * 4 + 2] / 255) * alpha;
  }
  return pixels;
}

function write(pixels: Pixels, data: Uint8ClampedArray): void {
  for (let i = 0; i < pixels.a.length; i++) {
    const alpha = pixels.a[i];
    if (alpha <= 0) {
      data.fill(0, i * 4, i * 4 + 4);
      continue;
    }
    data[i * 4] = Math.round((pixels.r[i] / alpha) * 255);
    data[i * 4 + 1] = Math.round((pixels.g[i] / alpha) * 255);
    data[i * 4 + 2] = Math.round((pixels.b[i] / alpha) * 255);
    data[i * 4 + 3] = Math.round(alpha * 255);
  }
}

interface Ink {
  rgb: Rgb;
  alpha: number;
}

function inkOf(color: string, opacity: number): Ink {
  const parsed = parseColor(color) ?? { r: 0, g: 0, b: 0, a: 0 };
  return { rgb: [parsed.r / 255, parsed.g / 255, parsed.b / 255], alpha: parsed.a * opacity };
}

function layerOver(top: Pixels, bottom: Pixels): void {
  for (let i = 0; i < top.a.length; i++) {
    const keep = 1 - top.a[i];
    bottom.r[i] = top.r[i] + bottom.r[i] * keep;
    bottom.g[i] = top.g[i] + bottom.g[i] * keep;
    bottom.b[i] = top.b[i] + bottom.b[i] * keep;
    bottom.a[i] = top.a[i] + bottom.a[i] * keep;
  }
}

function inked(coverage: Float32Array, ink: Ink): Pixels {
  const count = coverage.length;
  const pixels = { r: new Float32Array(count), g: new Float32Array(count), b: new Float32Array(count), a: new Float32Array(count) };
  for (let i = 0; i < count; i++) {
    const alpha = coverage[i] * ink.alpha;
    pixels.a[i] = alpha;
    pixels.r[i] = ink.rgb[0] * alpha;
    pixels.g[i] = ink.rgb[1] * alpha;
    pixels.b[i] = ink.rgb[2] * alpha;
  }
  return pixels;
}

function emptyPixels(count: number): Pixels {
  return { r: new Float32Array(count), g: new Float32Array(count), b: new Float32Array(count), a: new Float32Array(count) };
}

function outlineBand(alpha: Float32Array, outlines: readonly StrokePaint[], width: number, height: number, scale: number): Pixels {
  const distance = distanceToSeeds(alpha, width, height, true);
  const under = emptyPixels(alpha.length);
  for (const outline of outlines) {
    const reach = outline.width * scale;
    const band = new Float32Array(distance.length);
    for (let i = 0; i < band.length; i++) band[i] = unit(reach + 1 - distance[i]);
    layerOver(inked(band, inkOf(outline.color ?? "", outline.opacity)), under);
  }
  return under;
}

function traceOutlines(content: Pixels, outlines: readonly StrokePaint[], width: number, height: number, scale: number): void {
  if (outlines.length === 0) return;
  const under = outlineBand(content.a, outlines, width, height, scale);
  layerOver({ ...content }, under);
  Object.assign(content, under);
}

function effectMatte(effect: Effect, alpha: Float32Array, width: number, height: number, scale: number): Float32Array {
  const outer = isOuterEffect(effect.type);
  const fromCenter = effect.type === "inner-glow" && effect.source === "center";
  const edge = outer || fromCenter ? 0 : 1;
  const base = outer || fromCenter ? alpha : alpha.map((value) => 1 - value);
  const moved = shiftedMatte(base, width, height, Math.round(effect.x * scale), Math.round(effect.y * scale), edge);
  const spread = spreadMatte(moved, width, height, effect.spread * scale);
  return gaussianBlur(spread, width, height, (effect.blur * scale) / 2, edge);
}

function outerLayer(effect: Effect, alpha: Float32Array, width: number, height: number, scale: number): Pixels {
  const matte = effectMatte(effect, alpha, width, height, scale);
  if (!(effect.type === "drop-shadow" && effect.showBehind)) {
    for (let i = 0; i < matte.length; i++) matte[i] *= 1 - unit(alpha[i] * KNOCKOUT_GAIN);
  }
  return inked(matte, inkOf(effect.color, effect.opacity));
}

function paintInner(content: Pixels, effect: Effect, width: number, height: number, scale: number): void {
  const matte = effectMatte(effect, content.a, width, height, scale);
  const ink = inkOf(effect.color, effect.opacity);
  const mode = effect.blendMode || "normal";
  for (let i = 0; i < matte.length; i++) {
    const backdrop = content.a[i];
    const source = matte[i] * ink.alpha;
    if (backdrop <= 0 || source <= 0) continue;
    const under: Rgb = [content.r[i] / backdrop, content.g[i] / backdrop, content.b[i] / backdrop];
    const mixed = mode === "normal" ? ink.rgb : blendColor(mode, under, ink.rgb);
    const keep = 1 - source;
    content.r[i] = source * ((1 - backdrop) * ink.rgb[0] + backdrop * mixed[0]) * backdrop + keep * content.r[i];
    content.g[i] = source * ((1 - backdrop) * ink.rgb[1] + backdrop * mixed[1]) * backdrop + keep * content.g[i];
    content.b[i] = source * ((1 - backdrop) * ink.rgb[2] + backdrop * mixed[2]) * backdrop + keep * content.b[i];
  }
}

function outerBackdrop(alpha: Float32Array, outer: readonly Effect[], width: number, height: number, scale: number): Pixels {
  const behind = emptyPixels(alpha.length);
  for (const effect of [...outer].reverse()) layerOver(outerLayer(effect, alpha, width, height, scale), behind);
  return behind;
}

export function applyLayerEffects(data: Uint8ClampedArray, width: number, height: number, plan: EffectPlan, scale: number): void {
  if (plan.effects.length === 0 && plan.outlines.length === 0) return;
  const content = premultiplied(data, width * height);
  traceOutlines(content, plan.outlines, width, height, scale);
  const alpha = Float32Array.from(content.a);
  const inner = plan.effects.filter((effect) => !isOuterEffect(effect.type));
  const outer = plan.effects.filter((effect) => isOuterEffect(effect.type));
  for (const effect of [...inner].reverse()) paintInner(content, effect, width, height, scale);
  if (outer.length > 0) {
    const behind = outerBackdrop(alpha, outer, width, height, scale);
    layerOver(content, behind);
    Object.assign(content, behind);
  }
  write(content, data);
}

export function effectHalo(alpha: Float32Array, width: number, height: number, plan: EffectPlan, scale: number): Uint8ClampedArray<ArrayBuffer> {
  const under = plan.outlines.length > 0 ? outlineBand(alpha, plan.outlines, width, height, scale) : emptyPixels(alpha.length);
  const combined = alpha.map((value, i) => value + under.a[i] * (1 - value));
  const outer = plan.effects.filter((effect) => isOuterEffect(effect.type));
  const halo = outer.length > 0 ? outerBackdrop(combined, outer, width, height, scale) : emptyPixels(alpha.length);
  layerOver(under, halo);
  const data = new Uint8ClampedArray(width * height * 4);
  write(halo, data);
  return data;
}
