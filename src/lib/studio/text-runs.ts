import { parseColor } from "./color";
import type { Clip, Layer } from "./document";
import type { Counter } from "./counter";
import { DEFAULT_FONT_ID, DEFAULT_FONT_WEIGHT, isFontId, type FontId } from "./fonts";
import { LAYER_RANGES } from "./layer-ranges";
import type { ClipPatch } from "./timeline";
import type { IssueCode } from "./validate";

export const RUN_STYLE_KEYS = ["fill", "fontId", "fontWeight", "fontSize", "italic", "underline", "caps", "letterSpacing"] as const;

export type RunStyleKey = (typeof RUN_STYLE_KEYS)[number];

export const LAYER_RUN_KEYS = ["fill", "fontId", "fontWeight", "fontSize", "italic", "letterSpacing"] as const satisfies readonly RunStyleKey[];

export type LayerRunKey = (typeof LAYER_RUN_KEYS)[number];

export interface TextRunStyle {
  fill?: string;
  fontId?: FontId;
  fontWeight?: number;
  fontSize?: number;
  italic?: boolean;
  underline?: boolean;
  caps?: boolean;
  letterSpacing?: number;
}

export interface TextRun extends TextRunStyle {
  start: number;
  end: number;
}

export type RunStyle = Required<TextRunStyle>;

export type RunStylePatch = { [K in RunStyleKey]?: TextRunStyle[K] | null };

export interface TextRange {
  start: number;
  end: number;
}

export interface TextSpan {
  start: number;
  end: number;
  text: string;
  style: RunStyle;
}

export type RangeValue<K extends RunStyleKey> = { mixed: false; value: RunStyle[K] } | { mixed: true };

export const COUNTER_SLOT = "";

const NUMBER_EPSILON = 1e-9;

type Styled = Pick<Layer, "text" | "runs" | "fill" | "fontId" | "fontWeight" | "fontSize" | "italic" | "letterSpacing">;

function isLayerKey(key: RunStyleKey): key is LayerRunKey {
  return (LAYER_RUN_KEYS as readonly string[]).includes(key);
}

export function hasRuns(layer: Pick<Layer, "runs">): boolean {
  return (layer.runs?.length ?? 0) > 0;
}

export function baseRunStyle(layer: Omit<Styled, "text" | "runs">): RunStyle {
  return {
    fill: layer.fill ?? "",
    fontId: layer.fontId ?? DEFAULT_FONT_ID,
    fontWeight: layer.fontWeight || DEFAULT_FONT_WEIGHT,
    fontSize: layer.fontSize ?? 0,
    italic: Boolean(layer.italic),
    underline: false,
    caps: false,
    letterSpacing: layer.letterSpacing ?? 0,
  };
}

function sameValue(key: RunStyleKey, a: unknown, b: unknown): boolean {
  if (key === "fill" && typeof a === "string" && typeof b === "string") return a.toLowerCase() === b.toLowerCase();
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= NUMBER_EPSILON;
  return a === b;
}

function cleaned(style: TextRunStyle, base: RunStyle): TextRunStyle {
  const out: Record<string, unknown> = {};
  for (const key of RUN_STYLE_KEYS) {
    const value = style[key];
    if (value === undefined || sameValue(key, value, base[key])) continue;
    out[key] = value;
  }
  return out as TextRunStyle;
}

function sameStyle(a: TextRunStyle, b: TextRunStyle): boolean {
  return RUN_STYLE_KEYS.every((key) => (a[key] === undefined && b[key] === undefined) || (a[key] !== undefined && b[key] !== undefined && sameValue(key, a[key], b[key])));
}

function styleOf(run: TextRun): TextRunStyle {
  const style: Record<string, unknown> = {};
  for (const key of RUN_STYLE_KEYS) if (run[key] !== undefined) style[key] = run[key];
  return style as TextRunStyle;
}

function charOverrides(runs: readonly TextRun[], length: number): TextRunStyle[] {
  const styles: TextRunStyle[] = Array.from({ length }, () => ({}));
  for (const run of runs) {
    const style = styleOf(run);
    for (let i = Math.max(0, run.start); i < Math.min(length, run.end); i++) styles[i] = { ...styles[i], ...style };
  }
  return styles;
}

