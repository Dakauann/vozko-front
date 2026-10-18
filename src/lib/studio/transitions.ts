import { produce } from "immer";

import { parseColor } from "./color";
import { newStudioId, type Track, type TrackKind, type VideoDocument } from "./document";
import { isEasing, type Easing } from "./keyframes";
import { GRADIENT_WIPE_MAPS, type GradientWipeMap } from "./reveal-field";

export const TRANSITION_KINDS = ["dissolve", "dipToColor", "push", "slide", "wipe", "iris", "clockWipe", "split", "zoom", "whip", "blurDissolve", "gradientWipe", "venetianBlinds", "blockDissolve", "radialWipe"] as const;
export type VisualTransitionKind = (typeof TRANSITION_KINDS)[number];

export const AUDIO_TRANSITION_KINDS = ["constantPower", "constantGain"] as const;
export type AudioTransitionKind = (typeof AUDIO_TRANSITION_KINDS)[number];

export type TransitionKind = VisualTransitionKind | AudioTransitionKind;

export const TRANSITION_ALIGNMENTS = ["center", "start", "end"] as const;
export type TransitionAlignment = (typeof TRANSITION_ALIGNMENTS)[number];

export const TRANSITION_DIRECTIONS = ["left", "right", "up", "down"] as const;
export type TransitionDirection = (typeof TRANSITION_DIRECTIONS)[number];

export const IRIS_SHAPES = ["circle", "box", "diamond"] as const;
export type IrisShape = (typeof IRIS_SHAPES)[number];

export const SPLIT_ORIENTATIONS = ["horizontal", "vertical"] as const;
export type SplitOrientation = (typeof SPLIT_ORIENTATIONS)[number];

export const SLIDE_MOVES = ["in", "out"] as const;
export type SlideMove = (typeof SLIDE_MOVES)[number];

export interface TransitionOptions {
  direction?: TransitionDirection;
  moving?: SlideMove;
  color?: string;
  angle?: number;
  shape?: IrisShape;
  originX?: number;
  originY?: number;
  clockwise?: boolean;
  orientation?: SplitOrientation;
  reverse?: boolean;
  amount?: number;
  softness?: number;
  size?: number;
  map?: GradientWipeMap;
  mapAssetId?: string;
}

export type TransitionOption = keyof TransitionOptions;

export const SIZE_RANGE = [0.01, 1] as const;

export interface Transition extends TransitionOptions {
  id: string;
  fromClipId: string;
  toClipId: string;
  kind: TransitionKind;
  durationMs: number;
  alignment: TransitionAlignment;
  easing: Easing;
}

export const TRANSITION_DEFAULT_MS = 500;
export const TRANSITION_LIMITS = { minMs: 100, maxMs: 4000 } as const;

interface KindSpec {
  sequential: boolean;
  durationMs: number;
  easing: Easing;
  options: TransitionOptions;
  optional?: readonly TransitionOption[];
}

export const TRANSITION_SPECS: Record<TransitionKind, KindSpec> = {
  dissolve: { sequential: false, durationMs: 500, easing: "linear", options: {} },
  dipToColor: { sequential: true, durationMs: 500, easing: "linear", options: { color: "#000000" } },
  push: { sequential: false, durationMs: 500, easing: "easeInOut", options: { direction: "left" } },
  slide: { sequential: false, durationMs: 500, easing: "easeInOut", options: { direction: "left", moving: "in" } },
  wipe: { sequential: false, durationMs: 500, easing: "linear", options: { angle: 0 } },
  iris: { sequential: false, durationMs: 500, easing: "linear", options: { shape: "circle", originX: 0.5, originY: 0.5, reverse: false } },
  clockWipe: { sequential: false, durationMs: 500, easing: "linear", options: { angle: 0, originX: 0.5, originY: 0.5, clockwise: true } },
  split: { sequential: false, durationMs: 500, easing: "easeInOut", options: { orientation: "vertical", reverse: false } },
  zoom: { sequential: true, durationMs: 400, easing: "easeInOut", options: { originX: 0.5, originY: 0.5, amount: 0.5 } },
  whip: { sequential: true, durationMs: 300, easing: "easeInOut", options: { direction: "left", amount: 0.7 } },
  blurDissolve: { sequential: false, durationMs: 500, easing: "linear", options: { amount: 0.5 } },
  gradientWipe: { sequential: false, durationMs: 800, easing: "linear", options: { map: "linear", angle: 0, originX: 0.5, originY: 0.5, softness: 0.2, reverse: false }, optional: ["mapAssetId"] },
  venetianBlinds: { sequential: false, durationMs: 600, easing: "linear", options: { angle: 0, size: 0.1, softness: 0 } },
  blockDissolve: { sequential: false, durationMs: 600, easing: "linear", options: { size: 0.08, softness: 0 } },
  radialWipe: { sequential: false, durationMs: 600, easing: "linear", options: { angle: 0, originX: 0.5, originY: 0.5, softness: 0 } },
  constantPower: { sequential: false, durationMs: 1000, easing: "linear", options: {} },
  constantGain: { sequential: false, durationMs: 1000, easing: "linear", options: {} },
};

