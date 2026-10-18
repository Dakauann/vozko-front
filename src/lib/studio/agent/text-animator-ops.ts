import { videoCanvasSize, type Clip, type VideoDocument } from "../document";
import { isEasing, type Easing, type Keyframe } from "../keyframes";
import { TEXT_UNITS, animatesText, type TextUnit } from "../text-animation";
import {
  fontPxOf,
  isAnimatorColor,
  isAnimatorNumber,
  isOpaqueHex,
  newTextUnitAnimator,
  TEXT_ANIMATOR_PRESETS,
  TEXT_ANIMATOR_SEED_RANGE,
  textAnimatorPreset,
  type TextAnimatorPreset,
} from "../text-animator";
import {
  addClipTextAnimator,
  animateClipTextAnimator,
  moveClipTextAnimator,
  patchTextAnimator,
  removeClipTextAnimator,
  replaceClipTextAnimator,
  updateClipTextAnimator,
  type TextAnimatorEdit,
  type TextAnimatorPatch,
  type TextAnimatorRefusal,
} from "../text-animator-edit";
import {
  ANIMATOR_COLORS,
  ANIMATOR_NUMBER_RANGES,
  ANIMATOR_NUMBERS,
  RANGE_LIMITS,
  RANGE_ORDERS,
  RANGE_SHAPES,
  RANGE_UNITS,
  SELECTOR_KINDS,
  selectorKeyRange,
  selectorKeys,
  WIGGLY_LIMITS,
  type AnimatorColor,
  type AnimatorNumber,
  type RangeOrder,
  type RangeShape,
  type RangeUnits,
  type SelectorKey,
  type SelectorKind,
  type TextUnitAnimator,
} from "../text-selectors";
import { findClip } from "../timeline";

export const TEXT_ANIMATOR_OPERATIONS = ["add_text_animator", "update_text_animator", "animate_text_animator", "move_text_animator", "remove_text_animator"] as const;

export type AgentAnimatorProperties = Partial<Record<AnimatorNumber, number>> & Partial<Record<AnimatorColor, string>>;

export interface AgentTextAnimatorFields {
  animator_id?: string;
  animator_preset?: TextAnimatorPreset;
  animator_properties?: AgentAnimatorProperties;
  remove_properties?: (AnimatorNumber | AnimatorColor)[];
  selector_kind?: SelectorKind;
  range_units?: RangeUnits;
  range_start?: number;
  range_end?: number;
  range_offset?: number;
  range_order?: RangeOrder;
  range_shape?: RangeShape;
  ease_high?: number;
  ease_low?: number;
  selector_amount?: number;
  selector_seed?: number;
  wiggly_rate?: number;
  wiggly_loop_ms?: number;
  wiggly_correlation?: number;
  selector_property?: SelectorKey;
}

interface TextAnimatorOpInput extends AgentTextAnimatorFields {
  op: string;
  clip_id?: string;
  unit?: TextUnit;
  at_ms?: number;
  to_index?: number;
  keys?: { at_ms: number; value?: number; easing?: Easing }[];
}

type TextAnimatorOpResult = { ok: true; document: VideoDocument; animatorId: string } | { ok: false; reason: string };

export interface OutlineTextAnimator {
  id: string;
  unit: TextUnit;
  properties: AgentAnimatorProperties;
  selector: Record<string, number | string>;
  keys?: Partial<Record<SelectorKey, { at_ms: number; value: number; easing: Easing }[]>>;
}

const DEFAULT_KEY_EASING: Easing = "easeInOut";
const READ_AGAIN = "leia o projeto de novo com studio_read";

function refuse(reason: string): TextAnimatorOpResult {
  return { ok: false, reason };
}

function within(value: unknown, [low, high]: readonly [number, number]): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= low && value <= high;
}

function refusalText(reason: TextAnimatorRefusal, op: TextAnimatorOpInput): string {
  switch (reason) {
    case "missing":
      return `o clipe ${op.clip_id ?? "(sem id)"} não existe; ${READ_AGAIN}`;
    case "locked":
      return `o clipe ${op.clip_id} está numa faixa travada; destrave com update_track antes`;
    case "notVisual":
    case "notText":
      return `o clipe ${op.clip_id} não é um texto; animadores de texto valem só para clipes de texto (add_text)`;
    case "animatorMissing":
      return `o animador ${op.animator_id ?? "(sem id)"} não existe no clipe ${op.clip_id}; ${READ_AGAIN}`;
    case "animated":
      return "esse valor do seletor tem chaves; mande at_ms (ms dentro do clipe) para gravar uma chave nesse momento, ou troque as chaves com animate_text_animator";
    case "outside":
      return `as chaves precisam ficar entre 0 e a duração do clipe ${op.clip_id}`;
    case "foreign":
      return "range_units, range_start, range_end, range_offset, range_order, range_shape, ease_high e ease_low valem para selector_kind range; wiggly_rate, wiggly_loop_ms e wiggly_correlation para wiggly; o wiggly só anima selector_amount";
    case "invalid":
      return `o animador ficaria inválido; confira os limites: ${limitsText()}; fill e stroke pedem #rrggbb e só valem se o texto já pinta essa parte (stroke precisa de contorno no texto)`;
  }
}