function runsOf(styles: readonly TextRunStyle[], base: RunStyle): TextRun[] {
  const runs: TextRun[] = [];
  styles.forEach((raw, index) => {
    const style = cleaned(raw, base);
    if (Object.keys(style).length === 0) return;
    const last = runs[runs.length - 1];
    if (last && last.end === index && sameStyle(styleOf(last), style)) last.end = index + 1;
    else runs.push({ start: index, end: index + 1, ...style });
  });
  return runs;
}

function runsOrNothing(runs: TextRun[]): TextRun[] | undefined {
  return runs.length > 0 ? runs : undefined;
}

function patched(style: TextRunStyle, patch: RunStylePatch): TextRunStyle {
  const out: Record<string, unknown> = { ...style };
  for (const key of RUN_STYLE_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value === null || value === undefined) delete out[key];
    else out[key] = value;
  }
  return out as TextRunStyle;
}

export function styleRuns(runs: readonly TextRun[], length: number, base: RunStyle, range: TextRange, patch: RunStylePatch): TextRun[] {
  const styles = charOverrides(runs, length);
  for (let i = Math.max(0, range.start); i < Math.min(length, range.end); i++) styles[i] = patched(styles[i], patch);
  return runsOf(styles, base);
}

export function normalizedRuns(runs: readonly TextRun[], length: number, base: RunStyle): TextRun[] {
  return runsOf(charOverrides(runs, length), base);
}

export function sameRuns(a: readonly TextRun[] | undefined, b: readonly TextRun[] | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  return left.length === right.length && left.every((run, i) => run.start === right[i].start && run.end === right[i].end && sameStyle(styleOf(run), styleOf(right[i])));
}

function codePoints(text: string): string[] {
  return [...text];
}

export function runLength(layer: Pick<Layer, "text">): number {
  return codePoints(layer.text ?? "").length;
}

function wholeRange(range: TextRange | null, length: number): boolean {
  return range === null || (range.start <= 0 && range.end >= length);
}

export function textStylePatch(layer: Styled & Pick<Layer, "gradient">, range: TextRange | null, patch: RunStylePatch, length: number = runLength(layer)): Partial<Layer> {
  const runs = layer.runs ?? [];
  if (!wholeRange(range, length)) return { runs: runsOrNothing(styleRuns(runs, length, baseRunStyle(layer), range!, patch)) };
  const fields: Partial<Layer> = {};
  const runPatch: RunStylePatch = {};
  for (const key of RUN_STYLE_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (isLayerKey(key)) {
      if (value !== null && value !== undefined) Object.assign(fields, { [key]: value });
      runPatch[key] = null;
    } else {
      Object.assign(runPatch, { [key]: value });
    }
  }
  if (fields.fill !== undefined && layer.gradient) fields.gradient = undefined;
  const next = styleRuns(runs, length, baseRunStyle({ ...layer, ...fields }), { start: 0, end: length }, runPatch);
  return { ...fields, runs: runsOrNothing(next) };
}

export function withoutRunKeys(layer: Styled, keys: readonly RunStyleKey[]): TextRun[] | undefined {
  const length = runLength(layer);
  const clear = Object.fromEntries(keys.map((key) => [key, null])) as RunStylePatch;
  return runsOrNothing(styleRuns(layer.runs ?? [], length, baseRunStyle(layer), { start: 0, end: length }, clear));
}

