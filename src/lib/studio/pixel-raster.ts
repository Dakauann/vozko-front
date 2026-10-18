import { tipAlpha, walkDabs, type Dab, type DabCursor } from "./brush";
import { gaussianBlur } from "./effect-pixels";
import { addsInk, clipRect, opReach, SUBTRACT, unionRect, type AreaOp, type PixelOp, type PixelRect, type PixelSurface, type StrokeOp } from "./pixel-surface";

export interface PixelBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

interface Coverage extends PixelRect {
  data: Float32Array;
}

export interface SurfaceSize {
  width: number;
  height: number;
}

const FEATHER_REACH = 1.5;
const BLACK: readonly [number, number, number] = [0, 0, 0];

export function createPixels(width: number, height: number): PixelBuffer {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

function pixelAligned(rect: PixelRect): PixelRect {
  const x = Math.floor(rect.x);
  const y = Math.floor(rect.y);
  return { x, y, width: Math.ceil(rect.x + rect.width) - x, height: Math.ceil(rect.y + rect.height) - y };
}

function emptyCoverage(rect: PixelRect): Coverage {
  return { ...rect, data: new Float32Array(rect.width * rect.height) };
}

function dabBox(dab: Dab, area: PixelRect): PixelRect | null {
  const reach = dab.radius + 0.5;
  const x0 = Math.max(area.x, Math.floor(dab.x - reach));
  const y0 = Math.max(area.y, Math.floor(dab.y - reach));
  const x1 = Math.min(area.x + area.width, Math.ceil(dab.x + reach));
  const y1 = Math.min(area.y + area.height, Math.ceil(dab.y + reach));
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

function stamp(coverage: Coverage, dab: Dab, hardness: number): PixelRect | null {
  const box = dabBox(dab, coverage);
  if (!box) return null;
  const { data, width } = coverage;
  const reach = (dab.radius + 0.5) ** 2;
  for (let py = box.y; py < box.y + box.height; py++) {
    const dy = py + 0.5 - dab.y;
    const row = (py - coverage.y) * width - coverage.x;
    for (let px = box.x; px < box.x + box.width; px++) {
      if (data[row + px] >= 1) continue;
      const dx = px + 0.5 - dab.x;
      const squared = dx * dx + dy * dy;
      if (squared >= reach) continue;
      const alpha = tipAlpha(Math.sqrt(squared), dab.radius, hardness);
      if (alpha > data[row + px]) data[row + px] = alpha;
    }
  }
  return box;
}

function strideOf(op: StrokeOp): 2 | 3 {
  return op.pressure ? 3 : 2;
}

function surfaceRect(size: SurfaceSize): PixelRect {
  return { x: 0, y: 0, width: size.width, height: size.height };
}

export function strokeCoverage(op: StrokeOp, size: SurfaceSize): Coverage | null {
  const reach = opReach(op, size);
  const rect = reach ? clipRect(pixelAligned({ x: reach.x - 1, y: reach.y - 1, width: reach.width + 2, height: reach.height + 2 }), size.width, size.height) : null;
  if (!rect) return null;
  const coverage = emptyCoverage(rect);
  walkDabs(op.points, strideOf(op), op.size, null, (dab) => stamp(coverage, dab, op.hardness));
  return coverage;
}

export class LiveStroke {
  readonly coverage: Coverage;
  bounds: PixelRect | null = null;
  private cursor: DabCursor | null = null;

  constructor(
    public op: StrokeOp,
    size: SurfaceSize,
  ) {
    this.coverage = emptyCoverage(surfaceRect(size));
    this.extend(op);
  }

  extend(op: StrokeOp): PixelRect | null {
    this.op = op;
    let dirty: PixelRect | null = null;
    this.cursor = walkDabs(op.points, strideOf(op), op.size, this.cursor, (dab) => {
      dirty = unionRect(dirty, stamp(this.coverage, dab, op.hardness));
    });
    this.bounds = unionRect(this.bounds, dirty);
    return dirty;
  }
}

function drawSegment(acc: Float32Array, stride: number, height: number, x0: number, y0: number, x1: number, y1: number): void {
  if (Math.abs(y0 - y1) <= 1e-9) return;
  let dir = 1;
  if (y0 > y1) {
    dir = -1;
    [x0, x1] = [x1, x0];
    [y0, y1] = [y1, y0];
  }
  const dxdy = (x1 - x0) / (y1 - y0);
  let x = y0 < 0 ? x0 - y0 * dxdy : x0;
  const end = Math.min(height, Math.ceil(y1));
  for (let y = Math.max(0, Math.floor(y0)); y < end; y++) {
    const line = y * stride;
    const dy = Math.min(y + 1, y1) - Math.max(y, y0);
    const next = x + dxdy * dy;
    const d = dy * dir;
    const left = Math.min(x, next);
    const right = Math.max(x, next);
    const leftFloor = Math.floor(left);
    const rightCeil = Math.ceil(right);
    if (rightCeil <= leftFloor + 1) {
      const middle = 0.5 * (x + next) - leftFloor;
      acc[line + leftFloor] += d - d * middle;
      acc[line + leftFloor + 1] += d * middle;
    } else {
      const s = 1 / (right - left);
      const leftPart = left - leftFloor;
      const a0 = 0.5 * s * (1 - leftPart) * (1 - leftPart);
      const rightPart = right - rightCeil + 1;
      const am = 0.5 * s * rightPart * rightPart;
      acc[line + leftFloor] += d * a0;
      if (rightCeil === leftFloor + 2) {
        acc[line + leftFloor + 1] += d * (1 - a0 - am);
      } else {
        const a1 = s * (1.5 - leftPart);
        acc[line + leftFloor + 1] += d * (a1 - a0);
        for (let xi = leftFloor + 2; xi < rightCeil - 1; xi++) acc[line + xi] += d * s;
        const a2 = a1 + (rightCeil - leftFloor - 3) * s;
        acc[line + rightCeil - 1] += d * (1 - a2 - am);
      }
      acc[line + rightCeil] += d * am;
    }
    x = next;
  }
}

function drawClipped(acc: Float32Array, width: number, height: number, x0: number, y0: number, x1: number, y1: number): void {
  const cuts = [0, 1];
  for (const edge of [0, width]) {
    const t = x1 !== x0 ? (edge - x0) / (x1 - x0) : -1;
    if (t > 0 && t < 1) cuts.push(t);
  }
  cuts.sort((a, b) => a - b);
  const clamp = (value: number) => Math.min(width, Math.max(0, value));
  for (let i = 0; i + 1 < cuts.length; i++) {
    const [a, b] = [cuts[i], cuts[i + 1]];
    drawSegment(acc, width + 2, height, clamp(x0 + (x1 - x0) * a), y0 + (y1 - y0) * a, clamp(x0 + (x1 - x0) * b), y0 + (y1 - y0) * b);
  }
}

export function polygonCoverage(points: readonly number[], rect: PixelRect): Float32Array {
  const { width, height } = rect;
  const acc = new Float32Array((width + 2) * height);
  const count = Math.floor(points.length / 2);
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    drawClipped(acc, width, height, points[i * 2] - rect.x, points[i * 2 + 1] - rect.y, points[j * 2] - rect.x, points[j * 2 + 1] - rect.y);
  }
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      sum += acc[y * (width + 2) + x];
      out[y * width + x] = Math.min(1, Math.abs(sum));
    }
  }
  return out;
}

