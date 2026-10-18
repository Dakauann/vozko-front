import type { IssueCode } from "./validate";
import { curvesIssue, isNeutralCurves, storedCurves, type ColorCurves } from "./color-curves";
import { hueIssue, isNeutralHue, storedHue, type HueSecondary } from "./hue-secondary";
import { isNeutralLut, lutRefIssue, type GradeLut } from "./cube-lut";

export const GRADE_FIELDS = ["exposure", "contrast", "highlights", "shadows", "whites", "blacks", "temperature", "tint", "saturation", "vibrance"] as const;

export type GradeField = (typeof GRADE_FIELDS)[number];

export type PrimaryGrade = Partial<Record<GradeField, number>>;

export interface GradeExtras {
  curves?: ColorCurves;
  hsl?: HueSecondary;
  lut?: GradeLut;
}

const GRADE_EXTRAS = ["curves", "hsl", "lut"] as const satisfies readonly (keyof GradeExtras)[];

export type GradeExtra = (typeof GRADE_EXTRAS)[number];

export interface ColorGrade extends PrimaryGrade, GradeExtras {}

export const GRADE_GROUPS = {
  light: ["exposure", "contrast", "highlights", "shadows", "whites", "blacks"],
  color: ["temperature", "tint", "saturation", "vibrance"],
} as const satisfies Record<string, readonly GradeField[]>;

export const GRADE_RANGES: Record<GradeField, readonly [number, number]> = {
  exposure: [-5, 5],
  contrast: [-100, 100],
  highlights: [-100, 100],
  shadows: [-100, 100],
  whites: [-100, 100],
  blacks: [-100, 100],
  temperature: [-100, 100],
  tint: [-100, 100],
  saturation: [-100, 100],
  vibrance: [-100, 100],
};

export const LOOK_IDS = ["warm", "cool", "faded", "mono", "punchy", "dramatic", "soft", "vintage"] as const;

export type LookId = (typeof LOOK_IDS)[number];

export const COLOR_LOOKS: Record<LookId, ColorGrade> = {
  warm: { temperature: 35, tint: 5, vibrance: 10 },
  cool: { temperature: -35, tint: -5, contrast: 5 },
  faded: { contrast: -30, blacks: 40, saturation: -20 },
  mono: { saturation: -100, contrast: 15 },
  punchy: { contrast: 25, vibrance: 35, saturation: 10 },
  dramatic: { contrast: 45, highlights: -30, shadows: -20, saturation: -15 },
  soft: { contrast: -20, highlights: -25, shadows: 25, vibrance: 5 },
  vintage: { temperature: 25, tint: 10, contrast: -15, blacks: 30, saturation: -30 },
};

const LUMA = [0.2126, 0.7152, 0.0722] as const;
const WHITE_BALANCE_SHIFT = 0.25;
const MIDTONE_GAIN = 0.25;
const ENDPOINT_GAIN = 0.1;
const BAND_PEAK = 6.75;
const DARK_FLOOR = 1e-4;

function value(grade: ColorGrade, field: GradeField): number {
  return grade[field] ?? 0;
}

export function isNeutralPrimary(grade: PrimaryGrade | undefined): boolean {
  return !grade || GRADE_FIELDS.every((field) => value(grade, field) === 0);
}

export function isNeutralGrade(grade: ColorGrade | undefined): boolean {
  return !grade || (isNeutralPrimary(grade) && isNeutralCurves(grade.curves) && isNeutralHue(grade.hsl) && isNeutralLut(grade.lut));
}

export function extrasOf(grade: ColorGrade | undefined): GradeExtras {
  const extras: GradeExtras = {};
  if (grade?.curves) extras.curves = grade.curves;
  if (grade?.hsl) extras.hsl = grade.hsl;
  if (grade?.lut) extras.lut = grade.lut;
  return extras;
}

function primaryOf(grade: ColorGrade | undefined): PrimaryGrade {
  const primary: PrimaryGrade = {};
  for (const field of GRADE_FIELDS) {
    const v = grade?.[field];
    if (v !== undefined && v !== 0) primary[field] = v;
  }
  return primary;
}

export function gradeFault(grade: ColorGrade): GradeField | null {
  for (const field of GRADE_FIELDS) {
    const v = grade[field];
    if (v === undefined) continue;
    const [low, high] = GRADE_RANGES[field];
    if (!Number.isFinite(v) || v < low || v > high) return field;
  }
  return null;
}

