import { clampTo, fieldValue, type AnimatedFields, type Lanes } from "./animated-fields";
import { STUDIO_LIMITS } from "./document";
import type { TextUnit } from "./text-animation";
import { hash01 } from "./vfx";

export const SELECTOR_KINDS = ["range", "wiggly"] as const;
export type SelectorKind = (typeof SELECTOR_KINDS)[number];

export const RANGE_ORDERS = ["forward", "backward", "centerOut", "edgesIn", "random"] as const;
export type RangeOrder = (typeof RANGE_ORDERS)[number];

export const RANGE_SHAPES = ["square", "rampUp", "rampDown", "triangle", "round", "smooth"] as const;
export type RangeShape = (typeof RANGE_SHAPES)[number];

export const RANGE_UNITS = ["percent", "index"] as const;
export type RangeUnits = (typeof RANGE_UNITS)[number];

export const ANIMATOR_NUMBERS = ["x", "y", "scale", "rotation", "rotationX", "rotationY", "opacity", "blur", "tracking"] as const;
export type AnimatorNumber = (typeof ANIMATOR_NUMBERS)[number];

export const ANIMATOR_COLORS = ["fill", "stroke"] as const;
export type AnimatorColor = (typeof ANIMATOR_COLORS)[number];

export const ANIMATOR_NUMBER_RANGES: Record<AnimatorNumber, readonly [number, number]> = {
  x: [-4000, 4000],
  y: [-4000, 4000],
  scale: [0, 1000],
  rotation: [-3600, 3600],
  rotationX: [-3600, 3600],
  rotationY: [-3600, 3600],
  opacity: [0, 100],
  blur: [0, 100],
  tracking: [-1000, 1000],
};

export const ANIMATOR_RESTING: Record<AnimatorNumber, number> = { x: 0, y: 0, scale: 100, rotation: 0, rotationX: 0, rotationY: 0, opacity: 100, blur: 0, tracking: 0 };

export type AnimatorProperties = Partial<Record<AnimatorNumber, number>> & Partial<Record<AnimatorColor, string>>;

export function turnsInDepth(properties: AnimatorProperties): boolean {
  return Boolean(properties.rotationX || properties.rotationY);
}

export const RANGE_KEYS = ["start", "end", "offset", "amount"] as const;
export const WIGGLY_KEYS = ["amount"] as const;
export type SelectorKey = (typeof RANGE_KEYS)[number];

export const RANGE_LIMITS = {
  percent: { edge: [0, 100], offset: [-100, 100] },
  index: { edge: [0, 100_000], offset: [-100_000, 100_000] },
  ease: [-100, 100],
  amount: [-100, 100],
} as const;

export const WIGGLY_LIMITS = {
  rate: [0.1, 20],
  loopMs: [100, STUDIO_LIMITS.maxVideoMs],
  correlation: [0, 100],
  amount: [0, 100],
  offsetMs: [0, STUDIO_LIMITS.maxVideoMs],
} as const;

export interface RangeSelector {
  kind: "range";
  units: RangeUnits;
  start: number;
  end: number;
  offset: number;
  order: RangeOrder;
  shape: RangeShape;
  easeHigh: number;
  easeLow: number;
  amount: number;
  seed: number;
}

export interface WigglySelector {
  kind: "wiggly";
  rate: number;
  loopMs: number;
  correlation: number;
  amount: number;
  seed: number;
  offsetMs?: number;
}

export type TextSelector = RangeSelector | WigglySelector;

export interface TextUnitAnimator {
  id: string;
  unit: TextUnit;
  properties: AnimatorProperties;
  selector: TextSelector;
  keyframes?: Lanes<SelectorKey>;
}

export type SelectorFrame = RangeSelector | (Omit<WigglySelector, "offsetMs"> & { timeMs: number });

export interface AnimatorFrame {
  unit: TextUnit;
  properties: AnimatorProperties;
  selector: SelectorFrame;
}

export function selectorKeys(selector: Pick<TextSelector, "kind">): readonly SelectorKey[] {
  return selector.kind === "range" ? RANGE_KEYS : WIGGLY_KEYS;
}

export function selectorKeyRange(selector: TextSelector, key: SelectorKey): readonly [number, number] | null {
  if (!selectorKeys(selector).includes(key)) return null;
  if (selector.kind === "wiggly") return WIGGLY_LIMITS.amount;
  if (key === "amount") return RANGE_LIMITS.amount;
  return key === "offset" ? RANGE_LIMITS[selector.units].offset : RANGE_LIMITS[selector.units].edge;
}

