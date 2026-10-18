import { editFieldValue, fieldKeyState, lanesIssue, setFieldLane, shiftLanes, toggleFieldKey } from "./animated-fields";
import { parseColor } from "./color";
import { newStudioId, type Clip, type Layer } from "./document";
import type { KeyState } from "./keyframe-edit";
import type { Easing, Keyframe } from "./keyframes";
import { paintsProperty } from "./paint";
import { animatesText, TEXT_UNITS, type TextUnit } from "./text-animation";
import {
  ANIMATOR_COLORS,
  ANIMATOR_NUMBER_RANGES,
  ANIMATOR_NUMBERS,
  RANGE_LIMITS,
  RANGE_ORDERS,
  RANGE_SHAPES,
  RANGE_UNITS,
  SELECTOR_FIELDS,
  SELECTOR_KINDS,
  selectorKeyRange,
  WIGGLY_LIMITS,
  type AnimatorColor,
  type AnimatorNumber,
  type AnimatorProperties,
  type RangeSelector,
  type RangeUnits,
  type SelectorKey,
  type SelectorKind,
  type TextSelector,
  type TextUnitAnimator,
  type WigglySelector,
} from "./text-selectors";
import { isValidToken } from "./tokens";
import type { IssueCode } from "./validate";
import { randomSeed, VFX_SEED_RANGE } from "./vfx";

export const TEXT_ANIMATOR_SEED_RANGE = VFX_SEED_RANGE;

const INDEX_END = 1;

function within(value: unknown, [low, high]: readonly [number, number]): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= low && value <= high;
}

function wholeWithin(value: unknown, range: readonly [number, number]): boolean {
  return Number.isInteger(value) && within(value, range);
}

function listed<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

export function isAnimatorNumber(name: string): name is AnimatorNumber {
  return listed(ANIMATOR_NUMBERS, name);
}

export function isAnimatorColor(name: string): name is AnimatorColor {
  return listed(ANIMATOR_COLORS, name);
}

export function isOpaqueHex(value: unknown): value is string {
  return typeof value === "string" && value.length === 7 && parseColor(value) !== null;
}

export function newRangeSelector(seed: number = randomSeed()): RangeSelector {
  return { kind: "range", units: "percent", start: 0, end: 100, offset: 0, order: "forward", shape: "square", easeHigh: 0, easeLow: 0, amount: 100, seed };
}

export function newWigglySelector(seed: number = randomSeed()): WigglySelector {
  return { kind: "wiggly", rate: 2, loopMs: 2000, correlation: 50, amount: 100, seed };
}

function newSelector(kind: SelectorKind, seed: number = randomSeed()): TextSelector {
  return kind === "range" ? newRangeSelector(seed) : newWigglySelector(seed);
}

export function newTextUnitAnimator(unit: TextUnit = "char", properties: AnimatorProperties = { opacity: 0 }, selector: TextSelector = newRangeSelector()): TextUnitAnimator {
  return { id: newStudioId("anim"), unit, properties, selector };
}

const RANGE_ONLY = ["units", "start", "end", "offset", "order", "shape", "easeHigh", "easeLow"] as const;
const WIGGLY_ONLY = ["rate", "loopMs", "correlation", "offsetMs"] as const;

function selectorIssue(selector: TextSelector): IssueCode | null {
  if (!listed(SELECTOR_KINDS, selector.kind)) return "unknown";
  const foreign = selector.kind === "range" ? WIGGLY_ONLY : RANGE_ONLY;
  if (foreign.some((field) => (selector as unknown as Record<string, unknown>)[field] !== undefined)) return "invalid";
  if (!wholeWithin(selector.seed, TEXT_ANIMATOR_SEED_RANGE)) return "out_of_range";
  if (selector.kind === "wiggly") {
    if (!within(selector.rate, WIGGLY_LIMITS.rate) || !wholeWithin(selector.loopMs, WIGGLY_LIMITS.loopMs) || !within(selector.correlation, WIGGLY_LIMITS.correlation) || !within(selector.amount, WIGGLY_LIMITS.amount)) return "out_of_range";
    return selector.offsetMs === undefined || wholeWithin(selector.offsetMs, WIGGLY_LIMITS.offsetMs) ? null : "out_of_range";
  }
  if (!listed(RANGE_UNITS, selector.units) || !listed(RANGE_ORDERS, selector.order) || !listed(RANGE_SHAPES, selector.shape)) return "unknown";
  const limits = RANGE_LIMITS[selector.units];
  if (!within(selector.start, limits.edge) || !within(selector.end, limits.edge) || !within(selector.offset, limits.offset)) return "out_of_range";
  if (!within(selector.easeHigh, RANGE_LIMITS.ease) || !within(selector.easeLow, RANGE_LIMITS.ease) || !within(selector.amount, RANGE_LIMITS.amount)) return "out_of_range";
  return null;
}

