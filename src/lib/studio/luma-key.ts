import { editFieldValue, fieldKeyState, fieldValue, lanesIssue, setFieldLane, type AnimatedFields, type Lanes } from "./animated-fields";
import type { KeyState } from "./keyframe-edit";
import type { Keyframe } from "./keyframes";
import type { IssueCode } from "./validate";

export const LUMA_KEY_MODES = ["dark", "light"] as const;
export type LumaKeyMode = (typeof LUMA_KEY_MODES)[number];

export const LUMA_PROPERTIES = ["threshold", "softness"] as const;
export type LumaProperty = (typeof LUMA_PROPERTIES)[number];

export interface LumaKey {
  mode: LumaKeyMode;
  threshold: number;
  softness: number;
  keyframes?: Lanes<LumaProperty>;
}

export const LUMA_RANGES: Record<LumaProperty, readonly [number, number]> = {
  threshold: [0, 1],
  softness: [0.001, 1],
};

export const LUMA_DEFAULTS = { threshold: 0.1, softness: 0.1 } as const;

const LUMA = [0.2126, 0.7152, 0.0722] as const;

export type Rgb = readonly [number, number, number];

export function isLumaKeyMode(value: unknown): value is LumaKeyMode {
  return (LUMA_KEY_MODES as readonly unknown[]).includes(value);
}

export function newLumaKey(mode: LumaKeyMode = "dark"): LumaKey {
  return { mode, ...LUMA_DEFAULTS };
}

export const LUMA_FIELDS: AnimatedFields<LumaKey, LumaProperty> = {
  staticValue: (key, property) => key[property],
  withStatic: (key, property, value) => ({ ...key, [property]: value }),
  range: (property) => LUMA_RANGES[property],
};

export function lumaValue(key: LumaKey, property: LumaProperty, localMs: number): number {
  return fieldValue(LUMA_FIELDS, key, property, localMs);
}

export function lumaAt(key: LumaKey, localMs: number): LumaKey {
  if (!key.keyframes) return key;
  return { mode: key.mode, threshold: lumaValue(key, "threshold", localMs), softness: lumaValue(key, "softness", localMs) };
}

export function setLumaLane(key: LumaKey, property: LumaProperty, frames: readonly Keyframe[]): LumaKey {
  return setFieldLane(LUMA_FIELDS, key, property, frames);
}

export function lumaKeyState(key: LumaKey, property: LumaProperty, localMs: number | null): KeyState {
  return fieldKeyState(key, property, localMs);
}

export function editLumaValue(key: LumaKey, property: LumaProperty, value: number, localMs: number | null): LumaKey | null {
  return editFieldValue(LUMA_FIELDS, key, property, value, localMs);
}

function within(value: number, [low, high]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= low && value <= high;
}

export function lumaIssue(key: LumaKey): IssueCode | null {
  if (!isLumaKeyMode(key.mode)) return "unknown";
  for (const property of LUMA_PROPERTIES) if (!within(key[property], LUMA_RANGES[property])) return "out_of_range";
  return lanesIssue(key.keyframes ?? {}, (property) => LUMA_RANGES[property as LumaProperty] ?? null);
}

export function lumaOf(rgb: Rgb): number {
  return rgb[0] * LUMA[0] + rgb[1] * LUMA[1] + rgb[2] * LUMA[2];
}

export function lumaAlpha(key: LumaKey, rgb: Rgb): number {
  const luma = lumaOf(rgb);
  const distance = key.mode === "dark" ? luma : 1 - luma;
  return Math.min(1, Math.max(0, (distance - key.threshold) / key.softness));
}
