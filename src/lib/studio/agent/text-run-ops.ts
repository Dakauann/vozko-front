import type { Layer } from "../document";
import { FONT_IDS, isFontId } from "../fonts";
import { LAYER_RANGES } from "../layer-ranges";
import { baseRunStyle, findTextRanges, RUN_STYLE_KEYS, styleRuns, textStylePatch, type RunStyleKey, type RunStylePatch, type TextRange, type TextRun } from "../text-runs";
import { isValidColor } from "../validate";
import { firstProblem, outOfRange, type AgentStyle, type Patched } from "./layer-style";

export const RUN_CLEAR_FIELDS = ["fill", "font_id", "font_weight", "font_size", "italic", "underline", "caps", "letter_spacing"] as const;

export type RunClearField = (typeof RUN_CLEAR_FIELDS)[number];

const CLEAR_KEYS: Record<RunClearField, RunStyleKey> = {
  fill: "fill",
  font_id: "fontId",
  font_weight: "fontWeight",
  font_size: "fontSize",
  italic: "italic",
  underline: "underline",
  caps: "caps",
  letter_spacing: "letterSpacing",
};

const OUTLINE_NAMES: Record<RunStyleKey, string> = {
  fill: "fill",
  fontId: "font_id",
  fontWeight: "font_weight",
  fontSize: "font_size",
  italic: "italic",
  underline: "underline",
  caps: "caps",
  letterSpacing: "letter_spacing",
};

export interface AgentTextRunFields {
  char_start?: number;
  char_end?: number;
  match?: string;
  match_all?: boolean;
  underline?: boolean;
  caps?: boolean;
  run_clear?: string[];
}

export type TextRunInput = AgentTextRunFields & Pick<AgentStyle, "fill" | "font_id" | "font_weight" | "font_size" | "italic" | "letter_spacing">;

export interface StyledText {
  patch: Partial<Layer>;
  ranges: TextRange[] | null;
}

function weightProblem(weight: number | undefined): string | null {
  if (weight === undefined) return null;
  return Number.isInteger(weight) && weight >= 100 && weight <= 900 && weight % 100 === 0 ? null : "font_weight vai de 100 a 900, de 100 em 100";
}

function stylePatchOf(op: TextRunInput): Patched<RunStylePatch> {
  const patch: RunStylePatch = {};
  for (const name of op.run_clear ?? []) {
    if (!(RUN_CLEAR_FIELDS as readonly string[]).includes(name)) return { ok: false, reason: `run_clear aceita: ${RUN_CLEAR_FIELDS.join(", ")}` };
    patch[CLEAR_KEYS[name as RunClearField]] = null;
  }
  if (op.fill !== undefined && !isValidColor(op.fill, true)) return { ok: false, reason: "fill precisa ser uma cor #rrggbb ou #rrggbbaa" };
  if (op.font_id !== undefined && !isFontId(op.font_id)) return { ok: false, reason: `a fonte ${op.font_id} não existe; use uma de: ${FONT_IDS.join(", ")}` };
  const problem = firstProblem(weightProblem(op.font_weight), outOfRange("font_size", op.font_size, LAYER_RANGES.fontSize), outOfRange("letter_spacing", op.letter_spacing, LAYER_RANGES.letterSpacing));
  if (problem) return { ok: false, reason: problem };
  const values: Partial<Record<RunStyleKey, unknown>> = { fill: op.fill, fontId: op.font_id, fontWeight: op.font_weight, fontSize: op.font_size, italic: op.italic, underline: op.underline, caps: op.caps, letterSpacing: op.letter_spacing };
  for (const key of RUN_STYLE_KEYS) {
    if (values[key] !== undefined) Object.assign(patch, { [key]: values[key] });
  }
  if (Object.keys(patch).length === 0) return { ok: false, reason: "style_text precisa de ao menos um estilo: fill, font_id, font_weight, font_size, italic, underline, caps, letter_spacing ou run_clear" };
  return { ok: true, value: patch };
}

function rangesOf(op: TextRunInput, text: string, length: number): Patched<TextRange[] | null> {
  const indexed = op.char_start !== undefined || op.char_end !== undefined;
  if (indexed && op.match !== undefined) return { ok: false, reason: "use char_start e char_end ou match, não os dois" };
  if (op.match !== undefined) {
    const found = findTextRanges(text, op.match, op.match_all === true);
    return found.length > 0 ? { ok: true, value: found } : { ok: false, reason: `o texto "${op.match}" não aparece na camada; o texto dela é "${text}"` };
  }
  if (!indexed) return { ok: true, value: null };
  const start = op.char_start ?? 0;
  const end = op.char_end ?? length;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > length || end <= start) return { ok: false, reason: `char_start e char_end contam caracteres de 0 a ${length}, com char_end maior que char_start` };
  return { ok: true, value: [{ start, end }] };
}

export function styledText(layer: Layer, text: string, op: TextRunInput): Patched<StyledText> {
  const length = [...text].length;
  const style = stylePatchOf(op);
  if (!style.ok) return style;
  const ranges = rangesOf(op, text, length);
  if (!ranges.ok) return ranges;
  if (!ranges.value) return { ok: true, value: { patch: textStylePatch(layer, null, style.value, length), ranges: null } };
  const runs = ranges.value.reduce<TextRun[]>((current, range) => styleRuns(current, length, baseRunStyle(layer), range, style.value), layer.runs ?? []);
  return { ok: true, value: { patch: { runs: runs.length > 0 ? runs : undefined }, ranges: ranges.value } };
}

export type OutlineRun = { start: number; end: number; text: string } & Partial<Record<string, string | number | boolean>>;

export function runsOutline(layer: Pick<Layer, "runs" | "fill" | "fontId" | "fontWeight" | "fontSize" | "italic" | "letterSpacing" | "text">, text: string): OutlineRun[] | undefined {
  const runs = layer.runs ?? [];
  if (runs.length === 0) return undefined;
  const chars = [...text];
  return runs.map((run) => {
    const entry: OutlineRun = { start: run.start, end: run.end, text: chars.slice(run.start, run.end).join("") };
    for (const key of RUN_STYLE_KEYS) {
      const value = run[key];
      if (value !== undefined) entry[OUTLINE_NAMES[key]] = value;
    }
    return entry;
  });
}