export function gradeIssue(grade: ColorGrade): IssueCode | null {
  if (gradeFault(grade)) return "out_of_range";
  return (grade.curves ? curvesIssue(grade.curves) : null) ?? (grade.hsl ? hueIssue(grade.hsl) : null) ?? (grade.lut ? lutRefIssue(grade.lut) : null);
}

export type ExtrasChange = { [K in GradeExtra]?: GradeExtras[K] | null };

export interface GradeRequest {
  values?: PrimaryGrade;
  look?: LookId;
  intensity?: number;
  reset?: boolean;
  extras?: ExtrasChange;
}

export function withExtras(current: ColorGrade | undefined, change: ExtrasChange): ColorGrade {
  const next: ColorGrade = { ...current };
  for (const extra of GRADE_EXTRAS) {
    if (!(extra in change)) continue;
    const incoming = change[extra];
    if (incoming === null || incoming === undefined) delete next[extra];
    else (next as Record<GradeExtra, unknown>)[extra] = incoming;
  }
  return next;
}

export function changedGrade(current: ColorGrade | undefined, request: GradeRequest): ColorGrade | undefined {
  let next: ColorGrade = request.reset ? {} : { ...current };
  if (request.look) next = { ...extrasOf(next), ...lookGrade(request.look, request.intensity ?? 1) };
  if (request.values) next = mergeGrade(next, request.values);
  if (request.extras) next = withExtras(next, request.extras);
  return storedGrade(next);
}

export function mergeGrade(current: ColorGrade | undefined, change: PrimaryGrade): ColorGrade {
  const next: ColorGrade = { ...current };
  for (const field of GRADE_FIELDS) {
    const v = change[field];
    if (v === undefined) continue;
    if (v === 0) delete next[field];
    else next[field] = v;
  }
  return next;
}

export function lookGrade(look: LookId, intensity: number): ColorGrade {
  const k = Math.min(1, Math.max(0, intensity));
  const grade: ColorGrade = {};
  for (const field of GRADE_FIELDS) {
    const v = COLOR_LOOKS[look][field];
    if (v !== undefined && v * k !== 0) grade[field] = Math.round(v * k * 10) / 10;
  }
  return grade;
}

function toLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function toDisplay(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function luma(rgb: readonly number[]): number {
  return LUMA[0] * rgb[0] + LUMA[1] * rgb[1] + LUMA[2] * rgb[2];
}

function whiteBalanceGains(temperature: number, tint: number): [number, number, number] {
  const t = temperature / 100;
  const m = tint / 100;
  const raw: [number, number, number] = [1 + WHITE_BALANCE_SHIFT * t, 1 - WHITE_BALANCE_SHIFT * m, 1 - WHITE_BALANCE_SHIFT * t];
  const norm = luma(raw);
  return [raw[0] / norm, raw[1] / norm, raw[2] / norm];
}

export interface GradeUniforms {
  gain: number;
  balance: [number, number, number];
  contrast: number;
  tone: [number, number, number, number];
  saturation: number;
  vibrance: number;
}

export function gradeUniforms(grade: PrimaryGrade): GradeUniforms {
  const band = MIDTONE_GAIN * BAND_PEAK;
  return {
    gain: 2 ** value(grade, "exposure"),
    balance: whiteBalanceGains(value(grade, "temperature"), value(grade, "tint")),
    contrast: 2 ** (value(grade, "contrast") / 100),
    tone: [(value(grade, "shadows") / 100) * band, (value(grade, "highlights") / 100) * band, (value(grade, "blacks") / 100) * ENDPOINT_GAIN, (value(grade, "whites") / 100) * ENDPOINT_GAIN],
    saturation: 1 + value(grade, "saturation") / 100,
    vibrance: value(grade, "vibrance") / 100,
  };
}

function toneAt(l: number, tone: GradeUniforms["tone"]): number {
  const dark = 1 - l;
  return clamp01(l + tone[0] * l * dark * dark + tone[1] * l * l * dark + tone[2] * dark ** 3 + tone[3] * l ** 3);
}

function applyGrade(rgb: readonly number[], u: GradeUniforms): number[] {
  let out = rgb.map((v, i) => toDisplay(clamp01(toLinear(v) * u.gain * u.balance[i])));
  out = out.map((v) => clamp01((v - 0.5) * u.contrast + 0.5));
  const before = luma(out);
  const after = toneAt(before, u.tone);
  out = before > DARK_FLOOR ? out.map((v) => clamp01((v * after) / before)) : out.map((v) => clamp01(v + after - before));
  const middle = luma(out);
  const spread = Math.max(...out) - Math.min(...out);
  const saturation = u.saturation * (1 + u.vibrance * (1 - spread));
  return out.map((v) => clamp01(middle + (v - middle) * saturation));
}

export function gradePixel(rgb: readonly number[], grade: PrimaryGrade): number[] {
  return isNeutralPrimary(grade) ? [...rgb] : applyGrade(rgb, gradeUniforms(grade));
}

const DISPLAY_STEPS = 4096;
const LINEAR_TABLE = Float32Array.from({ length: 256 }, (_, i) => toLinear(i / 255));
const DISPLAY_TABLE = Float32Array.from({ length: DISPLAY_STEPS + 1 }, (_, i) => toDisplay(i / DISPLAY_STEPS));

function displayOf(linear: number): number {
  return DISPLAY_TABLE[Math.round(clamp01(linear) * DISPLAY_STEPS)];
}

export function gradeImageData(data: Uint8ClampedArray, u: GradeUniforms): void {
  const [br, bg, bb] = u.balance;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    let r = displayOf(LINEAR_TABLE[data[i]] * u.gain * br);
    let g = displayOf(LINEAR_TABLE[data[i + 1]] * u.gain * bg);
    let b = displayOf(LINEAR_TABLE[data[i + 2]] * u.gain * bb);
    r = clamp01((r - 0.5) * u.contrast + 0.5);
    g = clamp01((g - 0.5) * u.contrast + 0.5);
    b = clamp01((b - 0.5) * u.contrast + 0.5);
    const before = LUMA[0] * r + LUMA[1] * g + LUMA[2] * b;
    const after = toneAt(before, u.tone);
    if (before > DARK_FLOOR) {
      const k = after / before;
      r = clamp01(r * k);
      g = clamp01(g * k);
      b = clamp01(b * k);
    } else {
      r = clamp01(r + after - before);
      g = clamp01(g + after - before);
      b = clamp01(b + after - before);
    }
    const middle = LUMA[0] * r + LUMA[1] * g + LUMA[2] * b;
    const saturation = u.saturation * (1 + u.vibrance * (1 - (Math.max(r, g, b) - Math.min(r, g, b))));
    data[i] = Math.round(clamp01(middle + (r - middle) * saturation) * 255);
    data[i + 1] = Math.round(clamp01(middle + (g - middle) * saturation) * 255);
    data[i + 2] = Math.round(clamp01(middle + (b - middle) * saturation) * 255);
  }
}

export const GRADE_STEPS: Record<GradeField, number> = {
  exposure: 0.05,
  contrast: 1,
  highlights: 1,
  shadows: 1,
  whites: 1,
  blacks: 1,
  temperature: 1,
  tint: 1,
  saturation: 1,
  vibrance: 1,
};

interface GradeSummary {
  warmth: "warm" | "cool" | null;
  exposure: number | null;
  others: number;
}

export function gradeSummary(grade: ColorGrade | undefined): GradeSummary | null {
  if (!grade || isNeutralGrade(grade)) return null;
  const temperature = value(grade, "temperature");
  const exposure = value(grade, "exposure");
  return {
    warmth: temperature > 0 ? "warm" : temperature < 0 ? "cool" : null,
    exposure: exposure === 0 ? null : exposure,
    others: GRADE_FIELDS.filter((field) => field !== "temperature" && field !== "exposure" && value(grade, field) !== 0).length + GRADE_EXTRAS.filter((extra) => grade[extra] !== undefined).length,
  };
}

export function storedGrade(grade: ColorGrade): ColorGrade | undefined {
  const stored: ColorGrade = primaryOf(grade);
  const curves = storedCurves(grade.curves);
  const hsl = storedHue(grade.hsl);
  if (curves) stored.curves = curves;
  if (hsl) stored.hsl = hsl;
  if (grade.lut && !isNeutralLut(grade.lut)) stored.lut = grade.lut;
  return isNeutralGrade(stored) ? undefined : stored;
}
