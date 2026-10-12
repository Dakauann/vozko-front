import type { Clip } from "./document";
import { effectKeysIssue, effectsAt, effectsKeyed, withoutEffectKeys } from "./effect-keys";
import { effectListIssue, effectReach, strokeListIssue, type Effect, type EffectPlan, type EffectType, type StrokePaint } from "./layer-paint";
import type { IssueCode } from "./validate";

export const MEDIA_EFFECT_TYPES = ["drop-shadow", "outer-glow"] as const satisfies readonly EffectType[];

const SILHOUETTE_OWNER = { type: "image" } as const;
const NO_GRADIENTS = () => false;

type StyledClip = Pick<Clip, "type" | "effects" | "strokes">;

export function takesClipStyle(clip: Pick<Clip, "type">): boolean {
  return clip.type === "video" || clip.type === "image";
}

export function isMediaEffectType(type: EffectType): boolean {
  return (MEDIA_EFFECT_TYPES as readonly EffectType[]).includes(type);
}

export function clipStyled(clip: Pick<Clip, "effects" | "strokes">): boolean {
  return (clip.effects?.length ?? 0) + (clip.strokes?.length ?? 0) > 0;
}

export function clipStyleIssue(clip: StyledClip): IssueCode | null {
  if (!clipStyled(clip)) return null;
  if (!takesClipStyle(clip)) return "invalid";
  const effects = clip.effects ?? [];
  if (effects.some((effect) => !isMediaEffectType(effect.type))) return "invalid";
  return effectListIssue(withoutEffectKeys(effects)) ?? effectKeysIssue(effects) ?? strokeListIssue(clip.strokes ?? [], SILHOUETTE_OWNER, NO_GRADIENTS);
}

export function clipStyleKeyed(clip: Pick<Clip, "effects">): boolean {
  return effectsKeyed(clip.effects);
}

export function clipEffectPlan(clip: Pick<Clip, "effects" | "strokes">, localMs: number): EffectPlan | null {
  const effects = effectsAt((clip.effects ?? []).filter((effect) => !effect.hidden), localMs);
  const outlines = (clip.strokes ?? []).filter((stroke) => !stroke.hidden);
  return effects.length + outlines.length > 0 ? { effects, outlines } : null;
}

export function planReach(plan: EffectPlan): number {
  return Math.max(0, ...plan.outlines.map((stroke: StrokePaint) => stroke.width)) + Math.max(0, ...plan.effects.map((effect: Effect) => effectReach(effect)));
}

export interface ClipHalo {
  plan: EffectPlan;
  live: boolean;
}

export function clipHaloAt(clip: Pick<Clip, "type" | "effects" | "strokes" | "masks">, localMs: number): ClipHalo | undefined {
  if (!takesClipStyle(clip)) return undefined;
  const plan = clipEffectPlan(clip, localMs);
  if (!plan) return undefined;
  return { plan, live: clipStyleKeyed(clip) || (clip.masks ?? []).some((mask) => Object.values(mask.keyframes ?? {}).some((frames) => (frames?.length ?? 0) > 0)) };
}
