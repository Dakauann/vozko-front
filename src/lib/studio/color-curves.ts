import type { IssueCode } from "./validate";

export const CURVE_CHANNELS = ["master", "red", "green", "blue"] as const;

export type CurveChannel = (typeof CURVE_CHANNELS)[number];

export interface CurvePoint {
  x: number;
  y: number;
}

export type ColorCurves = Partial<Record<CurveChannel, CurvePoint[]>>;

export const CURVE_TABLE_SIZE = 256;
export const CURVE_POINT_GAP = 1 / 255;
export const IDENTITY_CURVE: readonly CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];

export const CURVE_PRESET_IDS = ["contrast", "soften", "fade", "brighten", "darken"] as const;

export type CurvePresetId = (typeof CURVE_PRESET_IDS)[number];

export const CURVE_PRESETS: Record<CurvePresetId, readonly CurvePoint[]> = {
  contrast: [
    { x: 0, y: 0 },
    { x: 0.25, y: 0.18 },
    { x: 0.75, y: 0.82 },
    { x: 1, y: 1 },
  ],
  soften: [
    { x: 0, y: 0 },
    { x: 0.25, y: 0.32 },
    { x: 0.75, y: 0.68 },
    { x: 1, y: 1 },
  ],
  fade: [
    { x: 0, y: 0.12 },
    { x: 0.5, y: 0.52 },
    { x: 1, y: 0.94 },
  ],
  brighten: [
    { x: 0, y: 0 },
    { x: 0.45, y: 0.58 },
    { x: 1, y: 1 },
  ],
  darken: [
    { x: 0, y: 0 },
    { x: 0.55, y: 0.42 },
    { x: 1, y: 1 },
  ],
};

const IDENTITY_EPSILON = 1e-9;
const SLOPE_LIMIT = 9;

function within(value: number, low: number, high: number): boolean {
  return Number.isFinite(value) && value >= low && value <= high;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function isCurveChannel(value: string): value is CurveChannel {
  return (CURVE_CHANNELS as readonly string[]).includes(value);
}

export function curvePointsIssue(points: readonly CurvePoint[]): IssueCode | null {
  if (points.length < 2) return "invalid";
  for (const [i, point] of points.entries()) {
    if (!within(point.x, 0, 1) || !within(point.y, 0, 1)) return "out_of_range";
    if (i > 0 && point.x <= points[i - 1].x) return "invalid";
  }
  return null;
}

export function curvesIssue(curves: ColorCurves): IssueCode | null {
  for (const channel of Object.keys(curves)) {
    if (!isCurveChannel(channel)) return "unknown";
    const points = curves[channel];
    const code = points === undefined ? null : curvePointsIssue(points);
    if (code) return code;
  }
  return null;
}

export function isIdentityCurve(points: readonly CurvePoint[] | undefined): boolean {
  return !points || points.every((point) => Math.abs(point.y - point.x) < IDENTITY_EPSILON);
}

export function isNeutralCurves(curves: ColorCurves | undefined): boolean {
  return !curves || CURVE_CHANNELS.every((channel) => isIdentityCurve(curves[channel]));
}

export function storedCurves(curves: ColorCurves | undefined): ColorCurves | undefined {
  if (!curves) return undefined;
  const kept: ColorCurves = {};
  for (const channel of CURVE_CHANNELS) {
    const points = curves[channel];
    if (points && !isIdentityCurve(points)) kept[channel] = points.map((point) => ({ x: point.x, y: point.y }));
  }
  return Object.keys(kept).length > 0 ? kept : undefined;
}

export function curveOf(curves: ColorCurves | undefined, channel: CurveChannel): readonly CurvePoint[] {
  return curves?.[channel] ?? IDENTITY_CURVE;
}

export function withCurve(curves: ColorCurves | undefined, channel: CurveChannel, points: readonly CurvePoint[]): ColorCurves | undefined {
  return storedCurves({ ...curves, [channel]: [...points] });
}

function tangents(points: readonly CurvePoint[]): number[] {
  const n = points.length;
  const secants = Array.from({ length: n - 1 }, (_, k) => (points[k + 1].y - points[k].y) / (points[k + 1].x - points[k].x));
  const slopes = points.map((_, k) => {
    if (k === 0) return secants[0];
    if (k === n - 1) return secants[n - 2];
    return secants[k - 1] * secants[k] > 0 ? (secants[k - 1] + secants[k]) / 2 : 0;
  });
  for (let k = 0; k < n - 1; k++) {
    const secant = secants[k];
    if (secant === 0) {
      slopes[k] = 0;
      slopes[k + 1] = 0;
      continue;
    }
    const a = slopes[k] / secant;
    const b = slopes[k + 1] / secant;
    const length = a * a + b * b;
    if (length > SLOPE_LIMIT) {
      const t = 3 / Math.sqrt(length);
      slopes[k] = t * a * secant;
      slopes[k + 1] = t * b * secant;
    }
  }
  return slopes;
}

function hermite(points: readonly CurvePoint[], slopes: readonly number[], x: number): number {
  const last = points.length - 1;
  if (x <= points[0].x) return points[0].y;
  if (x >= points[last].x) return points[last].y;
  let k = 0;
  while (k < last - 1 && x >= points[k + 1].x) k++;
  const from = points[k];
  const to = points[k + 1];
  const h = to.x - from.x;
  const t = (x - from.x) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * from.y + (t3 - 2 * t2 + t) * h * slopes[k] + (-2 * t3 + 3 * t2) * to.y + (t3 - t2) * h * slopes[k + 1];
}

export function curveAt(points: readonly CurvePoint[], x: number): number {
  return clamp01(hermite(points, tangents(points), x));
}

export function curveTable(points: readonly CurvePoint[]): Float64Array {
  const slopes = tangents(points);
  return Float64Array.from({ length: CURVE_TABLE_SIZE }, (_, i) => clamp01(hermite(points, slopes, i / (CURVE_TABLE_SIZE - 1))));
}

export function curvesLut(curves: ColorCurves): Uint8Array {
  const master = curveTable(curveOf(curves, "master"));
  const channels = (["red", "green", "blue"] as const).map((channel) => {
    const points = curveOf(curves, channel);
    const slopes = tangents(points);
    return (v: number) => clamp01(hermite(points, slopes, v));
  });
  const lut = new Uint8Array(CURVE_TABLE_SIZE * 4);
  for (let i = 0; i < CURVE_TABLE_SIZE; i++) {
    channels.forEach((channel, c) => {
      lut[i * 4 + c] = Math.round(channel(master[i]) * 255);
    });
    lut[i * 4 + 3] = 255;
  }
  return lut;
}

export function applyCurvesPixels(data: Uint8ClampedArray, lut: Uint8Array): void {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    data[i] = lut[data[i] * 4];
    data[i + 1] = lut[data[i + 1] * 4 + 1];
    data[i + 2] = lut[data[i + 2] * 4 + 2];
  }
}