function propertiesIssue(properties: AnimatorProperties, layer: Layer): IssueCode | null {
  for (const [name, value] of Object.entries(properties)) {
    if (value === undefined) continue;
    if (isAnimatorColor(name)) {
      if (!isOpaqueHex(value) || !paintsProperty(layer, name)) return "invalid";
      continue;
    }
    if (!isAnimatorNumber(name)) return "invalid";
    if (!within(value, ANIMATOR_NUMBER_RANGES[name])) return "out_of_range";
  }
  return null;
}

function textUnitAnimatorIssue(animator: TextUnitAnimator, layer: Layer): IssueCode | null {
  if (!listed(TEXT_UNITS, animator.unit)) return "unknown";
  if (typeof animator.properties !== "object" || animator.properties === null || typeof animator.selector !== "object" || animator.selector === null) return "invalid";
  return (
    propertiesIssue(animator.properties, layer) ??
    selectorIssue(animator.selector) ??
    lanesIssue(animator.keyframes ?? {}, (key) => selectorKeyRange(animator.selector, key as SelectorKey))
  );
}

export function textAnimatorsIssue(clip: Pick<Clip, "type" | "layer" | "textAnimators">): IssueCode | null {
  const list = clip.textAnimators ?? [];
  if (list.length === 0) return null;
  if (!animatesText(clip) || !clip.layer) return "invalid";
  const ids = new Set<string>();
  for (const animator of list) {
    if (!isValidToken(animator.id) || ids.has(animator.id)) return "invalid";
    ids.add(animator.id);
    const issue = textUnitAnimatorIssue(animator, clip.layer);
    if (issue) return issue;
  }
  return null;
}

export function selectorKeyState(animator: TextUnitAnimator, key: SelectorKey, localMs: number | null): KeyState {
  return fieldKeyState(animator, key, localMs);
}

export function editSelectorKey(animator: TextUnitAnimator, key: SelectorKey, value: number, localMs: number | null): TextUnitAnimator | null {
  return editFieldValue(SELECTOR_FIELDS, animator, key, value, localMs);
}

export function toggleSelectorKey(animator: TextUnitAnimator, key: SelectorKey, localMs: number): TextUnitAnimator {
  return toggleFieldKey(SELECTOR_FIELDS, animator, key, localMs);
}

export function setSelectorLane(animator: TextUnitAnimator, key: SelectorKey, frames: readonly Keyframe[]): TextUnitAnimator {
  return setFieldLane(SELECTOR_FIELDS, animator, key, frames);
}

function withoutLanes(animator: TextUnitAnimator, keys: readonly SelectorKey[]): TextUnitAnimator {
  const lanes = { ...animator.keyframes };
  for (const key of keys) delete lanes[key];
  const next = { ...animator };
  if (Object.keys(lanes).length > 0) next.keyframes = lanes;
  else delete next.keyframes;
  return next;
}

export function reselected(animator: TextUnitAnimator, kind: SelectorKind): TextUnitAnimator {
  if (animator.selector.kind === kind) return animator;
  const next = { ...animator, selector: newSelector(kind, animator.selector.seed) };
  delete next.keyframes;
  return next;
}

export function reunited(animator: TextUnitAnimator, units: RangeUnits): TextUnitAnimator {
  const selector = animator.selector;
  if (selector.kind !== "range" || selector.units === units) return animator;
  const cleared = withoutLanes(animator, ["start", "end", "offset"]);
  return { ...cleared, selector: { ...selector, units, start: 0, end: units === "percent" ? RANGE_LIMITS.percent.edge[1] : INDEX_END, offset: 0 } };
}