export const SELECTOR_FIELDS: AnimatedFields<TextUnitAnimator, SelectorKey> = {
  staticValue: (animator, key) => (animator.selector as unknown as Record<SelectorKey, number | undefined>)[key] ?? 0,
  withStatic: (animator, key, value) => ({ ...animator, selector: { ...animator.selector, [key]: value } }),
  range: (key, animator) => selectorKeyRange(animator.selector, key) ?? [0, 0],
};

export function selectorValue(animator: TextUnitAnimator, key: SelectorKey, localMs: number): number {
  return fieldValue(SELECTOR_FIELDS, animator, key, localMs);
}

export function animatorFrameAt(animator: TextUnitAnimator, localMs: number): AnimatorFrame {
  const selector = animator.selector;
  if (selector.kind === "wiggly") {
    const { offsetMs, ...rest } = selector;
    return { unit: animator.unit, properties: animator.properties, selector: { ...rest, amount: selectorValue(animator, "amount", localMs), timeMs: localMs + (offsetMs ?? 0) } };
  }
  const values = Object.fromEntries(RANGE_KEYS.map((key) => [key, selectorValue(animator, key, localMs)])) as Record<SelectorKey, number>;
  return { unit: animator.unit, properties: animator.properties, selector: { ...selector, ...values } };
}

const SHAPE_SAMPLES = 16;
const PERCENT = 100;
const CHANNELS = ["x", "y", "scale", "rotation", "opacity", "blur", "tracking", "color", "rotationX", "rotationY"] as const;
const COLOR_CHANNEL = CHANNELS.indexOf("color");
const ORDER_CHANNEL = 0x0dde;
const SHARED_UNIT = 0x5eed;
const WIGGLE_HARMONICS: readonly { step: number; lift: number; weight: number }[] = [
  { step: 1, lift: 0, weight: 1 },
  { step: 2, lift: 1, weight: 0.5 },
  { step: 3, lift: 2, weight: 0.25 },
];
const WIGGLE_WEIGHT = WIGGLE_HARMONICS.reduce((sum, harmonic) => sum + harmonic.weight, 0);

export const SELECTOR_CHANNELS = CHANNELS.length;

export function channelOf(property: AnimatorNumber | AnimatorColor): number {
  const index = (CHANNELS as readonly string[]).indexOf(property);
  return index >= 0 ? index : COLOR_CHANNEL;
}

function fold(low: number, high: number): [number, number] {
  const a = Math.abs(2 * low - 1);
  const b = Math.abs(2 * high - 1);
  if (low < 0.5 && high > 0.5) return [0, Math.max(a, b)];
  return [Math.min(a, b), Math.max(a, b)];
}

export function randomRanks(count: number, seed: number): number[] {
  const order = Array.from({ length: count }, (_, index) => index).sort((a, b) => hash01(seed, ORDER_CHANNEL, a) - hash01(seed, ORDER_CHANNEL, b) || a - b);
  const ranks = new Array<number>(count);
  order.forEach((unit, rank) => (ranks[unit] = rank));
  return ranks;
}

export function unitSpan(order: RangeOrder, index: number, count: number, ranks?: readonly number[]): [number, number] {
  const low = index / count;
  const high = (index + 1) / count;
  switch (order) {
    case "forward":
      return [low, high];
    case "backward":
      return [1 - high, 1 - low];
    case "random": {
      const rank = ranks?.[index] ?? index;
      return [rank / count, (rank + 1) / count];
    }
    case "centerOut":
      return fold(low, high);
    case "edgesIn": {
      const [near, far] = fold(low, high);
      return [1 - far, 1 - near];
    }
  }
}

export function shapeAt(shape: RangeShape, t: number): number {
  const inside = t >= 0 && t <= 1;
  switch (shape) {
    case "square":
      return t >= 0 && t < 1 ? 1 : 0;
    case "rampUp":
      return clampTo(t, [0, 1]);
    case "rampDown":
      return 1 - clampTo(t, [0, 1]);
    case "triangle":
      return inside ? 1 - Math.abs(2 * t - 1) : 0;
    case "round":
      return inside ? Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) : 0;
    case "smooth":
      return inside ? (1 - Math.cos(2 * Math.PI * t)) / 2 : 0;
  }
}

export function easedSelection(value: number, easeHigh: number, easeLow: number): number {
  const out = 1 - easeLow / PERCENT;
  const into = 1 - easeHigh / PERCENT;
  const v2 = value * value;
  const v3 = v2 * value;
  return clampTo((v3 - 2 * v2 + value) * out + (-2 * v3 + 3 * v2) + (v3 - v2) * into, [0, 1]);
}