function limitsText(): string {
  const numbers = ANIMATOR_NUMBERS.map((name) => `${name} de ${ANIMATOR_NUMBER_RANGES[name][0]} a ${ANIMATOR_NUMBER_RANGES[name][1]}`).join(", ");
  return `${numbers}; range_start e range_end de 0 a 100 em percent ou de 0 a ${RANGE_LIMITS.index.edge[1]} em index, range_offset de -100 a 100 em percent, ease_high e ease_low de -100 a 100, selector_amount de -100 a 100 no range e de 0 a 100 no wiggly, wiggly_rate de ${WIGGLY_LIMITS.rate[0]} a ${WIGGLY_LIMITS.rate[1]}, wiggly_loop_ms de ${WIGGLY_LIMITS.loopMs[0]} a ${WIGGLY_LIMITS.loopMs[1]}, wiggly_correlation de 0 a 100`;
}

function located(doc: VideoDocument, op: TextAnimatorOpInput): Clip | string {
  const found = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!found) return `o clipe ${op.clip_id ?? "(sem id)"} não existe; ${READ_AGAIN}`;
  if (!animatesText(found.clip)) return refusalText("notText", op);
  return found.clip;
}

function target(clip: Clip, op: TextAnimatorOpInput): TextUnitAnimator | string {
  const list = clip.textAnimators ?? [];
  const animator = op.animator_id ? list.find((entry) => entry.id === op.animator_id) : list.length === 1 ? list[0] : undefined;
  if (animator) return animator;
  if (op.animator_id) return refusalText("animatorMissing", op);
  return list.length === 0 ? `o clipe ${clip.id} não tem animadores de texto; use add_text_animator` : `o clipe ${clip.id} tem ${list.length} animadores; mande animator_id (${list.map((entry) => entry.id).join(", ")})`;
}

function inputIssue(op: TextAnimatorOpInput): string | null {
  if (op.unit !== undefined && !(TEXT_UNITS as readonly string[]).includes(op.unit)) return `unit aceita: ${TEXT_UNITS.join(", ")}`;
  if (op.selector_kind !== undefined && !(SELECTOR_KINDS as readonly string[]).includes(op.selector_kind)) return `selector_kind aceita: ${SELECTOR_KINDS.join(", ")}`;
  if (op.range_units !== undefined && !(RANGE_UNITS as readonly string[]).includes(op.range_units)) return `range_units aceita: ${RANGE_UNITS.join(", ")}`;
  if (op.range_order !== undefined && !(RANGE_ORDERS as readonly string[]).includes(op.range_order)) return `range_order aceita: ${RANGE_ORDERS.join(", ")}`;
  if (op.range_shape !== undefined && !(RANGE_SHAPES as readonly string[]).includes(op.range_shape)) return `range_shape aceita: ${RANGE_SHAPES.join(", ")}`;
  if (op.selector_seed !== undefined && !(Number.isInteger(op.selector_seed) && within(op.selector_seed, TEXT_ANIMATOR_SEED_RANGE))) return `selector_seed é um inteiro de ${TEXT_ANIMATOR_SEED_RANGE[0]} a ${TEXT_ANIMATOR_SEED_RANGE[1]}`;
  if (op.wiggly_loop_ms !== undefined && !Number.isInteger(op.wiggly_loop_ms)) return "wiggly_loop_ms é um inteiro em ms";
  for (const [name, value] of Object.entries(op.animator_properties ?? {})) {
    if (value === undefined) continue;
    if (isAnimatorColor(name)) {
      if (!isOpaqueHex(value)) return `${name} precisa ser uma cor #rrggbb`;
      continue;
    }
    if (!isAnimatorNumber(name)) return `${name} não é uma propriedade de animador; use ${[...ANIMATOR_NUMBERS, ...ANIMATOR_COLORS].join(", ")}`;
    if (!within(value, ANIMATOR_NUMBER_RANGES[name])) return `${name} vai de ${ANIMATOR_NUMBER_RANGES[name][0]} a ${ANIMATOR_NUMBER_RANGES[name][1]}`;
  }
  for (const name of op.remove_properties ?? []) {
    if (!isAnimatorNumber(name) && !isAnimatorColor(name)) return `remove_properties aceita: ${[...ANIMATOR_NUMBERS, ...ANIMATOR_COLORS].join(", ")}`;
  }
  return null;
}

