import { fieldValue, lanesIssue, shiftLanes, type AnimatedFields, type Lanes } from "./animated-fields";
import type { Clip } from "./document";
import {
  defaultRepeat,
  inverse,
  IDENTITY_AFFINE,
  multiply,
  REPEAT_MODES,
  REPEAT_RANGES,
  repeatInstances,
  repeatIssue,
  type Affine,
  type Repeat,
  type RepeatBox,
  type RepeatMode,
} from "./repeat";
import type { IssueCode } from "./validate";

export const CLIP_REPEAT_MODES = ["linear", ...REPEAT_MODES] as const;

export type ClipRepeatMode = (typeof CLIP_REPEAT_MODES)[number];

export const REPEAT_ORDERS = ["above", "below"] as const;

export type RepeatOrder = (typeof REPEAT_ORDERS)[number];

export const CLIP_REPEAT_FIELDS = ["copies", "shift", "x", "y", "scale", "rotation", "startOpacity", "endOpacity", "radius", "startAngle", "sweep", "gapX", "gapY", "angle", "gap"] as const;

export type ClipRepeatField = (typeof CLIP_REPEAT_FIELDS)[number];

export interface ClipRepeat extends Omit<Repeat, "mode"> {
  mode: ClipRepeatMode;
  copies?: number;
  shift?: number;
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  startOpacity?: number;
  endOpacity?: number;
  order?: RepeatOrder | "";
  keyframes?: Lanes<ClipRepeatField>;
}

const UNBOUNDED = Number.POSITIVE_INFINITY;

export const CLIP_REPEAT_RANGES: Record<ClipRepeatField, readonly [number, number]> = {
  copies: [1, UNBOUNDED],
  shift: [-10000, 10000],
  x: [-4096, 4096],
  y: [-4096, 4096],
  scale: [0.01, 10],
  rotation: [-3600, 3600],
  startOpacity: [0, 1],
  endOpacity: [0, 1],
  radius: REPEAT_RANGES.radius,
  startAngle: REPEAT_RANGES.startAngle,
  sweep: REPEAT_RANGES.sweep,
  gapX: REPEAT_RANGES.gap,
  gapY: REPEAT_RANGES.gap,
  angle: REPEAT_RANGES.angle,
  gap: REPEAT_RANGES.gap,
};

const LINEAR_FIELDS = ["copies", "shift", "x", "y", "scale", "rotation"] as const;
const COMMON_FIELDS: readonly ClipRepeatField[] = ["startOpacity", "endOpacity"];
const KEYED_BY_MODE: Record<ClipRepeatMode, readonly ClipRepeatField[]> = {
  linear: [...LINEAR_FIELDS, ...COMMON_FIELDS],
  radial: ["radius", "startAngle", "sweep", ...COMMON_FIELDS],
  grid: ["gapX", "gapY", ...COMMON_FIELDS],
  mirror: ["angle", "gap", ...COMMON_FIELDS],
};
const NEUTRAL: Partial<Record<ClipRepeatField, number>> = { copies: 1, scale: 1, startOpacity: 1, endOpacity: 1, sweep: 360 };
const OWN_KEYS = new Set<string>(["mode", "keyframes", "order", "startOpacity", "endOpacity", ...LINEAR_FIELDS]);

export function clipRepeatFields(mode: ClipRepeatMode): readonly ClipRepeatField[] {
  return KEYED_BY_MODE[mode];
}

export const CLIP_REPEAT_SPEC: AnimatedFields<ClipRepeat, ClipRepeatField> = {
  staticValue: (repeat, field) => repeat[field] ?? NEUTRAL[field] ?? 0,
  withStatic: (repeat, field, value) => ({ ...repeat, [field]: field === "copies" ? Math.max(1, Math.round(value)) : value }),
  range: (field) => CLIP_REPEAT_RANGES[field],
};

function holds(value: number | undefined, [low, high]: readonly [number, number]): boolean {
  return value === undefined || (Number.isFinite(value) && value >= low && value <= high);
}

function absent(value: unknown): boolean {
  return value === undefined || value === 0 || value === "" || value === false;
}

function imageRepeat(repeat: ClipRepeat): Repeat {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(repeat)) if (!OWN_KEYS.has(key)) rest[key] = value;
  return { ...rest, mode: repeat.mode as RepeatMode };
}

function linearIssue(repeat: ClipRepeat): IssueCode | null {
  const foreign = Object.entries(imageRepeat(repeat)).some(([key, value]) => key !== "mode" && !absent(value));
  if (foreign) return "invalid";
  if (!Number.isInteger(repeat.copies) || (repeat.copies ?? 0) < 1) return "out_of_range";
  return LINEAR_FIELDS.every((field) => holds(repeat[field], CLIP_REPEAT_RANGES[field])) ? null : "out_of_range";
}

export function clipRepeatIssue(repeat: ClipRepeat): IssueCode | null {
  if (!(CLIP_REPEAT_MODES as readonly string[]).includes(repeat.mode)) return "unknown";
  if ((repeat.order ?? "") !== "" && !(REPEAT_ORDERS as readonly string[]).includes(repeat.order!)) return "unknown";
  if (!holds(repeat.startOpacity, CLIP_REPEAT_RANGES.startOpacity) || !holds(repeat.endOpacity, CLIP_REPEAT_RANGES.endOpacity)) return "out_of_range";
  if (repeat.mode === "linear") {
    const code = linearIssue(repeat);
    if (code) return code;
  } else {
    if (LINEAR_FIELDS.some((field) => repeat[field] !== undefined && repeat[field] !== 0)) return "invalid";
    const code = repeatIssue(imageRepeat(repeat));
    if (code) return code;
  }
  const keyed = KEYED_BY_MODE[repeat.mode];
  return lanesIssue(repeat.keyframes ?? {}, (field) => (keyed.includes(field as ClipRepeatField) ? CLIP_REPEAT_RANGES[field as ClipRepeatField] : null));
}