function commonPrefix(a: readonly string[], b: readonly string[]): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function commonSuffix(a: readonly string[], b: readonly string[], prefix: number): number {
  let i = 0;
  while (i < a.length - prefix && i < b.length - prefix && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

export function retextRuns(runs: readonly TextRun[], before: string, after: string, base: RunStyle): TextRun[] {
  const old = codePoints(before);
  const next = codePoints(after);
  const styles = charOverrides(runs, old.length);
  const prefix = commonPrefix(old, next);
  const suffix = commonSuffix(old, next, prefix);
  const removed = old.length - prefix - suffix;
  const inherit = removed > 0 ? styles[prefix] : (styles[prefix - 1] ?? styles[prefix]);
  const inserted = Array.from({ length: next.length - prefix - suffix }, () => ({ ...(inherit ?? {}) }));
  return runsOf([...styles.slice(0, prefix), ...inserted, ...styles.slice(old.length - suffix)], base);
}

export function retextLayerPatch<P extends Partial<Layer>>(layer: Styled, patch: P): P {
  if (patch.text === undefined || patch.text === layer.text || "runs" in patch || !hasRuns(layer)) return patch;
  return { ...patch, runs: runsOrNothing(retextRuns(layer.runs ?? [], layer.text ?? "", patch.text, baseRunStyle({ ...layer, ...patch }))) };
}

export function counterTemplate(counter: Pick<Counter, "prefix" | "suffix">): string {
  return `${counter.prefix ?? ""}${COUNTER_SLOT}${counter.suffix ?? ""}`;
}

export function clipRunText(clip: Pick<Clip, "layer" | "counter">): string {
  return clip.counter ? counterTemplate(clip.counter) : (clip.layer?.text ?? "");
}

export function clipRunLength(clip: Pick<Clip, "layer" | "counter">): number {
  return codePoints(clipRunText(clip)).length;
}

export function retextClipPatch(clip: Pick<Clip, "layer" | "counter">, patch: ClipPatch): ClipPatch {
  const layer = clip.layer;
  if (!layer || !hasRuns(layer) || !("layer" in patch || "counter" in patch)) return patch;
  const nextLayer = "layer" in patch ? patch.layer : layer;
  if (!nextLayer || nextLayer.runs !== layer.runs) return patch;
  const nextCounter = "counter" in patch ? patch.counter : clip.counter;
  if (Boolean(nextCounter) !== Boolean(clip.counter)) return { ...patch, layer: { ...nextLayer, runs: undefined } };
  const before = clipRunText(clip);
  const after = clipRunText({ layer: nextLayer, counter: nextCounter });
  if (before === after) return patch;
  return { ...patch, layer: { ...nextLayer, runs: runsOrNothing(retextRuns(layer.runs ?? [], before, after, baseRunStyle(nextLayer))) } };
}

export function styleAt(layer: Styled, index: number): RunStyle {
  const base = baseRunStyle(layer);
  const run = (layer.runs ?? []).find((r) => index >= r.start && index < r.end);
  return run ? { ...base, ...styleOf(run) } : base;
}

export function rangeValue<K extends RunStyleKey>(layer: Styled, range: TextRange | null, key: K, length: number = runLength(layer)): RangeValue<K> {
  const start = range ? Math.max(0, Math.min(range.start, length)) : 0;
  const end = range ? Math.max(start, Math.min(range.end, length)) : length;
  if (end === start) return { mixed: false, value: styleAt(layer, Math.max(0, start - 1))[key] };
  const first = styleAt(layer, start)[key];
  for (let i = start + 1; i < end; i++) {
    if (!sameValue(key, styleAt(layer, i)[key], first)) return { mixed: true };
  }
  return { mixed: false, value: first };
}

export function spansOf(text: string, runs: readonly TextRun[], base: RunStyle): TextSpan[] {
  const chars = codePoints(text);
  const styles = charOverrides(runs, chars.length);
  const spans: TextSpan[] = [];
  chars.forEach((char, index) => {
    const last = spans[spans.length - 1];
    if (last && sameStyle(styles[index], styles[index - 1])) {
      last.end = index + 1;
      last.text += char;
      return;
    }
    spans.push({ start: index, end: index + 1, text: char, style: { ...base, ...styles[index] } });
  });
  return spans;
}

export function textSpans(layer: Styled): TextSpan[] {
  return spansOf(layer.text ?? "", layer.runs ?? [], baseRunStyle(layer));
}

const BLANK = /\s/;

export function collapsedSpans(layer: Styled): TextSpan[] {
  const chars = codePoints(layer.text ?? "");
  const styles = charOverrides(layer.runs ?? [], chars.length);
  const kept: string[] = [];
  const keptStyles: TextRunStyle[] = [];
  chars.forEach((char, index) => {
    const blank = BLANK.test(char);
    if (blank && index > 0 && BLANK.test(chars[index - 1])) return;
    kept.push(blank ? " " : char);
    keptStyles.push(styles[index]);
  });
  const base = baseRunStyle(layer);
  return spansOf(kept.join(""), runsOf(keptStyles, base), base);
}

export function styledLayer(layer: Layer, style: RunStyle): Layer {
  return { ...layer, fill: style.fill, fontId: style.fontId, fontWeight: style.fontWeight, fontSize: style.fontSize, italic: style.italic, letterSpacing: style.letterSpacing, runs: undefined };
}

export function drawnText(text: string, style: Pick<RunStyle, "caps">): string {
  return style.caps ? codePoints(text).map((char) => char.toUpperCase()).join("") : text;
}

export interface CounterRunStyles {
  prefix: RunStyle[];
  number: RunStyle;
  suffix: RunStyle[];
}

export function counterRunStyles(layer: Styled, counter: Pick<Counter, "prefix" | "suffix">): CounterRunStyles {
  const prefix = codePoints(counter.prefix ?? "").length;
  const suffix = codePoints(counter.suffix ?? "").length;
  const at = (index: number) => styleAt(layer, index);
  return {
    prefix: Array.from({ length: prefix }, (_, i) => at(i)),
    number: at(prefix),
    suffix: Array.from({ length: suffix }, (_, i) => at(prefix + 1 + i)),
  };
}

export function counterTextRuns(layer: Styled, counter: Pick<Counter, "prefix" | "suffix">, number: string): TextRun[] | undefined {
  if (!hasRuns(layer)) return undefined;
  const styles = counterRunStyles(layer, counter);
  const shown = [...styles.prefix, ...codePoints(number).map(() => styles.number), ...styles.suffix];
  return runsOrNothing(runsOf(shown, baseRunStyle(layer)));
}

export function counterTemplateRange(counter: Pick<Counter, "prefix" | "suffix">, number: string, range: TextRange): TextRange {
  const prefix = codePoints(counter.prefix ?? "").length;
  const digits = codePoints(number).length;
  const startOf = (index: number) => (index < prefix ? index : index < prefix + digits ? prefix : prefix + 1 + index - prefix - digits);
  const endOf = (index: number) => (index <= prefix ? index : index <= prefix + digits ? prefix + 1 : prefix + 1 + index - prefix - digits);
  if (range.start === range.end) return { start: endOf(range.end), end: endOf(range.end) };
  return { start: startOf(range.start), end: endOf(range.end) };
}

function matchesAt(text: readonly string[], match: readonly string[], at: number, loose: boolean): boolean {
  return match.every((char, i) => (loose ? text[at + i]?.toLowerCase() === char.toLowerCase() : text[at + i] === char));
}

function scan(text: readonly string[], match: readonly string[], loose: boolean): TextRange[] {
  const found: TextRange[] = [];
  for (let at = 0; at + match.length <= text.length; at++) {
    if (!matchesAt(text, match, at, loose)) continue;
    found.push({ start: at, end: at + match.length });
    at += match.length - 1;
  }
  return found;
}

export function findTextRanges(text: string, match: string, all: boolean): TextRange[] {
  const chars = codePoints(text);
  const wanted = codePoints(match);
  if (wanted.length === 0) return [];
  const exact = scan(chars, wanted, false);
  const found = exact.length > 0 ? exact : scan(chars, wanted, true);
  return all ? found : found.slice(0, 1);
}

function hasStyle(run: TextRun): boolean {
  return (
    (run.fill ?? "") !== "" ||
    (run.fontId ?? "") !== "" ||
    (run.fontWeight ?? 0) !== 0 ||
    (run.fontSize ?? 0) !== 0 ||
    run.italic !== undefined ||
    run.underline === true ||
    run.caps === true ||
    run.letterSpacing !== undefined
  );
}

function within(value: number, [low, high]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= low && value <= high;
}

function runValueIssue(run: TextRun): IssueCode | null {
  if ((run.fill ?? "") !== "" && parseColor(run.fill) === null) return "invalid";
  if ((run.fontId ?? "") !== "" && !isFontId(run.fontId)) return "unknown";
  const weight = run.fontWeight ?? 0;
  if (weight !== 0 && (!Number.isInteger(weight) || weight < 100 || weight > 900 || weight % 100 !== 0)) return "out_of_range";
  if ((run.fontSize ?? 0) !== 0 && !within(run.fontSize ?? 0, LAYER_RANGES.fontSize)) return "out_of_range";
  if (run.letterSpacing !== undefined && !within(run.letterSpacing, LAYER_RANGES.letterSpacing)) return "out_of_range";
  return null;
}

export function textRunsIssue(layer: Pick<Layer, "type" | "runs">, length: number): IssueCode | null {
  const runs = layer.runs ?? [];
  if (runs.length === 0) return null;
  if (layer.type !== "text") return "invalid";
  let end = 0;
  for (const run of runs) {
    if (!Number.isInteger(run.start) || !Number.isInteger(run.end) || run.start < end || run.end <= run.start || run.end > length) return "invalid";
    if (!hasStyle(run)) return "invalid";
    const code = runValueIssue(run);
    if (code) return code;
    end = run.end;
  }
  return null;
}