const TRANSITION_OPTIONS: readonly TransitionOption[] = ["direction", "moving", "color", "angle", "shape", "originX", "originY", "clockwise", "orientation", "reverse", "amount", "softness", "size", "map", "mapAssetId"];

const OPTION_RIVALS: Partial<Record<TransitionOption, TransitionOption>> = { map: "mapAssetId", mapAssetId: "map" };

export function isTransitionKind(value: string): value is TransitionKind {
  return (TRANSITION_KINDS as readonly string[]).includes(value) || isAudioTransitionKind(value);
}

export function isAudioTransitionKind(value: string): value is AudioTransitionKind {
  return (AUDIO_TRANSITION_KINDS as readonly string[]).includes(value);
}

export function transitionKindsFor(trackKind: TrackKind): readonly TransitionKind[] {
  return trackKind === "audio" ? AUDIO_TRANSITION_KINDS : TRANSITION_KINDS;
}

export function trackKindOf(kind: TransitionKind): TrackKind {
  return isAudioTransitionKind(kind) ? "audio" : "visual";
}

export function defaultTransitionKind(trackKind: TrackKind): TransitionKind {
  return transitionKindsFor(trackKind)[0];
}

function kindFits(kind: TransitionKind, trackKind: TrackKind): boolean {
  return transitionKindsFor(trackKind).includes(kind);
}

export function optionsOf(kind: TransitionKind): readonly TransitionOption[] {
  const spec = TRANSITION_SPECS[kind];
  return [...(Object.keys(spec.options) as TransitionOption[]), ...(spec.optional ?? [])];
}

export type TransitionShape = Pick<Transition, "kind" | "easing"> & TransitionOptions;

export function optionValue<K extends TransitionOption>(transition: Pick<Transition, "kind"> & TransitionOptions, option: K): NonNullable<TransitionOptions[K]> {
  return (transition[option] ?? TRANSITION_SPECS[transition.kind].options[option]) as NonNullable<TransitionOptions[K]>;
}

const MAP_OPTIONS: Record<GradientWipeMap, readonly TransitionOption[]> = { linear: ["angle"], radial: ["originX", "originY"], diamond: ["originX", "originY"], clouds: [] };

export function visibleOptions(transition: Pick<Transition, "kind"> & TransitionOptions, allowed: readonly TransitionOption[] = optionsOf(transition.kind)): TransitionOption[] {
  if (transition.kind !== "gradientWipe") return [...allowed];
  const own: readonly TransitionOption[] = transition.mapAssetId ? ["mapAssetId"] : ["map", ...MAP_OPTIONS[optionValue(transition, "map")]];
  return [...own, "softness", "reverse"].filter((option) => allowed.includes(option as TransitionOption)) as TransitionOption[];
}

export function shownOptions(transition: Pick<Transition, "kind"> & TransitionOptions, allowed: readonly TransitionOption[] = optionsOf(transition.kind)): TransitionOptions {
  const shown: TransitionOptions = {};
  for (const option of visibleOptions(transition, allowed)) {
    const value = transition[option] ?? TRANSITION_SPECS[transition.kind].options[option];
    if (value !== undefined) Object.assign(shown, { [option]: value });
  }
  return shown;
}

export function optionsFault(values: TransitionOptions, allowed: readonly TransitionOption[]): boolean {
  for (const option of TRANSITION_OPTIONS) {
    const value = values[option];
    if (value === undefined) continue;
    if (!allowed.includes(option) || !optionValid(option, value)) return true;
    const rival = OPTION_RIVALS[option];
    if (rival && values[rival] !== undefined) return true;
  }
  return false;
}

export function pickOptions(source: TransitionOptions): TransitionOptions {
  const picked: TransitionOptions = {};
  for (const option of TRANSITION_OPTIONS) if (source[option] !== undefined) Object.assign(picked, { [option]: source[option] });
  return picked;
}