function areaRect(op: AreaOp, size: SurfaceSize, pad: number): PixelRect | null {
  const padded = { x: -pad, y: -pad, width: size.width + 2 * pad, height: size.height + 2 * pad };
  const reach = op.invert ? padded : opReach(op, size);
  if (!reach) return null;
  const left = Math.max(padded.x, reach.x - 1);
  const top = Math.max(padded.y, reach.y - 1);
  const right = Math.min(padded.x + padded.width, reach.x + reach.width + 1);
  const bottom = Math.min(padded.y + padded.height, reach.y + reach.height + 1);
  return right > left && bottom > top ? pixelAligned({ x: left, y: top, width: right - left, height: bottom - top }) : null;
}

export function areaCoverage(op: AreaOp, size: SurfaceSize): Coverage | null {
  const pad = Math.ceil(op.feather * FEATHER_REACH);
  const rect = areaRect(op, size, pad);
  if (!rect) return null;
  let data: Float32Array = new Float32Array(rect.width * rect.height);
  for (const part of op.parts) {
    const coverage = polygonCoverage(part.points, rect);
    const subtract = part.mode === SUBTRACT;
    for (let i = 0; i < data.length; i++) data[i] = subtract ? Math.max(0, data[i] - coverage[i]) : Math.min(1, data[i] + coverage[i]);
  }
  if (op.invert) for (let i = 0; i < data.length; i++) data[i] = 1 - data[i];
  if (op.feather > 0) data = gaussianBlur(data, rect.width, rect.height, op.feather / 2, op.invert ? 1 : 0);
  return { ...rect, data };
}

