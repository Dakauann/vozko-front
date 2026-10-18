import type { Clip, Track } from "./document";
import { isEasing, type Easing } from "./keyframes";
import { motionPresetPatch, presetOf, type MotionPreset, type MotionSide } from "./motion";
import type { ClipPatch } from "./timeline";
import {
  mergeOptions,
  optionsFault,
  optionsOf,
  pickOptions,
  resolvedOptions,
  TRANSITION_KINDS,
  TRANSITION_LIMITS,
  TRANSITION_SPECS,
  type Transition,
  type TransitionIssue,
  type TransitionOption,
  type TransitionOptions,
  type VisualTransitionKind,
} from "./transitions";

export type EdgeTransitionKind = Exclude<VisualTransitionKind, "dissolve">;

export const EDGE_TRANSITION_KINDS = TRANSITION_KINDS.filter((kind): kind is EdgeTransitionKind => kind !== "dissolve");

export interface ClipTransition extends TransitionOptions {
  kind: EdgeTransitionKind;
  durationMs: number;
  easing: Easing;
}

interface EdgeTransitionInput extends TransitionOptions {
  kind: EdgeTransitionKind;
  durationMs?: number;
  easing?: Easing;
}

export type EdgeChoice = MotionPreset | EdgeTransitionKind;

export type EdgeIssue = Extract<TransitionIssue, "kind" | "duration" | "easing" | "option">;

const EDGE_KEYS = { in: { transition: "transitionIn", fade: "fadeInMs", motion: "motionIn" }, out: { transition: "transitionOut", fade: "fadeOutMs", motion: "motionOut" } } as const;

export function isEdgeTransitionKind(value: string): value is EdgeTransitionKind {
  return (EDGE_TRANSITION_KINDS as readonly string[]).includes(value);
}

export function edgeOptionsOf(kind: EdgeTransitionKind): readonly TransitionOption[] {
  return optionsOf(kind).filter((option) => option !== "moving");
}

function durationFits(durationMs: number): boolean {
  return Number.isInteger(durationMs) && durationMs >= TRANSITION_LIMITS.minMs && durationMs <= TRANSITION_LIMITS.maxMs;
}

function clipTransitionIssue(transition: ClipTransition): EdgeIssue | null {
  if (!isEdgeTransitionKind(transition.kind)) return "kind";
  if (!durationFits(transition.durationMs)) return "duration";
  if (!isEasing(transition.easing) || transition.easing === "hold") return "easing";
  return optionsFault(transition, edgeOptionsOf(transition.kind)) ? "option" : null;
}

export function edgeTransitionOf(clip: Pick<Clip, "transitionIn" | "transitionOut">, side: MotionSide): ClipTransition | undefined {
  return side === "in" ? clip.transitionIn : clip.transitionOut;
}

export function edgeLengthMs(clip: Pick<Clip, "transitionIn" | "transitionOut" | "fadeInMs" | "fadeOutMs" | "motionIn" | "motionOut">, side: MotionSide): number {
  const keys = EDGE_KEYS[side];
  const transition = clip[keys.transition];
  return transition ? transition.durationMs : Math.max(clip[keys.fade], clip[keys.motion]?.durationMs ?? 0);
}

export function edgeTransitionsIssue(clip: Clip): TransitionIssue | null {
  if (!clip.transitionIn && !clip.transitionOut) return null;
  for (const side of ["in", "out"] as const) {
    const keys = EDGE_KEYS[side];
    const transition = clip[keys.transition];
    if (!transition) continue;
    const issue = clipTransitionIssue(transition);
    if (issue) return issue;
    if (clip[keys.fade] > 0 || clip[keys.motion]) return "covered";
  }
  return edgeLengthMs(clip, "in") + edgeLengthMs(clip, "out") > clip.durationMs ? "duration" : null;
}

