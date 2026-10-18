import { changedGrade, GRADE_FIELDS, GRADE_RANGES, gradeFault, LOOK_IDS, type ColorGrade, type ExtrasChange, type GradeRequest, type LookId, type PrimaryGrade } from "../color-grade";
import { CURVE_CHANNELS, CURVE_PRESET_IDS, curvePresetPoints, curvesIssue, isCurvePreset, storedCurves, type ColorCurves, type CurvePoint } from "../color-curves";
import { HUE_CENTERS, HUE_FIELDS, HUE_NAMES, HUE_RANGES, hueFault, isHueName, storedHue, type HueName, type HueSecondary } from "../hue-secondary";
import type { GradientMap } from "../gradient-map";
import { gradientMapOf, type AgentGradientMap } from "./paint-ops";

export const COLOR_CLEARS = ["curves", "hsl", "lut", "gradient_map"] as const;

export type ColorClear = (typeof COLOR_CLEARS)[number];

export interface AgentHsl extends Partial<HueSecondary> {
  color?: HueName;
}

export interface AgentColorFields {
  color_grade?: PrimaryGrade;
  look?: LookId;
  look_intensity?: number;
  reset_color?: boolean;
  curves?: Partial<Record<(typeof CURVE_CHANNELS)[number], CurvePoint[]>>;
  curves_preset?: string;
  hsl?: AgentHsl;
  lut_media_id?: string;
  lut_intensity?: number;
  gradient_map?: AgentGradientMap;
  clear_color?: ColorClear[];
}

interface ColorTarget {
  color: ColorGrade | undefined;
  gradientMap: GradientMap | undefined;
}

type GradeChange = { ok: true; apply: (current: ColorTarget) => ColorTarget | string } | { ok: false; reason: string };

function rangeText(field: (typeof GRADE_FIELDS)[number]): string {
  const [low, high] = GRADE_RANGES[field];
  return `color_grade.${field} vai de ${low} a ${high}`;
}

function touched(op: AgentColorFields): boolean {
  return Boolean(op.color_grade || op.look || op.reset_color || op.curves || op.curves_preset || op.hsl || op.lut_media_id || op.lut_intensity !== undefined || op.gradient_map || op.clear_color?.length);
}

function curvesOf(op: AgentColorFields, current: ColorCurves | undefined): ColorCurves | null | string {
  if (op.curves_preset !== undefined && !isCurvePreset(op.curves_preset)) return `curves_preset precisa ser um de: ${CURVE_PRESET_IDS.join(", ")}`;
  const unknown = Object.keys(op.curves ?? {}).find((key) => !(CURVE_CHANNELS as readonly string[]).includes(key));
  if (unknown) return `curves.${unknown} não existe; use ${CURVE_CHANNELS.join(", ")}`;
  const next: ColorCurves = { ...current, ...(op.curves_preset ? { master: curvePresetPoints(op.curves_preset as Parameters<typeof curvePresetPoints>[0]) } : {}), ...op.curves };
  if (curvesIssue(next)) return "cada curva de curves precisa de pelo menos 2 pontos {x, y} de 0 a 1, com x crescente (o primeiro e o último ponto ficam nas pontas que você quer prender)";
  return storedCurves(next) ?? null;
}

function hslOf(input: AgentHsl, current: HueSecondary | undefined): HueSecondary | null | string {
  if (input.color !== undefined && !isHueName(input.color)) return `hsl.color precisa ser um de: ${HUE_NAMES.join(", ")}`;
  const unknown = Object.keys(input).find((key) => key !== "color" && !(HUE_FIELDS as readonly string[]).includes(key));
  if (unknown) return `hsl.${unknown} não existe; use color, ${HUE_FIELDS.join(", ")}`;
  const { color, ...values } = input;
  const next: HueSecondary = { hue: 0, width: 40, softness: 30, ...current, ...(color ? { hue: HUE_CENTERS[color] } : {}), ...values };
  const fault = hueFault(next);
  if (fault) return `hsl.${fault} vai de ${HUE_RANGES[fault][0]} a ${HUE_RANGES[fault][1]}`;
  return storedHue(next) ?? null;
}

