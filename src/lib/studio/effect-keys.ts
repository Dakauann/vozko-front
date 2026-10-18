import { editFieldValue, fieldKeyState, fieldValue, lanesIssue, setFieldLane, shiftLanes, toggleFieldKey, type AnimatedFields } from "./animated-fields";
import type { KeyState } from "./keyframe-edit";
import type { Keyframe } from "./keyframes";
import { EFFECT_RANGES, type Effect } from "./layer-paint";
import type { IssueCode } from "./validate";

export const EFFECT_PROPERTIES = ["opacity", "x", "y", "blur", "spread"] as const;

export type EffectProperty = (typeof EFFECT_PROPERTIES)[number];

export function isEffectProperty(value: string): value is EffectProperty {
  return (EFFECT_PROPERTIES as readonly string[]).includes(value);
}

export function effectRange(property: EffectProperty): readonly [number, number] {
  if (property === "x" || property === "y") return EFFECT_RANGES.offset;
  return EFFECT_RANGES[property];
}

const EFFECT_FIELDS: AnimatedFields<Effect, EffectProperty> = {
  staticValue: (effect, property) => effect[property],
  withStatic: (effect, property, value) => ({ ...effect, [property]: value }),
  range: (property) => effectRange(property),
};

function effectValue(effect: Effect, property: EffectProperty, localMs: number): number {
  return fieldValue(EFFECT_FIELDS, effect, property, localMs);
}

export function effectAt(effect: Effect, localMs: number): Effect {
  if (!effect.keyframes) return effect;
  const resolved: Effect = { ...effect };
  delete resolved.keyframes;
  for (const property of EFFECT_PROPERTIES) if (effect.keyframes[property]?.length) resolved[property] = effectValue(effect, property, localMs);
  return resolved;
}

export function effectsKeyed(effects: readonly Effect[] | undefined): boolean {
  return (effects ?? []).some((effect) => EFFECT_PROPERTIES.some((property) => (effect.keyframes?.[property]?.length ?? 0) > 0));
}

export function effectsAt(effects: readonly Effect[], localMs: number): Effect[] {
  return effects.map((effect) => effectAt(effect, localMs));
}

export function withoutEffectKeys(effects: readonly Effect[]): Effect[] {
  return effects.map((effect) => {
    if (!effect.keyframes) return effect;
    const plain = { ...effect };
    delete plain.keyframes;
    return plain;
  });
}

export function setEffectLane(effect: Effect, property: EffectProperty, frames: readonly Keyframe[]): Effect {
  return setFieldLane(EFFECT_FIELDS, effect, property, frames);
}

export function toggleEffectKey(effect: Effect, property: EffectProperty, atMs: number): Effect {
  return toggleFieldKey(EFFECT_FIELDS, effect, property, atMs);
}

export function effectKeyState(effect: Effect, property: EffectProperty, localMs: number | null): KeyState {
  return fieldKeyState(effect, property, localMs);
}

export function editEffectValue(effect: Effect, property: EffectProperty, value: number, localMs: number | null): Effect | null {
  return editFieldValue(EFFECT_FIELDS, effect, property, value, localMs);
}

export function shiftEffectKeys(effects: readonly Effect[], deltaMs: number): Effect[] {
  return effects.map((effect) => (effect.keyframes ? { ...effect, keyframes: shiftLanes(effect.keyframes, deltaMs) } : effect));
}

export function effectKeysIssue(effects: readonly Effect[] | undefined): IssueCode | null {
  for (const effect of effects ?? []) {
    const issue = lanesIssue(effect.keyframes ?? {}, (property) => (isEffectProperty(property) ? effectRange(property) : null));
    if (issue) return issue;
  }
  return null;
}

export function editedEffect(stored: Effect, shown: Effect, next: Effect, localMs: number | null): Effect | null {
  let result: Effect = { ...next, ...(stored.keyframes ? { keyframes: stored.keyframes } : {}) };
  for (const property of EFFECT_PROPERTIES) {
    result[property] = stored[property];
    if (next[property] === shown[property]) continue;
    const edited = editEffectValue(result, property, next[property], localMs);
    if (!edited) return null;
    result = edited;
  }
  if (!result.keyframes) delete result.keyframes;
  return result;
}

export function shownEffect(effect: Effect, localMs: number): Effect {
  return effect.keyframes ? { ...effectAt(effect, localMs), keyframes: effect.keyframes } : effect;
}
