import { COUNTER_LIMITS, COUNTER_LOCALES, counterIssue, counterPatch, counterRange, counterText, counterValueAt, countPatch, finalCounterValue, isCounterLocale, newCounter, type Counter, type CounterLocale } from "../counter";
import { videoCanvasSize, type Clip, type VideoDocument } from "../document";
import { editKeyed, isAnimated } from "../keyframe-edit";
import { isEasing, keyframeFault, type Easing } from "../keyframes";
import { animatesText } from "../text-animation";
import { isTextPathAlign, isTextPathShape, newTextPath, reshapedTextPath, TEXT_PATH_ALIGNS, TEXT_PATH_BEND_RANGE, TEXT_PATH_SHAPES, textPathIssue, textPathPatch, usesBend, type TextPath, type TextPathAlign, type TextPathShape } from "../text-path";
import { PATH_OFFSET_RANGE, type TextKeyProperty } from "../text-properties";
import { findClip, updateClip, type ClipPatch } from "../timeline";
import { keyframeFaultText } from "./keyframe-text";

export interface AgentTextFields {
  counter_value?: number;
  counter_from?: number;
  counter_to?: number;
  count_start_ms?: number;
  count_ms?: number;
  decimals?: number;
  counter_locale?: CounterLocale;
  grouping?: boolean;
  prefix?: string;
  suffix?: string;
  path_shape?: TextPathShape;
  bend?: number;
  path_offset?: number;
  path_align?: TextPathAlign;
  upright?: boolean;
  path_reverse?: boolean;
}

interface TextOpInput extends AgentTextFields {
  op: string;
  clip_id?: string;
  at_ms?: number;
  easing?: Easing;
  path?: string;
}

type TextOpResult = { ok: true; document: VideoDocument } | { ok: false; reason: string };

export const TEXT_OPERATIONS = ["set_counter", "remove_counter", "set_text_path", "remove_text_path"] as const;

const DEFAULT_COUNTER_LOCALE: CounterLocale = "pt-BR";

const DEFAULT_COUNT_EASING: Easing = "easeOut";

export interface OutlineCounter {
  value?: number;
  from?: number;
  to?: number;
  count_start_ms?: number;
  count_ms?: number;
  easing?: string;
  decimals: number;
  locale: CounterLocale;
  grouping: boolean;
  prefix?: string;
  suffix?: string;
  shows: string;
}

export interface OutlineTextPath {
  shape: TextPathShape;
  bend?: number;
  path?: string;
  offset: number;
  align: TextPathAlign;
  upright?: boolean;
  reverse?: boolean;
}

function refuse(reason: string): TextOpResult {
  return { ok: false, reason };
}

function textRefusal(clip: Clip): string | null {
  return animatesText(clip) ? null : `o clipe ${clip.id} não é um texto; contador e texto em caminho valem só para clipes de texto (add_text)`;
}

export function textGroupFor(clip: Clip, property: TextKeyProperty): ClipPatch | string {
  const refusal = textRefusal(clip);
  if (refusal) return refusal;
  if (property === "counter") return clip.counter ? {} : counterPatch(clip, newCounter(DEFAULT_COUNTER_LOCALE));
  return clip.textPath ? {} : textPathPatch(clip, newTextPath("arc", clip.layer));
}

function located(doc: VideoDocument, op: TextOpInput): Clip | string {
  const found = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!found) return `o clipe ${op.clip_id ?? "(sem id)"} não existe; leia o projeto de novo com studio_read`;
  if (found.track.locked) return `o clipe ${found.clip.id} está numa faixa travada; destrave com update_track antes`;
  return found.clip;
}

function momentIssue(clip: Clip, atMs: number | undefined, name: string): string | null {
  if (atMs !== undefined && (atMs < 0 || atMs > clip.durationMs)) return `${name} conta do início do clipe: de 0 a ${clip.durationMs}`;
  return null;
}

function counterInputIssue(op: TextOpInput): string | null {
  if (op.counter_value !== undefined && (op.counter_from !== undefined || op.counter_to !== undefined)) return "mande counter_value para um número parado ou counter_from e counter_to para contar, não os dois";
  if (op.counter_locale !== undefined && !isCounterLocale(op.counter_locale)) return `counter_locale aceita: ${COUNTER_LOCALES.join(", ")}`;
  if (op.decimals !== undefined && (!Number.isInteger(op.decimals) || op.decimals < COUNTER_LIMITS.decimals[0] || op.decimals > COUNTER_LIMITS.decimals[1])) return `decimals é um inteiro de ${COUNTER_LIMITS.decimals[0]} a ${COUNTER_LIMITS.decimals[1]}`;
  if (op.easing !== undefined && !isEasing(op.easing)) return "easing precisa ser uma curva das chaves (linear, easeOut, backOut, spring ou cubic-bezier(x1,y1,x2,y2))";
  return null;
}

