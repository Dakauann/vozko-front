import { lumaAt, type LumaImage } from "./luma";

export const TRACKING = {
  lostBelow: 0.6,
  refreshAbove: 0.85,
  flatBelow: 2,
  minSide: 5,
  minRadius: 8,
  radiusShare: 0.75,
  coarseAbove: 6,
  refineRadius: 2,
  refineSteps: 10,
  refineSettled: 0.002,
} as const;

export interface PatternBox {
  x: number;
  y: number;
  side: number;
}

export interface TrackPoint {
  x: number;
  y: number;
}

export interface TrackStep extends TrackPoint {
  confidence: number;
  lost: boolean;
}

export type TrackRefusal = "flat" | "outside";

interface Template {
  width: number;
  height: number;
  raw: Float32Array;
  zero: Float32Array;
  norm: number;
  residualX: number;
  residualY: number;
  coarse: Template | null;
  slope: Slope | null;
}

interface Slope {
  gx: Float32Array;
  gy: Float32Array;
  inverse: [number, number, number];
}

interface Region {
  left: number;
  top: number;
  width: number;
  height: number;
  values: Float32Array;
  sums: Float64Array;
  squares: Float64Array;
}

interface Match {
  x: number;
  y: number;
  score: number;
}

function crop(image: LumaImage, left: number, top: number, width: number, height: number): Float32Array {
  const values = new Float32Array(width * height);
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) values[j * width + i] = lumaAt(image, left + i, top + j);
  return values;
}

function halved(values: Float32Array, width: number, height: number): { values: Float32Array; width: number; height: number } {
  const w = width >> 1;
  const h = height >> 1;
  const out = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const at = 2 * j * width + 2 * i;
      out[j * w + i] = (values[at] + values[at + 1] + values[at + width] + values[at + width + 1]) / 4;
    }
  }
  return { values: out, width: w, height: h };
}

function templateOf(raw: Float32Array, width: number, height: number, residualX: number, residualY: number, coarse: boolean): Template {
  const count = width * height;
  let mean = 0;
  for (let i = 0; i < count; i++) mean += raw[i];
  mean /= count;
  const zero = new Float32Array(count);
  let energy = 0;
  for (let i = 0; i < count; i++) {
    zero[i] = raw[i] - mean;
    energy += zero[i] * zero[i];
  }
  const half = coarse ? halved(raw, width, height) : null;
  return {
    width,
    height,
    raw,
    zero,
    norm: Math.sqrt(energy),
    residualX,
    residualY,
    coarse: half && half.width >= 3 && half.height >= 3 ? templateOf(half.values, half.width, half.height, 0, 0, false) : null,
    slope: coarse ? slopeOf(raw, width, height) : null,
  };
}

function slopeOf(raw: Float32Array, width: number, height: number): Slope | null {
  const gx = new Float32Array(width * height);
  const gy = new Float32Array(width * height);
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (let j = 1; j < height - 1; j++) {
    for (let i = 1; i < width - 1; i++) {
      const at = j * width + i;
      gx[at] = (raw[at + 1] - raw[at - 1]) / 2;
      gy[at] = (raw[at + width] - raw[at - width]) / 2;
      xx += gx[at] * gx[at];
      xy += gx[at] * gy[at];
      yy += gy[at] * gy[at];
    }
  }
  const det = xx * yy - xy * xy;
  return det > 1e-6 ? { gx, gy, inverse: [yy / det, -xy / det, xx / det] } : null;
}

