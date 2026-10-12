import { SILENT_DB } from "./audio-meter";
import { STUDIO_LIMITS, type Clip, type ClipType, type VideoDocument } from "./document";
import { easeSlope, KEYFRAME_RANGES, PLACEMENT_PROPERTIES, valueAt, type Keyframe, type KeyframeProperty, type LaneValue } from "./keyframes";
import { isValidToken } from "./tokens";
import type { IssueCode } from "./validate";
import { layeredNoise } from "./vfx";
import { withHeardVfx } from "./vfx-tracks";

export const BEHAVIOR_KINDS = ["wiggle", "loop", "drift", "overshoot", "audioReact"] as const;

export type BehaviorKind = (typeof BEHAVIOR_KINDS)[number];

export const BEHAVIOR_PROPERTIES = ["x", "y", "scale", "scaleX", "scaleY", "rotation", "opacity", "blur"] as const;

export type BehaviorProperty = (typeof BEHAVIOR_PROPERTIES)[number];

export const LOOP_MODES = ["cycle", "pingpong", "offset", "continue"] as const;

export type LoopMode = (typeof LOOP_MODES)[number];

export const LOOP_SIDES = ["out", "in", "both"] as const;

export type LoopSide = (typeof LOOP_SIDES)[number];

export const BEHAVIOR_LIMITS = {
  frequency: [0.1, 30],
  amplitude: [0, 1],
  decay: [0.1, 30],
  db: [-70, 0],
  seed: [0, 999_999],
} as const;

export const BEHAVIOR_SPANS = Object.fromEntries(BEHAVIOR_PROPERTIES.map((property) => [property, KEYFRAME_RANGES[property][1] - KEYFRAME_RANGES[property][0]])) as Record<BehaviorProperty, number>;

const BEHAVING_TYPES: ReadonlySet<ClipType> = new Set(["video", "image", "overlay", "null"]);

const NULL_PROPERTIES: readonly BehaviorProperty[] = BEHAVIOR_PROPERTIES.filter((property) => PLACEMENT_PROPERTIES.includes(property));

interface BehaviorCommon {
  id: string;
  property: BehaviorProperty;
  offsetMs?: number;
}

export interface WiggleBehavior extends BehaviorCommon {
  kind: "wiggle";
  frequency: number;
  amount: number;
  seed: number;
}

export interface LoopBehavior extends BehaviorCommon {
  kind: "loop";
  mode: LoopMode;
  side: LoopSide;
}

export interface DriftBehavior extends BehaviorCommon {
  kind: "drift";
  rate: number;
}

export interface OvershootBehavior extends BehaviorCommon {
  kind: "overshoot";
  amplitude: number;
  frequency: number;
  decay: number;
}

export interface AudioReactBehavior extends BehaviorCommon {
  kind: "audioReact";
  trackId: string;
  amount: number;
  floorDb: number;
  ceilingDb: number;
}

export type Behavior = WiggleBehavior | LoopBehavior | DriftBehavior | OvershootBehavior | AudioReactBehavior;

export const BEHAVIOR_FIELDS: Record<BehaviorKind, readonly string[]> = {
  wiggle: ["frequency", "amount", "seed"],
  loop: ["mode", "side"],
  drift: ["rate"],
  overshoot: ["amplitude", "frequency", "decay"],
  audioReact: ["trackId", "amount", "floorDb", "ceilingDb"],
};

const COMMON_FIELDS = ["id", "kind", "property", "offsetMs"] as const;

export const KEY_READING_KINDS: ReadonlySet<BehaviorKind> = new Set(["loop", "overshoot"]);

export function isBehaviorKind(value: string): value is BehaviorKind {
  return (BEHAVIOR_KINDS as readonly string[]).includes(value);
}

export function isBehaviorProperty(value: string): value is BehaviorProperty {
  return (BEHAVIOR_PROPERTIES as readonly string[]).includes(value);
}

export function isLoopMode(value: string): value is LoopMode {
  return (LOOP_MODES as readonly string[]).includes(value);
}

export function isLoopSide(value: string): value is LoopSide {
  return (LOOP_SIDES as readonly string[]).includes(value);
}

export function behaviorProperties(type: ClipType): readonly BehaviorProperty[] {
  if (!BEHAVING_TYPES.has(type)) return [];
  return type === "null" ? NULL_PROPERTIES : BEHAVIOR_PROPERTIES;
}