export function clipRepeatClipIssue(clip: Pick<Clip, "type" | "repeat">): IssueCode | null {
  if (!clip.repeat) return null;
  if (clip.type !== "overlay") return "invalid";
  return clipRepeatIssue(clip.repeat);
}

export function defaultClipRepeat(mode: ClipRepeatMode, box: RepeatBox): ClipRepeat {
  if (mode !== "linear") return defaultRepeat(mode, box);
  return { mode, copies: 3, x: Math.round((box.right - box.left) * 1.2) };
}

export function clipRepeatValue(repeat: ClipRepeat, field: ClipRepeatField, localMs: number): number {
  return fieldValue(CLIP_REPEAT_SPEC, repeat, field, localMs);
}

export function clipRepeatAt(repeat: ClipRepeat, localMs: number): ClipRepeat {
  if (!repeat.keyframes) return repeat;
  const resolved: ClipRepeat = { ...repeat };
  delete resolved.keyframes;
  for (const field of Object.keys(repeat.keyframes) as ClipRepeatField[]) {
    if ((repeat.keyframes[field]?.length ?? 0) > 0) resolved[field] = clipRepeatValue(repeat, field, localMs);
  }
  return resolved;
}

export function splitClipRepeat(repeat: ClipRepeat, atLocalMs: number): ClipRepeat {
  const keyframes = shiftLanes(repeat.keyframes, -atLocalMs);
  return keyframes ? { ...repeat, keyframes } : repeat;
}

interface RepeatCopy {
  index: number;
  place: Affine;
  opacity: number;
}

function stepAffine(repeat: ClipRepeat, share: number, cx: number, cy: number): Affine {
  const angle = (((repeat.rotation ?? 0) * share) * Math.PI) / 180;
  const scale = (repeat.scale ?? 1) ** share;
  const cos = Math.cos(angle) * scale;
  const sin = Math.sin(angle) * scale;
  const tx = (repeat.x ?? 0) * share;
  const ty = (repeat.y ?? 0) * share;
  return { a: cos, b: sin, c: -sin, d: cos, e: cx + tx - (cos * cx - sin * cy), f: cy + ty - (sin * cx + cos * cy) };
}

function power(step: Affine, times: number): Affine {
  const base = times < 0 ? inverse(step) : step;
  let out = IDENTITY_AFFINE;
  for (let i = 0; i < Math.abs(times); i++) out = multiply(base, out);
  return out;
}

function linearPlaces(repeat: ClipRepeat, box: RepeatBox): Affine[] {
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  const step = stepAffine(repeat, 1, cx, cy);
  const shift = repeat.shift ?? 0;
  const whole = Math.floor(shift);
  const start = multiply(power(step, whole), stepAffine(repeat, shift - whole, cx, cy));
  const count = Math.ceil(Math.max(1, repeat.copies ?? 1) - 1e-9);
  const places: Affine[] = [];
  let place = start;
  for (let i = 0; i < count; i++) {
    places.push(place);
    place = multiply(step, place);
  }
  return places;
}

function lastShare(repeat: ClipRepeat): number {
  if (repeat.mode !== "linear") return 1;
  const copies = Math.max(1, repeat.copies ?? 1);
  const part = copies - Math.floor(copies);
  return part > 1e-9 ? part : 1;
}

export function repeatCopies(repeat: ClipRepeat, box: RepeatBox): RepeatCopy[] {
  const places = repeat.mode === "linear" ? linearPlaces(repeat, box) : repeatInstances(imageRepeat(repeat), box);
  const first = repeat.startOpacity ?? 1;
  const last = repeat.endOpacity ?? 1;
  const tail = lastShare(repeat);
  const copies = places.map((place, index) => {
    const t = places.length > 1 ? index / (places.length - 1) : 0;
    const fade = index === places.length - 1 && places.length > 1 ? tail : 1;
    return { index, place, opacity: (first + (last - first) * t) * fade };
  });
  return repeat.order === "below" ? copies.reverse() : copies;
}

export const CLIP_REPEAT_PRESETS = ["trail", "stairs", "spiral", "echo", "ring", "fan", "grid", "mirror"] as const;

export type ClipRepeatPreset = (typeof CLIP_REPEAT_PRESETS)[number];

export function presetClipRepeat(preset: ClipRepeatPreset, box: RepeatBox): ClipRepeat {
  const side = Math.max(1, Math.round(Math.max(box.right - box.left, box.bottom - box.top)));
  switch (preset) {
    case "trail":
      return { mode: "linear", copies: 5, x: Math.round(side * 0.6), startOpacity: 1, endOpacity: 0.1, order: "below" };
    case "stairs":
      return { mode: "linear", copies: 4, x: Math.round(side * 1.1), y: Math.round(side * 0.6) };
    case "spiral":
      return { mode: "linear", copies: 12, x: Math.round(side * 0.5), rotation: 30, scale: 0.92 };
    case "echo":
      return { mode: "linear", copies: 4, scale: 1.18, startOpacity: 1, endOpacity: 0, order: "below" };
    case "ring":
      return defaultClipRepeat("radial", box);
    case "fan":
      return { ...defaultClipRepeat("radial", box), count: 5, sweep: 120, startAngle: -150 };
    case "grid":
      return defaultClipRepeat("grid", box);
    case "mirror":
      return defaultClipRepeat("mirror", box);
  }
}