function sampled(frame: LumaImage, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const top = lumaAt(frame, x0, y0) * (1 - fx) + lumaAt(frame, x0 + 1, y0) * fx;
  const bottom = lumaAt(frame, x0, y0 + 1) * (1 - fx) + lumaAt(frame, x0 + 1, y0 + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}

function warped(frame: LumaImage, template: Template, left: number, top: number, into: Float32Array): void {
  for (let j = 0; j < template.height; j++) for (let i = 0; i < template.width; i++) into[j * template.width + i] = sampled(frame, left + i, top + j);
}

function correlation(values: Float32Array, template: Template): number {
  const count = values.length;
  let sum = 0;
  let squares = 0;
  let cross = 0;
  for (let i = 0; i < count; i++) {
    sum += values[i];
    squares += values[i] * values[i];
    cross += values[i] * template.zero[i];
  }
  const spread = squares - (sum * sum) / count;
  return spread <= 1e-6 || template.norm <= 1e-6 ? 0 : cross / (template.norm * Math.sqrt(spread));
}

function polished(frame: LumaImage, template: Template, left: number, top: number): Match {
  const values = new Float32Array(template.width * template.height);
  const slope = template.slope;
  let x = left;
  let y = top;
  if (slope) {
    const count = values.length;
    const tmean = template.raw.reduce((a, b) => a + b, 0) / count;
    const tstd = template.norm / Math.sqrt(count);
    for (let step = 0; step < TRACKING.refineSteps; step++) {
      warped(frame, template, x, y, values);
      let mean = 0;
      for (let i = 0; i < count; i++) mean += values[i];
      mean /= count;
      let spread = 0;
      for (let i = 0; i < count; i++) spread += (values[i] - mean) * (values[i] - mean);
      const std = Math.sqrt(spread / count);
      if (std <= 1e-6) break;
      const gain = tstd / std;
      let bx = 0;
      let by = 0;
      for (let i = 0; i < count; i++) {
        const error = (values[i] - mean) * gain + tmean - template.raw[i];
        bx += slope.gx[i] * error;
        by += slope.gy[i] * error;
      }
      const [a, b, c] = slope.inverse;
      const dx = a * bx + b * by;
      const dy = b * bx + c * by;
      if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 1 || Math.abs(dy) > 1) break;
      x -= dx;
      y -= dy;
      if (Math.hypot(dx, dy) < TRACKING.refineSettled) break;
    }
    if (Math.hypot(x - left, y - top) > 1) {
      x = left;
      y = top;
    }
  }
  warped(frame, template, x, y, values);
  return { x, y, score: correlation(values, template) };
}

function regionOf(values: Float32Array, left: number, top: number, width: number, height: number): Region {
  const stride = width + 1;
  const sums = new Float64Array(stride * (height + 1));
  const squares = new Float64Array(stride * (height + 1));
  for (let j = 0; j < height; j++) {
    let row = 0;
    let rowSquares = 0;
    for (let i = 0; i < width; i++) {
      const v = values[j * width + i];
      row += v;
      rowSquares += v * v;
      sums[(j + 1) * stride + i + 1] = sums[j * stride + i + 1] + row;
      squares[(j + 1) * stride + i + 1] = squares[j * stride + i + 1] + rowSquares;
    }
  }
  return { left, top, width, height, values, sums, squares };
}

function boxSum(table: Float64Array, stride: number, x: number, y: number, w: number, h: number): number {
  return table[(y + h) * stride + x + w] - table[y * stride + x + w] - table[(y + h) * stride + x] + table[y * stride + x];
}

function scoreAt(region: Region, template: Template, ox: number, oy: number): number {
  const { width: tw, height: th, zero } = template;
  const stride = region.width + 1;
  const count = tw * th;
  const sum = boxSum(region.sums, stride, ox, oy, tw, th);
  const spread = boxSum(region.squares, stride, ox, oy, tw, th) - (sum * sum) / count;
  if (spread <= 1e-6 || template.norm <= 1e-6) return 0;
  let cross = 0;
  const values = region.values;
  for (let j = 0; j < th; j++) {
    const row = (oy + j) * region.width + ox;
    const trow = j * tw;
    for (let i = 0; i < tw; i++) cross += values[row + i] * zero[trow + i];
  }
  return cross / (template.norm * Math.sqrt(spread));
}

function bestIn(region: Region, template: Template, x0: number, y0: number, x1: number, y1: number): Match {
  let best: Match = { x: x0, y: y0, score: -Infinity };
  for (let oy = y0; oy <= y1; oy++) {
    for (let ox = x0; ox <= x1; ox++) {
      const score = scoreAt(region, template, ox, oy);
      if (score > best.score) best = { x: ox, y: oy, score };
    }
  }
  return best;
}

function vertex(before: number, at: number, after: number): number {
  const curve = before - 2 * at + after;
  if (curve >= 0) return 0;
  return Math.max(-0.5, Math.min(0.5, (before - after) / (2 * curve)));
}

function refined(region: Region, template: Template, match: Match): Match {
  const maxX = region.width - template.width;
  const maxY = region.height - template.height;
  const score = (x: number, y: number) => (x < 0 || y < 0 || x > maxX || y > maxY ? match.score : scoreAt(region, template, x, y));
  const dx = vertex(score(match.x - 1, match.y), match.score, score(match.x + 1, match.y));
  const dy = vertex(score(match.x, match.y - 1), match.score, score(match.x, match.y + 1));
  return { x: match.x + dx, y: match.y + dy, score: match.score };
}