export function behaviorsOn(clip: Pick<Clip, "behaviors">, property: BehaviorProperty): Behavior[] {
  return (clip.behaviors ?? []).filter((behavior) => behavior.property === property);
}

export function behavedProperties(clip: Pick<Clip, "behaviors">): BehaviorProperty[] {
  return BEHAVIOR_PROPERTIES.filter((property) => behaviorsOn(clip, property).length > 0);
}

function within(value: unknown, [low, high]: readonly [number, number]): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= low && value <= high;
}

function carried(value: unknown): boolean {
  return value !== undefined && value !== "";
}

function fieldsIssue(behavior: Behavior): boolean {
  const allowed = new Set<string>([...COMMON_FIELDS, ...BEHAVIOR_FIELDS[behavior.kind]]);
  const record = behavior as unknown as Record<string, unknown>;
  return Object.keys(record).some((key) => carried(record[key]) && !allowed.has(key)) || BEHAVIOR_FIELDS[behavior.kind].some((key) => !carried(record[key]));
}

function paramsIssue(behavior: Behavior): IssueCode | null {
  const span = BEHAVIOR_SPANS[behavior.property];
  switch (behavior.kind) {
    case "wiggle":
      return within(behavior.frequency, BEHAVIOR_LIMITS.frequency) && within(behavior.amount, [0, span]) && Number.isInteger(behavior.seed) && within(behavior.seed, BEHAVIOR_LIMITS.seed) ? null : "out_of_range";
    case "loop":
      return isLoopMode(behavior.mode) && isLoopSide(behavior.side) ? null : "unknown";
    case "drift":
      return within(behavior.rate, [-span, span]) ? null : "out_of_range";
    case "overshoot":
      return within(behavior.amplitude, BEHAVIOR_LIMITS.amplitude) && within(behavior.frequency, BEHAVIOR_LIMITS.frequency) && within(behavior.decay, BEHAVIOR_LIMITS.decay) ? null : "out_of_range";
    case "audioReact":
      if (!isValidToken(behavior.trackId)) return "invalid";
      return within(behavior.amount, [-span, span]) && within(behavior.floorDb, BEHAVIOR_LIMITS.db) && within(behavior.ceilingDb, BEHAVIOR_LIMITS.db) && behavior.floorDb < behavior.ceilingDb ? null : "out_of_range";
  }
}

export function behaviorIssue(behavior: Behavior, properties: readonly BehaviorProperty[]): IssueCode | null {
  if (!isValidToken(behavior.id)) return "invalid";
  if (!isBehaviorKind(behavior.kind) || !isBehaviorProperty(behavior.property)) return "unknown";
  if (!properties.includes(behavior.property) || fieldsIssue(behavior)) return "invalid";
  if (behavior.offsetMs !== undefined && !(Number.isInteger(behavior.offsetMs) && within(behavior.offsetMs, [0, STUDIO_LIMITS.maxVideoMs]))) return "out_of_range";
  return paramsIssue(behavior);
}

export function behaviorsIssue(clip: Pick<Clip, "type" | "behaviors">): IssueCode | null {
  const list = clip.behaviors;
  if (!list || list.length === 0) return null;
  const properties = behaviorProperties(clip.type);
  if (properties.length === 0) return "invalid";
  const ids = new Set<string>();
  const pairs = new Set<string>();
  for (const behavior of list) {
    const code = behaviorIssue(behavior, properties);
    if (code) return code;
    const pair = `${behavior.property}:${behavior.kind}`;
    if (ids.has(behavior.id) || pairs.has(pair)) return "duplicate";
    ids.add(behavior.id);
    pairs.add(pair);
  }
  return null;
}

export function audioTrackIds(doc: Pick<VideoDocument, "tracks">): Set<string> {
  return new Set(doc.tracks.filter((track) => track.kind === "audio").map((track) => track.id));
}

export function behaviorTracksIssue(doc: Pick<VideoDocument, "tracks">): IssueCode | null {
  const audio = audioTrackIds(doc);
  const heard = doc.tracks.every((track) => track.clips.every((clip) => (clip.behaviors ?? []).every((behavior) => behavior.kind !== "audioReact" || audio.has(behavior.trackId))));
  return heard ? null : "invalid";
}