function patchOf(op: TextAnimatorOpInput): TextAnimatorPatch {
  const keyed: Partial<Record<SelectorKey, number>> = {
    ...(op.range_start !== undefined ? { start: op.range_start } : {}),
    ...(op.range_end !== undefined ? { end: op.range_end } : {}),
    ...(op.range_offset !== undefined ? { offset: op.range_offset } : {}),
    ...(op.selector_amount !== undefined ? { amount: op.selector_amount } : {}),
  };
  const properties: TextAnimatorPatch["properties"] = { ...op.animator_properties };
  for (const name of op.remove_properties ?? []) properties[name] = null;
  return {
    ...(op.unit ? { unit: op.unit } : {}),
    ...(Object.keys(properties).length > 0 ? { properties } : {}),
    ...(op.selector_kind ? { kind: op.selector_kind } : {}),
    ...(op.range_units ? { units: op.range_units } : {}),
    ...(op.range_order ? { order: op.range_order } : {}),
    ...(op.range_shape ? { shape: op.range_shape } : {}),
    ...(op.ease_high !== undefined ? { easeHigh: op.ease_high } : {}),
    ...(op.ease_low !== undefined ? { easeLow: op.ease_low } : {}),
    ...(op.selector_seed !== undefined ? { seed: op.selector_seed } : {}),
    ...(op.wiggly_rate !== undefined ? { rate: op.wiggly_rate } : {}),
    ...(op.wiggly_loop_ms !== undefined ? { loopMs: op.wiggly_loop_ms } : {}),
    ...(op.wiggly_correlation !== undefined ? { correlation: op.wiggly_correlation } : {}),
    ...(Object.keys(keyed).length > 0 ? { keyed } : {}),
  };
}

function settled(result: TextAnimatorEdit, op: TextAnimatorOpInput, animatorId: string): TextAnimatorOpResult {
  return result.ok ? { ok: true, document: result.document, animatorId } : refuse(refusalText(result.reason, op));
}

function addAnimator(doc: VideoDocument, op: TextAnimatorOpInput): TextAnimatorOpResult {
  const clip = located(doc, op);
  if (typeof clip === "string") return refuse(clip);
  const issue = inputIssue(op);
  if (issue) return refuse(`add_text_animator: ${issue}`);
  if (op.animator_preset !== undefined && !(TEXT_ANIMATOR_PRESETS as readonly string[]).includes(op.animator_preset)) return refuse(`animator_preset aceita: ${TEXT_ANIMATOR_PRESETS.join(", ")}`);
  const context = { durationMs: clip.durationMs, fontPx: fontPxOf(clip.layer, videoCanvasSize(doc).height), layer: clip.layer! };
  const base = op.animator_preset ? textAnimatorPreset(op.animator_preset, context, op.selector_seed) : newTextUnitAnimator(op.unit ?? "char", {});
  if (!base) return refuse("animator_preset colorSweep pinta o preenchimento; o texto precisa de cor sólida (sem degradê nem lista de preenchimentos)");
  const animator = patchTextAnimator(base, patchOf(op), op.at_ms === undefined ? null : Math.round(op.at_ms));
  if (typeof animator === "string") return refuse(refusalText(animator, op));
  return settled(addClipTextAnimator(doc, clip.id, animator, op.to_index), op, animator.id);
}

function updateAnimator(doc: VideoDocument, op: TextAnimatorOpInput): TextAnimatorOpResult {
  const clip = located(doc, op);
  if (typeof clip === "string") return refuse(clip);
  const found = target(clip, op);
  if (typeof found === "string") return refuse(found);
  const issue = inputIssue(op);
  if (issue) return refuse(`update_text_animator: ${issue}`);
  if (op.animator_preset !== undefined) {
    if (!(TEXT_ANIMATOR_PRESETS as readonly string[]).includes(op.animator_preset)) return refuse(`animator_preset aceita: ${TEXT_ANIMATOR_PRESETS.join(", ")}`);
    const preset = textAnimatorPreset(op.animator_preset, { durationMs: clip.durationMs, fontPx: fontPxOf(clip.layer, videoCanvasSize(doc).height), layer: clip.layer! }, op.selector_seed ?? found.selector.seed);
    if (!preset) return refuse("animator_preset colorSweep pinta o preenchimento; o texto precisa de cor sólida");
    const replaced = replaceClipTextAnimator(doc, clip.id, { ...preset, id: found.id });
    if (!replaced.ok) return settled(replaced, op, found.id);
    return settled(updateClipTextAnimator(replaced.document, clip.id, found.id, patchOf({ ...op, selector_seed: undefined }), op.at_ms === undefined ? null : Math.round(op.at_ms)), op, found.id);
  }
  return settled(updateClipTextAnimator(doc, clip.id, found.id, patchOf(op), op.at_ms === undefined ? null : Math.round(op.at_ms)), op, found.id);
}