function extrasOf(op: AgentColorFields, current: ColorGrade | undefined, cleared: ReadonlySet<ColorClear>): ExtrasChange | string {
  const change: ExtrasChange = {};
  if (cleared.has("curves")) change.curves = null;
  if (cleared.has("hsl")) change.hsl = null;
  if (cleared.has("lut")) change.lut = null;
  if (op.curves || op.curves_preset) {
    const curves = curvesOf(op, cleared.has("curves") ? undefined : current?.curves);
    if (typeof curves === "string") return curves;
    change.curves = curves;
  }
  if (op.hsl) {
    const hsl = hslOf(op.hsl, cleared.has("hsl") ? undefined : current?.hsl);
    if (typeof hsl === "string") return hsl;
    change.hsl = hsl;
  }
  if (op.lut_media_id !== undefined || op.lut_intensity !== undefined) {
    const assetId = op.lut_media_id ?? (cleared.has("lut") ? undefined : current?.lut?.assetId);
    if (!assetId) return "lut_intensity muda um LUT que já está no clipe; para pôr um LUT passe lut_media_id";
    const intensity = op.lut_intensity ?? current?.lut?.intensity;
    change.lut = { assetId, ...(intensity !== undefined && intensity !== 1 ? { intensity } : {}) };
  }
  return change;
}

export interface AgentGradeOutline extends PrimaryGrade {
  curves?: ColorCurves;
  hsl?: HueSecondary;
  lut?: { media_id: string; intensity?: number };
}

export function agentGrade(grade: ColorGrade): AgentGradeOutline {
  const { curves, hsl, lut, ...primary } = grade;
  return { ...primary, ...(curves ? { curves } : {}), ...(hsl ? { hsl } : {}), ...(lut ? { lut: { media_id: lut.assetId, ...(lut.intensity !== undefined ? { intensity: lut.intensity } : {}) } } : {}) };
}

export function gradeChangeOf(op: AgentColorFields, isLut: ((mediaId: string) => boolean) | undefined): GradeChange {
  if (!touched(op)) return { ok: false, reason: "set_color precisa de color_grade, look, curves, curves_preset, hsl, lut_media_id, gradient_map, clear_color ou reset_color" };
  if (op.look !== undefined && !(LOOK_IDS as readonly string[]).includes(op.look)) return { ok: false, reason: `look precisa ser um de: ${LOOK_IDS.join(", ")}` };
  if (op.look_intensity !== undefined && !(op.look_intensity >= 0 && op.look_intensity <= 1)) return { ok: false, reason: "look_intensity vai de 0 a 1" };
  if (op.lut_intensity !== undefined && !(op.lut_intensity >= 0 && op.lut_intensity <= 1)) return { ok: false, reason: "lut_intensity vai de 0 a 1" };
  if (op.lut_media_id !== undefined && !isLut?.(op.lut_media_id)) return { ok: false, reason: `lut_media_id precisa ser um LUT .cube da biblioteca que abre sem erro; ${op.lut_media_id} não é` };
  const badClear = (op.clear_color ?? []).find((item) => !(COLOR_CLEARS as readonly string[]).includes(item));
  if (badClear) return { ok: false, reason: `clear_color aceita: ${COLOR_CLEARS.join(", ")}` };
  const unknown = Object.keys(op.color_grade ?? {}).find((key) => !(GRADE_FIELDS as readonly string[]).includes(key));
  if (unknown) return { ok: false, reason: `color_grade.${unknown} não existe; use ${GRADE_FIELDS.join(", ")}` };
  const fault = gradeFault(op.color_grade ?? {});
  if (fault) return { ok: false, reason: rangeText(fault) };
  const cleared = new Set<ColorClear>(op.reset_color ? COLOR_CLEARS : (op.clear_color ?? []));
  return {
    ok: true,
    apply: (current) => {
      const extras = extrasOf(op, current.color, cleared);
      if (typeof extras === "string") return extras;
      const request: GradeRequest = { values: op.color_grade, look: op.look, intensity: op.look_intensity, reset: op.reset_color, extras };
      const kept = cleared.has("gradient_map") ? undefined : current.gradientMap;
      const map = op.gradient_map ? gradientMapOf(op.gradient_map, kept) : null;
      if (map && !map.ok) return map.reason;
      return { color: changedGrade(current.color, request), gradientMap: map ? map.value : kept };
    },
  };
}