export function withHeardTracks(clip: Clip, audio: ReadonlySet<string>): Clip {
  const list = clip.behaviors;
  if (!list || list.every((behavior) => behavior.kind !== "audioReact" || audio.has(behavior.trackId))) return withHeardVfx(clip, audio);
  const kept = list.filter((behavior) => behavior.kind !== "audioReact" || audio.has(behavior.trackId));
  const next: Clip = { ...clip, behaviors: kept };
  if (kept.length === 0) delete next.behaviors;
  return withHeardVfx(next, audio);
}

export function reactTrackIds(doc: Pick<VideoDocument, "tracks">): string[] {
  const ids = doc.tracks.flatMap((track) => track.clips.flatMap((clip) => (clip.behaviors ?? []).flatMap((behavior) => (behavior.kind === "audioReact" ? [behavior.trackId] : []))));
  return [...new Set(ids)];
}

export function splitBehaviors(list: readonly Behavior[], atLocalMs: number): Behavior[] {
  return list.map((behavior) => ({ ...behavior, offsetMs: (behavior.offsetMs ?? 0) + Math.round(atLocalMs) }));
}

export interface TrackLevel {
  stepMs: number;
  db: Float32Array;
  bands?: readonly Float32Array[];
}

export type TrackLevels = (trackId: string) => TrackLevel | undefined;

export const NO_LEVELS: TrackLevels = () => undefined;

export function levelDbAt(level: TrackLevel, timelineMs: number): number {
  const position = timelineMs / level.stepMs;
  const last = level.db.length - 1;
  if (!(position >= 0) || position > last) return SILENT_DB;
  const index = Math.floor(position);
  const from = level.db[index];
  const to = level.db[Math.min(last, index + 1)];
  return from + (to - from) * (position - index);
}

export function reactShare(behavior: Pick<AudioReactBehavior, "floorDb" | "ceilingDb">, db: number): number {
  return Math.min(1, Math.max(0, (db - behavior.floorDb) / (behavior.ceilingDb - behavior.floorDb)));
}

const MS_PER_SECOND = 1000;
const WIGGLE_CHANNEL = 100;

export function arrivalSpeed(frames: readonly Keyframe[], index: number): number {
  if (index < 1 || index >= frames.length) return 0;
  const from = frames[index - 1];
  const to = frames[index];
  return ((to.value - from.value) * easeSlope(from.easing, 1) * MS_PER_SECOND) / (to.atMs - from.atMs);
}

export function departureSpeed(frames: readonly Keyframe[], index: number): number {
  if (index < 0 || index >= frames.length - 1) return 0;
  const from = frames[index];
  const to = frames[index + 1];
  return ((to.value - from.value) * easeSlope(from.easing, 0) * MS_PER_SECOND) / (to.atMs - from.atMs);
}

function positiveModulo(value: number, period: number): number {
  return ((value % period) + period) % period;
}

function loopsAfter(side: LoopSide): boolean {
  return side !== "in";
}

function loopsBefore(side: LoopSide): boolean {
  return side !== "out";
}

export function loopedValue(frames: readonly Keyframe[], loop: Pick<LoopBehavior, "mode" | "side">, localMs: number): number | null {
  if (frames.length < 2) return null;
  const first = frames[0];
  const last = frames[frames.length - 1];
  const after = localMs > last.atMs && loopsAfter(loop.side);
  const before = localMs < first.atMs && loopsBefore(loop.side);
  if (!after && !before) return null;
  const period = last.atMs - first.atMs;
  switch (loop.mode) {
    case "cycle":
      return valueAt(frames, first.atMs + positiveModulo(localMs - first.atMs, period));
    case "pingpong": {
      const distance = after ? localMs - last.atMs : first.atMs - localMs;
      const turns = Math.floor(distance / period);
      const phase = distance - turns * period;
      const back = turns % 2 === 0;
      if (after) return valueAt(frames, back ? last.atMs - phase : first.atMs + phase);
      return valueAt(frames, back ? first.atMs + phase : last.atMs - phase);
    }
    case "offset": {
      const cycles = Math.floor((localMs - first.atMs) / period);
      return valueAt(frames, localMs - cycles * period) + cycles * (last.value - first.value);
    }
    case "continue":
      if (after) return last.value + (arrivalSpeed(frames, frames.length - 1) * (localMs - last.atMs)) / MS_PER_SECOND;
      return first.value - (departureSpeed(frames, 0) * (first.atMs - localMs)) / MS_PER_SECOND;
  }
}