export function mergeOptions(kept: TransitionOptions, patch: TransitionOptions): TransitionOptions {
  const merged: TransitionOptions = { ...kept };
  for (const option of TRANSITION_OPTIONS) {
    if (patch[option] === undefined) continue;
    Object.assign(merged, { [option]: patch[option] });
    const rival = OPTION_RIVALS[option];
    if (rival) delete merged[rival];
  }
  return merged;
}

export function resolvedOptions(kind: TransitionKind, values: TransitionOptions, allowed: readonly TransitionOption[] = optionsOf(kind)): TransitionOptions | "option" {
  const chosen = pickOptions(values);
  if (optionsFault(chosen, allowed)) return "option";
  const defaults = pickOptions(TRANSITION_SPECS[kind].options);
  for (const option of TRANSITION_OPTIONS) {
    const rival = OPTION_RIVALS[option];
    if (!allowed.includes(option) || (rival && chosen[rival] !== undefined)) delete defaults[option];
  }
  return { ...defaults, ...chosen };
}

function within(value: number, low: number, high: number): boolean {
  return Number.isFinite(value) && value >= low && value <= high;
}

function optionValid(option: TransitionOption, value: unknown): boolean {
  switch (option) {
    case "direction":
      return (TRANSITION_DIRECTIONS as readonly unknown[]).includes(value);
    case "moving":
      return (SLIDE_MOVES as readonly unknown[]).includes(value);
    case "color":
      return typeof value === "string" && value.length === 7 && parseColor(value) !== null;
    case "angle":
      return typeof value === "number" && within(value, 0, 359);
    case "shape":
      return (IRIS_SHAPES as readonly unknown[]).includes(value);
    case "originX":
    case "originY":
    case "amount":
      return typeof value === "number" && within(value, 0, 1);
    case "orientation":
      return (SPLIT_ORIENTATIONS as readonly unknown[]).includes(value);
    case "clockwise":
    case "reverse":
      return typeof value === "boolean";
    case "softness":
      return typeof value === "number" && within(value, 0, 1);
    case "size":
      return typeof value === "number" && within(value, SIZE_RANGE[0], SIZE_RANGE[1]);
    case "map":
      return (GRADIENT_WIPE_MAPS as readonly unknown[]).includes(value);
    case "mapAssetId":
      return typeof value === "string" && value.trim() !== "";
  }
}

interface TransitionWindow {
  startMs: number;
  endMs: number;
  cutMs: number;
}

function leadTrail(durationMs: number, alignment: TransitionAlignment): { lead: number; trail: number } {
  if (alignment === "start") return { lead: 0, trail: durationMs };
  if (alignment === "end") return { lead: durationMs, trail: 0 };
  const lead = Math.floor(durationMs / 2);
  return { lead, trail: durationMs - lead };
}

export function transitionWindow(transition: Transition, track: Track): TransitionWindow | null {
  const from = track.clips.find((c) => c.id === transition.fromClipId);
  if (!from) return null;
  const cutMs = from.startMs + from.durationMs;
  const { lead, trail } = leadTrail(transition.durationMs, transition.alignment);
  return { startMs: cutMs - lead, endMs: cutMs + trail, cutMs };
}

interface Cut {
  fromClipId: string;
  toClipId: string;
  atMs: number;
}

export function cutsOf(track: Track): Cut[] {
  const clips = [...track.clips].sort((a, b) => a.startMs - b.startMs);
  return clips.slice(1).flatMap((to, i) => {
    const from = clips[i];
    return from.startMs + from.durationMs === to.startMs ? [{ fromClipId: from.id, toClipId: to.id, atMs: to.startMs }] : [];
  });
}

function capMs(transition: Pick<Transition, "alignment">, fromMs: number, toMs: number): number {
  if (transition.alignment === "start") return Math.floor(toMs / 2);
  if (transition.alignment === "end") return Math.floor(fromMs / 2);
  return 2 * Math.min(Math.floor(fromMs / 2), Math.floor(toMs / 2));
}

export type TransitionIssue = "apart" | "kind" | "duration" | "alignment" | "easing" | "option" | "covered";