function animateAnimator(doc: VideoDocument, op: TextAnimatorOpInput): TextAnimatorOpResult {
  const clip = located(doc, op);
  if (typeof clip === "string") return refuse(clip);
  const found = target(clip, op);
  if (typeof found === "string") return refuse(found);
  const key = op.selector_property;
  const keys = selectorKeys(found.selector);
  if (!key || !keys.includes(key)) return refuse(`animate_text_animator precisa de selector_property: ${keys.join(", ")}`);
  const range = selectorKeyRange(found.selector, key)!;
  const given = op.keys ?? [];
  if (given.some((entry) => typeof entry.value !== "number")) return refuse(`as chaves de ${key} precisam de value`);
  if (given.some((entry) => entry.easing !== undefined && !isEasing(entry.easing))) return refuse("uma das chaves tem uma curva (easing) que não existe");
  if (given.some((entry) => !within(entry.value, range))) return refuse(`${key} vai de ${range[0]} a ${range[1]} neste seletor`);
  const frames: Keyframe[] = given.map((entry) => ({ atMs: Math.round(entry.at_ms), value: entry.value!, easing: entry.easing ?? DEFAULT_KEY_EASING })).sort((a, b) => a.atMs - b.atMs);
  if (frames.some((frame, i) => i > 0 && frame.atMs === frames[i - 1].atMs)) return refuse("duas chaves no mesmo at_ms; cada instante recebe uma chave");
  return settled(animateClipTextAnimator(doc, clip.id, found.id, key, frames), op, found.id);
}

function onTarget(doc: VideoDocument, op: TextAnimatorOpInput, edit: (clipId: string, animatorId: string) => TextAnimatorEdit): TextAnimatorOpResult {
  const clip = located(doc, op);
  if (typeof clip === "string") return refuse(clip);
  const found = target(clip, op);
  if (typeof found === "string") return refuse(found);
  return settled(edit(clip.id, found.id), op, found.id);
}

export function textAnimatorOperation(doc: VideoDocument, op: TextAnimatorOpInput): TextAnimatorOpResult | null {
  switch (op.op) {
    case "add_text_animator":
      return addAnimator(doc, op);
    case "update_text_animator":
      return updateAnimator(doc, op);
    case "animate_text_animator":
      return animateAnimator(doc, op);
    case "move_text_animator":
      return onTarget(doc, op, (clipId, animatorId) => moveClipTextAnimator(doc, clipId, animatorId, op.to_index ?? 0));
    case "remove_text_animator":
      return onTarget(doc, op, (clipId, animatorId) => removeClipTextAnimator(doc, clipId, animatorId));
  }
  return null;
}

function rounded(value: number): number {
  return Math.round(value * 1000) / 1000;
}

const SELECTOR_FIELD_NAMES: Record<string, string> = {
  kind: "selector_kind",
  units: "range_units",
  start: "range_start",
  end: "range_end",
  offset: "range_offset",
  order: "range_order",
  shape: "range_shape",
  easeHigh: "ease_high",
  easeLow: "ease_low",
  amount: "selector_amount",
  seed: "selector_seed",
  rate: "wiggly_rate",
  loopMs: "wiggly_loop_ms",
  correlation: "wiggly_correlation",
  offsetMs: "wiggly_offset_ms",
};

export function textAnimatorOutline(animator: TextUnitAnimator): OutlineTextAnimator {
  const keys = Object.entries(animator.keyframes ?? {}).flatMap(([key, frames]) =>
    (frames ?? []).length > 0 ? [[key, (frames ?? []).map((frame) => ({ at_ms: frame.atMs, value: rounded(frame.value), easing: frame.easing }))] as const] : [],
  );
  const selector = Object.fromEntries(Object.entries(animator.selector).map(([name, value]) => [SELECTOR_FIELD_NAMES[name] ?? name, typeof value === "number" ? rounded(value) : value]));
  return { id: animator.id, unit: animator.unit, properties: { ...animator.properties }, selector, ...(keys.length > 0 ? { keys: Object.fromEntries(keys) } : {}) };
}