export function edgeTransition(input: EdgeTransitionInput, current?: ClipTransition): ClipTransition | EdgeIssue {
  if (!isEdgeTransitionKind(input.kind)) return "kind";
  const same = current?.kind === input.kind;
  const options = resolvedOptions(input.kind, mergeOptions(same && current ? pickOptions(current) : {}, pickOptions(input)), edgeOptionsOf(input.kind));
  if (options === "option") return "option";
  const spec = TRANSITION_SPECS[input.kind];
  const durationMs = Math.round(input.durationMs ?? current?.durationMs ?? spec.durationMs);
  if (!durationFits(durationMs)) return "duration";
  const easing = input.easing ?? (same && current ? current.easing : spec.easing);
  if (!isEasing(easing) || easing === "hold") return "easing";
  return { kind: input.kind, durationMs, easing, ...options };
}

export function edgeTransitionPatch(side: MotionSide, transition: ClipTransition | undefined): ClipPatch {
  const keys = EDGE_KEYS[side];
  return transition ? { [keys.transition]: transition, [keys.fade]: 0, [keys.motion]: undefined } : { [keys.transition]: undefined };
}

export function fadePatch(side: MotionSide, fadeMs: number): ClipPatch {
  const keys = EDGE_KEYS[side];
  const ms = Math.max(0, Math.round(fadeMs));
  return ms > 0 ? { [keys.fade]: ms, [keys.transition]: undefined } : { [keys.fade]: ms };
}

export function edgeChoiceOf(clip: Clip, side: MotionSide): EdgeChoice | "custom" {
  return edgeTransitionOf(clip, side)?.kind ?? presetOf(clip, side);
}

export function edgeChoicePatch(clip: Clip, side: MotionSide, choice: EdgeChoice, durationMs: number): ClipPatch | EdgeIssue {
  if (!isEdgeTransitionKind(choice)) return motionPresetPatch(side, choice, durationMs);
  const transition = edgeTransition({ kind: choice, durationMs: Math.round(durationMs) }, edgeTransitionOf(clip, side));
  return typeof transition === "string" ? transition : edgeTransitionPatch(side, transition);
}

export function coveringTransition(track: Track, clipId: string, side: MotionSide): Transition | undefined {
  return (track.transitions ?? []).find((transition) => (side === "in" ? transition.toClipId : transition.fromClipId) === clipId);
}

interface EdgePart {
  transition: ClipTransition;
  side: MotionSide;
  t: number;
}

export function edgePartAt(clip: Pick<Clip, "durationMs" | "transitionIn" | "transitionOut">, localMs: number): EdgePart | null {
  const entering = clip.transitionIn;
  if (entering && localMs < entering.durationMs) return { transition: entering, side: "in", t: Math.max(0, localMs) / entering.durationMs };
  const leaving = clip.transitionOut;
  const startsAt = leaving ? clip.durationMs - leaving.durationMs : 0;
  if (leaving && localMs >= startsAt) return { transition: leaving, side: "out", t: Math.min(1, (localMs - startsAt) / leaving.durationMs) };
  return null;
}

export function fittedEdges(clip: Clip): Pick<Clip, "transitionIn" | "transitionOut"> {
  const fitted: Pick<Clip, "transitionIn" | "transitionOut"> = {};
  let shaped: Clip = clip;
  for (const side of ["in", "out"] as const) {
    const key = EDGE_KEYS[side].transition;
    const transition = clip[key];
    if (!transition) continue;
    const room = clip.durationMs - edgeLengthMs(shaped, side === "in" ? "out" : "in");
    const durationMs = Math.min(transition.durationMs, room);
    if (durationMs < TRANSITION_LIMITS.minMs) {
      shaped = { ...shaped, [key]: undefined };
      continue;
    }
    const kept = durationMs === transition.durationMs ? transition : { ...transition, durationMs };
    fitted[key] = kept;
    shaped = { ...shaped, [key]: kept };
  }
  return fitted;
}