function locate(frame: LumaImage, template: Template, predicted: TrackPoint, radius: number): Match {
  const corner = cornerOf(template, predicted);
  const left = Math.round(corner.x) - radius;
  const top = Math.round(corner.y) - radius;
  const width = template.width + 2 * radius;
  const height = template.height + 2 * radius;
  const values = crop(frame, left, top, width, height);
  const region = regionOf(values, left, top, width, height);
  const span = 2 * radius;
  let match: Match;
  if (radius > TRACKING.coarseAbove && template.coarse) {
    const half = halved(values, width, height);
    const coarseRegion = regionOf(half.values, 0, 0, half.width, half.height);
    const coarse = bestIn(coarseRegion, template.coarse, 0, 0, half.width - template.coarse.width, half.height - template.coarse.height);
    const reach = TRACKING.refineRadius;
    match = bestIn(region, template, Math.max(0, coarse.x * 2 - reach), Math.max(0, coarse.y * 2 - reach), Math.min(span, coarse.x * 2 + reach), Math.min(span, coarse.y * 2 + reach));
  } else {
    match = bestIn(region, template, 0, 0, span, span);
  }
  const fine = refined(region, template, match);
  return { x: left + fine.x, y: top + fine.y, score: fine.score };
}

function centerOf(template: Template, corner: TrackPoint): TrackPoint {
  return { x: corner.x + template.width / 2 + template.residualX, y: corner.y + template.height / 2 + template.residualY };
}

function cornerOf(template: Template, center: TrackPoint): TrackPoint {
  return { x: center.x - template.width / 2 - template.residualX, y: center.y - template.height / 2 - template.residualY };
}

function captured(frame: LumaImage, point: TrackPoint, side: number): Template {
  const left = Math.round(point.x - side / 2);
  const top = Math.round(point.y - side / 2);
  return templateOf(crop(frame, left, top, side, side), side, side, point.x - (left + side / 2), point.y - (top + side / 2), true);
}

function inside(frame: LumaImage, point: TrackPoint): boolean {
  return point.x >= 0 && point.y >= 0 && point.x <= frame.width && point.y <= frame.height;
}

export class PatternTracker {
  private recent: Template | null = null;
  private velocity: TrackPoint = { x: 0, y: 0 };
  private current: TrackPoint;

  private constructor(
    private readonly reference: Template,
    readonly origin: TrackPoint,
    private readonly radius: number,
  ) {
    this.current = origin;
  }

  static start(frame: LumaImage, box: PatternBox): PatternTracker | TrackRefusal {
    const origin = { x: box.x, y: box.y };
    if (!inside(frame, origin)) return "outside";
    const side = Math.max(TRACKING.minSide, Math.round(box.side));
    const reference = captured(frame, origin, side);
    if (reference.norm / Math.sqrt(side * side) < TRACKING.flatBelow) return "flat";
    return new PatternTracker(reference, origin, Math.max(TRACKING.minRadius, Math.ceil(side * TRACKING.radiusShare)));
  }

  get position(): TrackPoint {
    return this.current;
  }

  step(frame: LumaImage): TrackStep {
    const predicted = { x: this.current.x + this.velocity.x, y: this.current.y + this.velocity.y };
    const templates = [this.reference, ...(this.recent ? [this.recent] : [])];
    const found = templates.map((template) => ({ template, match: locate(frame, template, predicted, this.radius) }));
    const best = found.reduce((a, b) => (b.match.score > a.match.score ? b : a));
    const anchored = found[0].match.score >= TRACKING.refreshAbove ? found[0] : best;
    const fine = polished(frame, anchored.template, anchored.match.x, anchored.match.y);
    const confidence = Math.max(0, Math.min(1, fine.score));
    const point = centerOf(anchored.template, fine);
    if (confidence < TRACKING.lostBelow || !inside(frame, point)) return { ...point, confidence, lost: true };
    this.velocity = { x: point.x - this.current.x, y: point.y - this.current.y };
    this.current = point;
    if (confidence >= TRACKING.refreshAbove) this.recent = captured(frame, point, this.reference.width);
    return { ...point, confidence, lost: false };
  }

  rewind(): void {
    this.current = this.origin;
    this.velocity = { x: 0, y: 0 };
    this.recent = null;
  }
}