export function transitionIssue(transition: Transition, track: Track): TransitionIssue | null {
  if (!isTransitionKind(transition.kind) || !kindFits(transition.kind, track.kind)) return "kind";
  const cut = cutsOf(track).find((c) => c.fromClipId === transition.fromClipId && c.toClipId === transition.toClipId);
  if (!cut) return "apart";
  if (!Number.isInteger(transition.durationMs) || !within(transition.durationMs, TRANSITION_LIMITS.minMs, TRANSITION_LIMITS.maxMs)) return "duration";
  if (!(TRANSITION_ALIGNMENTS as readonly string[]).includes(transition.alignment)) return "alignment";
  if (TRANSITION_SPECS[transition.kind].sequential && transition.alignment !== "center") return "alignment";
  if (!isEasing(transition.easing) || transition.easing === "hold") return "easing";
  if (optionsFault(transition, optionsOf(transition.kind))) return "option";
  const from = track.clips.find((c) => c.id === transition.fromClipId)!;
  const to = track.clips.find((c) => c.id === transition.toClipId)!;
  if (from.transitionOut || to.transitionIn) return "covered";
  return transition.durationMs > capMs(transition, from.durationMs, to.durationMs) ? "duration" : null;
}

export function transitionsIssue(track: Track): TransitionIssue | null {
  const transitions = track.transitions ?? [];
  const cuts = new Set<string>();
  for (const transition of transitions) {
    const key = `${transition.fromClipId}>${transition.toClipId}`;
    if (cuts.has(key)) return "apart";
    cuts.add(key);
    const issue = transitionIssue(transition, track);
    if (issue) return issue;
  }
  return null;
}

export function settleTransitions(track: Track): Transition[] | undefined {
  const cuts = cutsOf(track);
  const settled = (track.transitions ?? []).flatMap((transition) => {
    if (!cuts.some((c) => c.fromClipId === transition.fromClipId && c.toClipId === transition.toClipId)) return [];
    const from = track.clips.find((c) => c.id === transition.fromClipId)!;
    const to = track.clips.find((c) => c.id === transition.toClipId)!;
    const durationMs = Math.min(transition.durationMs, capMs(transition, from.durationMs, to.durationMs));
    if (durationMs < TRANSITION_LIMITS.minMs) return [];
    return [durationMs === transition.durationMs ? transition : { ...transition, durationMs }];
  });
  return settled.length > 0 ? settled : undefined;
}

export type TransitionRefusal = TransitionIssue | "missing" | "locked";

export type TransitionEdit = { ok: true; document: VideoDocument; transitionId: string } | { ok: false; reason: TransitionRefusal };

export interface TransitionInput extends TransitionOptions {
  fromClipId: string;
  toClipId: string;
  kind: TransitionKind;
  durationMs?: number;
  alignment?: TransitionAlignment;
  easing?: Easing;
}

export type TransitionPatch = Partial<Omit<Transition, "id" | "fromClipId" | "toClipId">>;

function trackWithClip(doc: VideoDocument, clipId: string): Track | undefined {
  return doc.tracks.find((track) => track.clips.some((c) => c.id === clipId));
}

function placed(doc: VideoDocument, track: Track, transition: Transition): TransitionEdit {
  const from = track.clips.find((c) => c.id === transition.fromClipId);
  const to = track.clips.find((c) => c.id === transition.toClipId);
  if (!from || !to) return { ok: false, reason: "missing" };
  const fitted = { ...transition, durationMs: Math.min(transition.durationMs, capMs(transition, from.durationMs, to.durationMs)) };
  const uncovered = { ...track, clips: track.clips.map((c) => (c.id === from.id ? { ...c, transitionOut: undefined } : c.id === to.id ? { ...c, transitionIn: undefined } : c)) };
  const issue = transitionIssue(fitted, uncovered);
  if (issue) return { ok: false, reason: issue };
  const document = produce(doc, (draft) => {
    const target = draft.tracks.find((t) => t.id === track.id)!;
    const others = (target.transitions ?? []).filter((t) => t.id !== fitted.id && !(t.fromClipId === fitted.fromClipId && t.toClipId === fitted.toClipId));
    target.transitions = [...others, fitted];
    for (const clip of target.clips) {
      if (clip.id === fitted.fromClipId) {
        clip.fadeOutMs = 0;
        delete clip.transitionOut;
      }
      if (clip.id === fitted.toClipId) {
        clip.fadeInMs = 0;
        delete clip.transitionIn;
      }
    }
  });
  return { ok: true, document, transitionId: fitted.id };
}