function affixed(value: string | undefined, current: string | undefined): string | undefined {
  if (value === undefined) return current;
  return value === "" ? undefined : value;
}

function counterOf(clip: Clip, op: TextOpInput): Counter {
  const base = clip.counter ?? newCounter(DEFAULT_COUNTER_LOCALE);
  const prefix = affixed(op.prefix, base.prefix);
  const suffix = affixed(op.suffix, base.suffix);
  return {
    value: base.value,
    decimals: op.decimals ?? base.decimals,
    locale: op.counter_locale ?? base.locale,
    grouping: op.grouping ?? base.grouping,
    ...(prefix !== undefined ? { prefix } : {}),
    ...(suffix !== undefined ? { suffix } : {}),
  };
}

const COUNTER_ISSUES: Record<string, string> = {
  too_large: `prefix e suffix têm até ${COUNTER_LIMITS.affixRunes} caracteres cada`,
  invalid: "prefix e suffix não aceitam quebras de linha nem caracteres de controle",
  out_of_range: "o valor do contador vai de -1000000000000 a 1000000000000",
};

function setCounter(doc: VideoDocument, op: TextOpInput): TextOpResult {
  const target = located(doc, op);
  if (typeof target === "string") return refuse(target);
  const refusal = textRefusal(target) ?? counterInputIssue(op) ?? momentIssue(target, op.at_ms, "at_ms") ?? momentIssue(target, op.count_start_ms, "count_start_ms");
  if (refusal) return refuse(`set_counter: ${refusal}`);
  let clip: Clip = { ...target, ...counterPatch(target, counterOf(target, op)) };
  if (op.counter_from !== undefined || op.counter_to !== undefined) {
    const startMs = Math.round(op.count_start_ms ?? counterRange(clip)?.startMs ?? 0);
    const durationMs = Math.round(op.count_ms ?? clip.durationMs - startMs);
    if (durationMs < 0 || startMs + durationMs > clip.durationMs) return refuse(`set_counter: a contagem precisa caber no clipe; count_start_ms mais count_ms vai até ${clip.durationMs}`);
    const from = op.counter_from ?? counterValueAt(clip, startMs);
    const to = op.counter_to ?? finalCounterValue(clip);
    clip = { ...clip, ...countPatch(clip, { from, to, startMs, durationMs, easing: op.easing ?? DEFAULT_COUNT_EASING }) };
  }
  if (op.counter_value !== undefined) {
    if (isAnimated(clip, "counter") && op.at_ms === undefined) return refuse("set_counter: o contador está animado; mande at_ms (ms dentro do clipe) para gravar uma chave nesse momento, ou counter_from e counter_to para refazer a contagem");
    clip = { ...clip, ...editKeyed(clip, "counter", op.counter_value, op.at_ms === undefined ? null : Math.round(op.at_ms)).patch };
  }
  const code = counterIssue(clip);
  if (code) return refuse(`set_counter: ${COUNTER_ISSUES[code] ?? `o contador ficaria inválido (${code})`}`);
  const fault = keyframeFault(clip.keyframes, clip.transform);
  if (fault) return refuse(keyframeFaultText(fault));
  return { ok: true, document: updateClip(doc, clip.id, { counter: clip.counter, keyframes: clip.keyframes }) };
}

function pathInputIssue(op: TextOpInput, shape: TextPathShape): string | null {
  if (op.path_shape !== undefined && !isTextPathShape(op.path_shape)) return `path_shape aceita: ${TEXT_PATH_SHAPES.join(", ")}`;
  if (op.path_align !== undefined && !isTextPathAlign(op.path_align)) return `path_align aceita: ${TEXT_PATH_ALIGNS.join(", ")}`;
  if (op.bend !== undefined && !usesBend(shape)) return "bend vale só para path_shape arc e wave";
  if (op.bend !== undefined && !(Number.isFinite(op.bend) && op.bend >= TEXT_PATH_BEND_RANGE[0] && op.bend <= TEXT_PATH_BEND_RANGE[1])) return `bend vai de ${TEXT_PATH_BEND_RANGE[0]} a ${TEXT_PATH_BEND_RANGE[1]}`;
  if (op.path !== undefined && shape !== "custom") return "path vale só com path_shape custom";
  if (op.path_offset !== undefined && !(Number.isFinite(op.path_offset) && op.path_offset >= PATH_OFFSET_RANGE[0] && op.path_offset <= PATH_OFFSET_RANGE[1])) return `path_offset vai de ${PATH_OFFSET_RANGE[0]} a ${PATH_OFFSET_RANGE[1]}`;
  return null;
}