export function withProperty(animator: TextUnitAnimator, name: AnimatorNumber | AnimatorColor, value: number | string | null): TextUnitAnimator {
  const properties: AnimatorProperties = { ...animator.properties };
  if (value === null) delete properties[name];
  else (properties as Record<string, number | string>)[name] = value;
  return { ...animator, properties };
}

export function splitTextAnimators(list: readonly TextUnitAnimator[], atLocalMs: number): TextUnitAnimator[] {
  return list.map((animator) => {
    const keyframes = shiftLanes(animator.keyframes, -atLocalMs);
    const selector = animator.selector.kind === "wiggly" ? { ...animator.selector, offsetMs: (animator.selector.offsetMs ?? 0) + atLocalMs } : animator.selector;
    return { ...animator, selector, ...(keyframes ? { keyframes } : {}) };
  });
}

export function animatorKeyTimes(list: readonly TextUnitAnimator[] | undefined): number[] {
  return (list ?? []).flatMap((animator) => Object.values(animator.keyframes ?? {}).flatMap((frames) => (frames ?? []).map((frame) => frame.atMs)));
}

export function animatorWindow(list: readonly TextUnitAnimator[] | undefined, durationMs: number): [number, number] | null {
  if ((list ?? []).some((animator) => animator.selector.kind === "wiggly")) return [0, durationMs];
  const times = animatorKeyTimes(list).map((at) => Math.min(durationMs, Math.max(0, at)));
  return times.length > 1 ? [Math.min(...times), Math.max(...times)] : null;
}

export const TEXT_ANIMATOR_PRESETS = ["cascadeIn", "riseIn", "centerReveal", "randomFade", "blurIn", "trackingIn", "flipIn", "cascadeOut", "wave", "colorSweep", "wiggle"] as const;

export type TextAnimatorPreset = (typeof TEXT_ANIMATOR_PRESETS)[number];

interface PresetContext {
  durationMs: number;
  fontPx: number;
  layer: Layer;
}

const PRESET_SWEEP_COLOR = "#ffcc00";

const PRESET_MS = 1000;
const REVEAL_WIDTH = 25;
const RANDOM_WIDTH = 10;
const WAVE_WIDTH = 30;
const SETTLE_EASING: Easing = "cubic-bezier(0.05,0.7,0.1,1)";
const FLIP_DEGREES = 90;

function px(value: number, [low, high]: readonly [number, number]): number {
  return Math.round(Math.min(high, Math.max(low, value)) * 10) / 10;
}

function sweep(fromMs: number, toMs: number, width: number, easing: Easing): Keyframe[] {
  return [
    { atMs: fromMs, value: -width, easing },
    { atMs: toMs, value: RANGE_LIMITS.percent.offset[1], easing: "linear" },
  ];
}

function swept(unit: TextUnit, properties: AnimatorProperties, selector: Partial<RangeSelector>, frames: Keyframe[], seed: number): TextUnitAnimator {
  const base = newRangeSelector(seed);
  return { ...newTextUnitAnimator(unit, properties, { ...base, ...selector }), keyframes: { offset: frames } };
}

export function presetFits(id: TextAnimatorPreset, layer: Layer): boolean {
  return id !== "colorSweep" || paintsProperty(layer, "fill");
}