export function addTransition(doc: VideoDocument, input: TransitionInput): TransitionEdit {
  if (!isTransitionKind(input.kind)) return { ok: false, reason: "kind" };
  const track = trackWithClip(doc, input.fromClipId);
  if (!track || !track.clips.some((c) => c.id === input.toClipId)) return { ok: false, reason: trackWithClip(doc, input.toClipId) && track ? "apart" : "missing" };
  if (track.locked) return { ok: false, reason: "locked" };
  if (!kindFits(input.kind, track.kind)) return { ok: false, reason: "kind" };
  const spec = TRANSITION_SPECS[input.kind];
  const options = resolvedOptions(input.kind, input);
  if (typeof options === "string") return { ok: false, reason: options };
  const existing = (track.transitions ?? []).find((t) => t.fromClipId === input.fromClipId && t.toClipId === input.toClipId);
  const transition: Transition = {
    id: existing?.id ?? newStudioId("tr"),
    fromClipId: input.fromClipId,
    toClipId: input.toClipId,
    kind: input.kind,
    durationMs: Math.round(input.durationMs ?? spec.durationMs),
    alignment: input.alignment ?? "center",
    easing: input.easing ?? spec.easing,
    ...options,
  };
  if (transition.durationMs < TRANSITION_LIMITS.minMs || transition.durationMs > TRANSITION_LIMITS.maxMs) return { ok: false, reason: "duration" };
  return placed(doc, track, transition);
}

export function findTransition(doc: VideoDocument, transitionId: string): { track: Track; transition: Transition } | null {
  for (const track of doc.tracks) {
    const transition = (track.transitions ?? []).find((t) => t.id === transitionId);
    if (transition) return { track, transition };
  }
  return null;
}

export function updateTransition(doc: VideoDocument, transitionId: string, patch: TransitionPatch): TransitionEdit {
  const found = findTransition(doc, transitionId);
  if (!found) return { ok: false, reason: "missing" };
  if (found.track.locked) return { ok: false, reason: "locked" };
  const kind = patch.kind ?? found.transition.kind;
  if (!isTransitionKind(kind) || !kindFits(kind, found.track.kind)) return { ok: false, reason: "kind" };
  const kept: TransitionOptions = kind === found.transition.kind ? pickOptions(found.transition) : {};
  const options = resolvedOptions(kind, mergeOptions(kept, pickOptions(patch)));
  if (typeof options === "string") return { ok: false, reason: options };
  const spec = TRANSITION_SPECS[kind];
  const transition: Transition = {
    id: found.transition.id,
    fromClipId: found.transition.fromClipId,
    toClipId: found.transition.toClipId,
    kind,
    durationMs: Math.round(patch.durationMs ?? found.transition.durationMs),
    alignment: patch.alignment ?? (spec.sequential ? "center" : found.transition.alignment),
    easing: patch.easing ?? (kind === found.transition.kind ? found.transition.easing : spec.easing),
    ...options,
  };
  if (transition.durationMs < TRANSITION_LIMITS.minMs || transition.durationMs > TRANSITION_LIMITS.maxMs) return { ok: false, reason: "duration" };
  return placed(doc, found.track, transition);
}

export function removeTransition(doc: VideoDocument, transitionId: string): TransitionEdit {
  const found = findTransition(doc, transitionId);
  if (!found) return { ok: false, reason: "missing" };
  if (found.track.locked) return { ok: false, reason: "locked" };
  const document = produce(doc, (draft) => {
    const target = draft.tracks.find((t) => t.id === found.track.id)!;
    const rest = (target.transitions ?? []).filter((t) => t.id !== transitionId);
    if (rest.length > 0) target.transitions = rest;
    else delete target.transitions;
  });
  return { ok: true, document, transitionId };
}

export function targetCut(doc: VideoDocument, selection: readonly string[], playheadMs: number, trackKind: TrackKind): Cut | null {
  const cuts = doc.tracks.filter((track) => track.kind === trackKind).flatMap(cutsOf);
  const selected = new Set(selection);
  const between = cuts.find((cut) => selected.has(cut.fromClipId) && selected.has(cut.toClipId));
  if (between) return between;
  const own = selection.length === 1 ? (cuts.find((cut) => cut.fromClipId === selection[0]) ?? cuts.find((cut) => cut.toClipId === selection[0])) : undefined;
  if (own) return own;
  return cuts.reduce<Cut | null>((best, cut) => (!best || Math.abs(cut.atMs - playheadMs) < Math.abs(best.atMs - playheadMs) ? cut : best), null);
}