export function overshootOffset(frames: readonly Keyframe[], behavior: Pick<OvershootBehavior, "amplitude" | "frequency" | "decay">, localMs: number): number {
  let index = -1;
  for (let i = 0; i < frames.length && frames[i].atMs <= localMs; i++) index = i;
  if (index < 1) return 0;
  const since = (localMs - frames[index].atMs) / MS_PER_SECOND;
  return (arrivalSpeed(frames, index) * behavior.amplitude * Math.sin(2 * Math.PI * behavior.frequency * since)) / Math.exp(behavior.decay * since);
}

function behaviorSeconds(behavior: Behavior, localMs: number): number {
  return (localMs + (behavior.offsetMs ?? 0)) / MS_PER_SECOND;
}

export function wiggleOffset(behavior: WiggleBehavior, localMs: number): number {
  const channel = WIGGLE_CHANNEL + BEHAVIOR_PROPERTIES.indexOf(behavior.property);
  return behavior.amount * layeredNoise(behavior.seed, channel, behaviorSeconds(behavior, localMs) * behavior.frequency);
}

export interface BehaviorMoment {
  startMs: number;
  localMs: number;
  levels: TrackLevels;
}

export function behaviorOffset(behavior: Behavior, frames: readonly Keyframe[], moment: BehaviorMoment): number {
  switch (behavior.kind) {
    case "wiggle":
      return wiggleOffset(behavior, moment.localMs);
    case "drift":
      return behavior.rate * behaviorSeconds(behavior, moment.localMs);
    case "overshoot":
      return overshootOffset(frames, behavior, moment.localMs);
    case "audioReact": {
      const level = moment.levels(behavior.trackId);
      return level ? behavior.amount * reactShare(behavior, levelDbAt(level, moment.startMs + moment.localMs)) : 0;
    }
    case "loop":
      return 0;
  }
}

export function stackedValue(frames: readonly Keyframe[], list: readonly Behavior[], keyed: number, moment: BehaviorMoment): number {
  const loop = list.find((behavior): behavior is LoopBehavior => behavior.kind === "loop");
  const looped = loop ? loopedValue(frames, loop, moment.localMs) : null;
  return list.reduce((sum, behavior) => sum + behaviorOffset(behavior, frames, moment), looped ?? keyed);
}

const BEHAVED_BOUNDS: Partial<Record<BehaviorProperty, readonly [number, number]>> = {
  opacity: KEYFRAME_RANGES.opacity,
  blur: KEYFRAME_RANGES.blur,
  scale: [0, KEYFRAME_RANGES.scale[1]],
  scaleX: [0, KEYFRAME_RANGES.scaleX[1]],
  scaleY: [0, KEYFRAME_RANGES.scaleY[1]],
};

export function boundedValue(property: BehaviorProperty, value: number): number {
  const bounds = BEHAVED_BOUNDS[property];
  return bounds ? Math.min(bounds[1], Math.max(bounds[0], value)) : value;
}

export type BehavedClip = Pick<Clip, "startMs" | "keyframes" | "behaviors">;

function framesOf(clip: Pick<Clip, "keyframes">, property: BehaviorProperty): readonly Keyframe[] {
  return clip.keyframes?.[property] ?? [];
}

export function behavedValue(clip: BehavedClip, property: BehaviorProperty, keyed: number, localMs: number, levels: TrackLevels = NO_LEVELS): number {
  const own = behaviorsOn(clip, property);
  if (own.length === 0) return keyed;
  return boundedValue(property, stackedValue(framesOf(clip, property), own, keyed, { startMs: clip.startMs, localMs, levels }));
}

export function behaviorLane(clip: BehavedClip, localMs: number, levels: TrackLevels = NO_LEVELS): LaneValue | undefined {
  if (!clip.behaviors || clip.behaviors.length === 0) return undefined;
  return (property: KeyframeProperty, keyed: number) => (isBehaviorProperty(property) ? behavedValue(clip, property, keyed, localMs, levels) : keyed);
}