export function curvesPixel(rgb: readonly number[], lut: Uint8Array): number[] {
  return rgb.slice(0, 3).map((v, c) => lut[Math.round(clamp01(v) * 255) * 4 + c] / 255);
}

export type CurveEdit = { ok: true; points: CurvePoint[]; index: number } | { ok: false; reason: "crowded" | "lastPoints" | "missing" };

function placed(points: readonly CurvePoint[], index: number, x: number, y: number): CurvePoint {
  const low = index === 0 ? 0 : points[index - 1].x + CURVE_POINT_GAP;
  const high = index === points.length - 1 ? 1 : points[index + 1].x - CURVE_POINT_GAP;
  return { x: Math.min(high, Math.max(low, clamp01(x))), y: clamp01(y) };
}

export function addCurvePoint(points: readonly CurvePoint[], x: number, y: number): CurveEdit {
  const at = clamp01(x);
  if (points.some((point) => Math.abs(point.x - at) < CURVE_POINT_GAP)) return { ok: false, reason: "crowded" };
  const next = [...points, { x: at, y: clamp01(y) }].sort((a, b) => a.x - b.x);
  return { ok: true, points: next, index: next.findIndex((point) => point.x === at) };
}

export function moveCurvePoint(points: readonly CurvePoint[], index: number, x: number, y: number): CurveEdit {
  if (index < 0 || index >= points.length) return { ok: false, reason: "missing" };
  const next = points.map((point, i) => (i === index ? placed(points, index, x, y) : point));
  return { ok: true, points: next, index };
}

export function removeCurvePoint(points: readonly CurvePoint[], index: number): CurveEdit {
  if (index < 0 || index >= points.length) return { ok: false, reason: "missing" };
  if (points.length <= 2) return { ok: false, reason: "lastPoints" };
  return { ok: true, points: points.filter((_, i) => i !== index), index: Math.max(0, index - 1) };
}

export function curvePresetPoints(id: CurvePresetId): CurvePoint[] {
  return CURVE_PRESETS[id].map((point) => ({ ...point }));
}

export function isCurvePreset(value: string): value is CurvePresetId {
  return (CURVE_PRESET_IDS as readonly string[]).includes(value);
}