export function rangeWindow(selector: Pick<RangeSelector, "units" | "start" | "end" | "offset">, count: number): [number, number] {
  const scale = selector.units === "percent" ? PERCENT : Math.max(1, count);
  const shift = selector.offset / scale;
  return [Math.min(selector.start, selector.end) / scale + shift, Math.max(selector.start, selector.end) / scale + shift];
}

function coverage(span: readonly [number, number], window: readonly [number, number]): number {
  const width = span[1] - span[0];
  if (width <= 0) return 0;
  return Math.max(0, Math.min(span[1], window[1]) - Math.max(span[0], window[0])) / width;
}

function sampled(shape: RangeShape, span: readonly [number, number], window: readonly [number, number]): number {
  const width = window[1] - window[0];
  let sum = 0;
  for (let k = 0; k < SHAPE_SAMPLES; k++) {
    const x = span[0] + ((k + 0.5) / SHAPE_SAMPLES) * (span[1] - span[0]);
    const t = width > 0 ? (x - window[0]) / width : x >= window[0] ? Infinity : -Infinity;
    sum += shapeAt(shape, t);
  }
  return sum / SHAPE_SAMPLES;
}

export function rangeAmounts(selector: RangeSelector, count: number): number[] {
  const window = rangeWindow(selector, count);
  const ranks = selector.order === "random" ? randomRanks(count, selector.seed) : undefined;
  return Array.from({ length: count }, (_, index) => {
    const span = unitSpan(selector.order, index, count, ranks);
    const raw = selector.shape === "square" ? coverage(span, window) : sampled(selector.shape, span, window);
    return easedSelection(raw, selector.easeHigh, selector.easeLow) * (selector.amount / PERCENT);
  });
}

export function wiggleHarmonic(rate: number, loopMs: number): number {
  return Math.max(1, Math.round((rate * loopMs) / 1000));
}

export function wigglyAmount(selector: Extract<SelectorFrame, { kind: "wiggly" }>, index: number, channel: number): number {
  const base = wiggleHarmonic(selector.rate, selector.loopMs);
  const spread = 1 - selector.correlation / PERCENT;
  const turn = (selector.timeMs / selector.loopMs) * 2 * Math.PI;
  let sum = 0;
  WIGGLE_HARMONICS.forEach((harmonic, h) => {
    const lane = channel * WIGGLE_HARMONICS.length + h;
    const phase = 2 * Math.PI * (hash01(selector.seed, lane, SHARED_UNIT) + spread * hash01(selector.seed, lane, index));
    sum += harmonic.weight * Math.sin((base * harmonic.step + harmonic.lift) * turn + phase);
  });
  return (sum / WIGGLE_WEIGHT) * (selector.amount / PERCENT);
}

export type SelectorAmounts = (channel: number, index: number) => number;

export function selectorAmounts(selector: SelectorFrame, count: number): SelectorAmounts {
  if (selector.kind === "range") {
    const amounts = rangeAmounts(selector, count);
    return (_, index) => amounts[index] ?? 0;
  }
  const cache = new Map<number, number>();
  return (channel, index) => {
    const key = channel * count + index;
    const known = cache.get(key);
    if (known !== undefined) return known;
    const value = wigglyAmount(selector, index, channel);
    cache.set(key, value);
    return value;
  };
}

export interface OffsetLook {
  dx: number;
  dy: number;
  scale: number;
  rotation: number;
  rotationX: number;
  rotationY: number;
  opacity: number;
  blurPx: number;
  tracking: number;
  tint: number;
}

export function offsetLook(properties: AnimatorProperties, amountOf: (channel: number) => number): OffsetLook {
  const amount = (property: AnimatorNumber) => amountOf(channelOf(property));
  const scaled = (property: AnimatorNumber) => {
    const value = properties[property];
    return value === undefined ? 0 : value * amount(property);
  };
  const blur = properties.blur;
  return {
    dx: scaled("x"),
    dy: scaled("y"),
    scale: properties.scale === undefined ? 1 : Math.max(0, 1 + (properties.scale / PERCENT - 1) * amount("scale")),
    rotation: scaled("rotation"),
    rotationX: scaled("rotationX"),
    rotationY: scaled("rotationY"),
    opacity: properties.opacity === undefined ? 1 : clampTo(1 + (properties.opacity / PERCENT - 1) * amount("opacity"), [0, 1]),
    blurPx: blur === undefined ? 0 : clampTo(blur * amount("blur"), [0, blur]),
    tracking: scaled("tracking"),
    tint: properties.fill !== undefined || properties.stroke !== undefined ? clampTo(amountOf(COLOR_CHANNEL), [0, 1]) : 0,
  };
}