function opCoverage(op: PixelOp, size: SurfaceSize): Coverage | null {
  return op.kind === "stroke" ? strokeCoverage(op, size) : areaCoverage(op, size);
}

function inkOf(op: PixelOp): readonly [number, number, number] {
  const hex = op.color ?? "";
  if (hex.length !== 7) return BLACK;
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

export function composeCoverage(target: PixelBuffer, coverage: Coverage, op: PixelOp, source: PixelBuffer = target, within: PixelRect = surfaceRect(target)): void {
  const left = Math.max(0, within.x);
  const top = Math.max(0, within.y);
  const right = Math.min(target.width, within.x + within.width);
  const bottom = Math.min(target.height, within.y + within.height);
  const adds = addsInk(op);
  const [r, g, b] = inkOf(op);
  const from = source.data;
  const to = target.data;
  for (let y = top; y < bottom; y++) {
    const inside = y >= coverage.y && y < coverage.y + coverage.height;
    for (let x = left; x < right; x++) {
      const i = (y * target.width + x) * 4;
      const covered = inside && x >= coverage.x && x < coverage.x + coverage.width ? coverage.data[(y - coverage.y) * coverage.width + (x - coverage.x)] : 0;
      const a = covered * op.opacity;
      if (a <= 0) {
        if (to !== from) for (let k = 0; k < 4; k++) to[i + k] = from[i + k];
        continue;
      }
      const below = from[i + 3] / 255;
      if (!adds) {
        for (let k = 0; k < 3; k++) to[i + k] = from[i + k];
        to[i + 3] = Math.round(from[i + 3] * (1 - a));
        continue;
      }
      const kept = below * (1 - a);
      const out = a + kept;
      to[i] = Math.round((r * a + from[i] * kept) / out);
      to[i + 1] = Math.round((g * a + from[i + 1] * kept) / out);
      to[i + 2] = Math.round((b * a + from[i + 2] * kept) / out);
      to[i + 3] = Math.round(out * 255);
    }
  }
}

export function applyPixelOp(buffer: PixelBuffer, op: PixelOp): PixelRect | null {
  const coverage = opCoverage(op, buffer);
  if (!coverage) return null;
  const dirty = clipRect(coverage, buffer.width, buffer.height);
  if (dirty) composeCoverage(buffer, coverage, op, buffer, dirty);
  return dirty;
}

export function renderPixels(surface: PixelSurface): PixelBuffer {
  const buffer = createPixels(surface.width, surface.height);
  for (const op of surface.ops) applyPixelOp(buffer, op);
  return buffer;
}