function shapedPath(doc: VideoDocument, clip: Clip, op: TextOpInput): TextPath {
  const shape = op.path_shape ?? clip.textPath?.shape ?? (op.path !== undefined ? "custom" : "arc");
  const canvas = videoCanvasSize(doc);
  const current = clip.textPath ?? newTextPath(shape, clip.layer);
  const reshaped = current.shape === shape ? current : reshapedTextPath(current, shape, { width: clip.transform.w * canvas.width, height: clip.transform.h * canvas.height });
  return {
    ...reshaped,
    ...(op.bend !== undefined ? { bend: op.bend } : {}),
    ...(op.path !== undefined ? { path: op.path } : {}),
    ...(op.path_align !== undefined ? { align: op.path_align } : {}),
    ...(op.upright !== undefined ? { upright: op.upright || undefined } : {}),
    ...(op.path_reverse !== undefined ? { reverse: op.path_reverse || undefined } : {}),
  };
}

const PATH_ISSUES: Record<string, string> = {
  invalid: "path precisa ser um caminho SVG válido (comandos M L H V C S Q T A Z, coordenadas de 0 a 1 na caixa do clipe)",
  out_of_range: `bend vai de ${TEXT_PATH_BEND_RANGE[0]} a ${TEXT_PATH_BEND_RANGE[1]} e path_offset de ${PATH_OFFSET_RANGE[0]} a ${PATH_OFFSET_RANGE[1]}`,
};

function setTextPath(doc: VideoDocument, op: TextOpInput): TextOpResult {
  const target = located(doc, op);
  if (typeof target === "string") return refuse(target);
  const shape = op.path_shape ?? target.textPath?.shape ?? (op.path !== undefined ? "custom" : "arc");
  const refusal = textRefusal(target) ?? pathInputIssue(op, shape) ?? momentIssue(target, op.at_ms, "at_ms");
  if (refusal) return refuse(`set_text_path: ${refusal}`);
  let clip: Clip = { ...target, ...textPathPatch(target, shapedPath(doc, target, op)) };
  if (op.path_offset !== undefined) {
    if (isAnimated(clip, "pathOffset") && op.at_ms === undefined) return refuse("set_text_path: path_offset está animado; mande at_ms (ms dentro do clipe) para gravar uma chave nesse momento, ou troque as chaves com animate property pathOffset");
    clip = { ...clip, ...editKeyed(clip, "pathOffset", op.path_offset, op.at_ms === undefined ? null : Math.round(op.at_ms)).patch };
  }
  const code = textPathIssue(clip);
  if (code) return refuse(`set_text_path: ${PATH_ISSUES[code] ?? `o caminho ficaria inválido (${code})`}`);
  return { ok: true, document: updateClip(doc, clip.id, { textPath: clip.textPath, keyframes: clip.keyframes, layer: clip.layer }) };
}

function removeCounter(doc: VideoDocument, op: TextOpInput): TextOpResult {
  const clip = located(doc, op);
  if (typeof clip === "string") return refuse(clip);
  if (!clip.counter) return refuse(`o clipe ${clip.id} não tem contador`);
  return { ok: true, document: updateClip(doc, clip.id, counterPatch(clip, null)) };
}

function removeTextPath(doc: VideoDocument, op: TextOpInput): TextOpResult {
  const clip = located(doc, op);
  if (typeof clip === "string") return refuse(clip);
  if (!clip.textPath) return refuse(`o clipe ${clip.id} não tem texto em caminho`);
  return { ok: true, document: updateClip(doc, clip.id, textPathPatch(clip, null)) };
}

export function textOperation(doc: VideoDocument, op: TextOpInput): TextOpResult | null {
  switch (op.op) {
    case "set_counter":
      return setCounter(doc, op);
    case "remove_counter":
      return removeCounter(doc, op);
    case "set_text_path":
      return setTextPath(doc, op);
    case "remove_text_path":
      return removeTextPath(doc, op);
  }
  return null;
}

function rounded(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function counterOutline(clip: Clip): OutlineCounter | undefined {
  const counter = clip.counter;
  if (!counter) return undefined;
  const range = counterRange(clip);
  return {
    ...(range ? { from: range.from, to: range.to, count_start_ms: range.startMs, count_ms: range.durationMs, easing: range.easing } : { value: counter.value }),
    decimals: counter.decimals,
    locale: counter.locale,
    grouping: counter.grouping,
    ...(counter.prefix ? { prefix: counter.prefix } : {}),
    ...(counter.suffix ? { suffix: counter.suffix } : {}),
    shows: counterText(counter, finalCounterValue(clip)),
  };
}

export function textPathOutline(path: TextPath): OutlineTextPath {
  return {
    shape: path.shape,
    ...(path.bend !== undefined ? { bend: rounded(path.bend) } : {}),
    ...(path.path ? { path: path.path } : {}),
    offset: rounded(path.offset),
    align: path.align,
    ...(path.upright ? { upright: true } : {}),
    ...(path.reverse ? { reverse: true } : {}),
  };
}