export function textAnimatorPreset(id: TextAnimatorPreset, context: PresetContext, seed: number = randomSeed()): TextUnitAnimator | null {
  if (!presetFits(id, context.layer)) return null;
  const length = Math.min(PRESET_MS, context.durationMs);
  const end = context.durationMs;
  const font = context.fontPx;
  const reveal = (width: number, easing: Easing) => sweep(0, length, width, easing);
  switch (id) {
    case "cascadeIn":
      return swept("char", { opacity: 0 }, { shape: "rampUp", end: REVEAL_WIDTH, offset: -REVEAL_WIDTH }, reveal(REVEAL_WIDTH, "easeOut"), seed);
    case "riseIn":
      return swept("word", { opacity: 0, y: px(font * 0.6, ANIMATOR_NUMBER_RANGES.y) }, { shape: "rampUp", end: REVEAL_WIDTH, offset: -REVEAL_WIDTH }, reveal(REVEAL_WIDTH, SETTLE_EASING), seed);
    case "centerReveal":
      return swept("char", { opacity: 0, scale: 0 }, { shape: "rampUp", order: "centerOut", end: REVEAL_WIDTH, offset: -REVEAL_WIDTH }, reveal(REVEAL_WIDTH, "easeOut"), seed);
    case "randomFade":
      return swept("char", { opacity: 0 }, { shape: "rampUp", order: "random", end: RANDOM_WIDTH, offset: -RANDOM_WIDTH }, reveal(RANDOM_WIDTH, "linear"), seed);
    case "blurIn":
      return swept("word", { opacity: 0, blur: px(font * 0.4, ANIMATOR_NUMBER_RANGES.blur) }, { shape: "rampUp", end: REVEAL_WIDTH, offset: -REVEAL_WIDTH }, reveal(REVEAL_WIDTH, "easeOut"), seed);
    case "trackingIn":
      return {
        ...newTextUnitAnimator("char", { opacity: 0, tracking: px(font * 0.5, ANIMATOR_NUMBER_RANGES.tracking) }, newRangeSelector(seed)),
        keyframes: {
          amount: [
            { atMs: 0, value: RANGE_LIMITS.amount[1], easing: "easeOut" },
            { atMs: length, value: 0, easing: "linear" },
          ],
        },
      };
    case "flipIn":
      return swept("char", { opacity: 0, rotationX: FLIP_DEGREES }, { shape: "rampUp", end: REVEAL_WIDTH, offset: -REVEAL_WIDTH }, reveal(REVEAL_WIDTH, "easeOut"), seed);
    case "cascadeOut":
      return swept("char", { opacity: 0 }, { shape: "rampDown", end: REVEAL_WIDTH, offset: -REVEAL_WIDTH }, sweep(end - length, end, REVEAL_WIDTH, "easeIn"), seed);
    case "wave":
      return swept("char", { y: px(-font * 0.35, ANIMATOR_NUMBER_RANGES.y) }, { shape: "smooth", end: WAVE_WIDTH, offset: -WAVE_WIDTH }, sweep(0, end, WAVE_WIDTH, "linear"), seed);
    case "colorSweep":
      return swept("char", { fill: PRESET_SWEEP_COLOR }, { shape: "triangle", end: WAVE_WIDTH, offset: -WAVE_WIDTH }, sweep(0, end, WAVE_WIDTH, "linear"), seed);
    case "wiggle":
      return newTextUnitAnimator(
        "char",
        { x: px(font * 0.06, ANIMATOR_NUMBER_RANGES.x), y: px(font * 0.06, ANIMATOR_NUMBER_RANGES.y), rotation: 6 },
        { ...newWigglySelector(seed), rate: 3, correlation: 0 },
      );
  }
}

export function fontPxOf(layer: Layer | undefined, canvasHeight: number): number {
  return (layer?.fontSize ?? 0) * canvasHeight;
}

export const PROPERTY_STARTS: Record<AnimatorNumber, number> & Record<AnimatorColor, string> = {
  x: 20,
  y: 20,
  scale: 0,
  rotation: 30,
  rotationX: FLIP_DEGREES,
  rotationY: FLIP_DEGREES,
  opacity: 0,
  blur: 8,
  tracking: 10,
  fill: PRESET_SWEEP_COLOR,
  stroke: "#000000",
};

export function offeredProperties(animator: TextUnitAnimator, layer: Layer): (AnimatorNumber | AnimatorColor)[] {
  const colors = ANIMATOR_COLORS.filter((name) => paintsProperty(layer, name));
  return [...ANIMATOR_NUMBERS, ...colors].filter((name) => animator.properties[name] === undefined);
}

export function unitsInText(text: string, unit: TextUnit): number {
  if (unit === "line") return text.split("\n").filter((line) => line.trim() !== "").length;
  if (unit === "word") return text.split(/\s+/).filter(Boolean).length;
  return [...text].filter((char) => !/\s/.test(char)).length;
}
