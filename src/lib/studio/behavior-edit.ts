import {
  audioTrackIds,
  BEHAVIOR_FIELDS,
  BEHAVIOR_LIMITS,
  behaviorProperties,
  behaviorsIssue,
  behavedValue,
  KEY_READING_KINDS,
  stackedValue,
  type Behavior,
  type BehaviorKind,
  type BehaviorProperty,
  type LoopMode,
  type LoopSide,
  type TrackLevels,
} from "./behaviors";
import { editClipItem, editClipItems, editVisualClip, insertItem, removeItem, type ClipItems, type ClipItemsEdit, type ClipItemsRefusal } from "./clip-items";
import { FRAMES_PER_SECOND, newStudioId, type Clip, type VideoDocument } from "./document";
import { exportFrameMs } from "./export-encoding";
import { onPath, propertyValue } from "./keyframe-edit";
import { KEYFRAME_RANGES, rivalsOf, timedFramesOf, withLane, type Keyframe } from "./keyframes";

export type BehaviorRefusal = ClipItemsRefusal | "behaviorMissing" | "property" | "duplicate" | "track" | "field" | "path" | "rival" | "unheard";

type BehaviorEdit = ClipItemsEdit<BehaviorRefusal>;

export interface BehaviorSettings {
  frequency?: number;
  amount?: number;
  seed?: number;
  mode?: LoopMode;
  side?: LoopSide;
  rate?: number;
  amplitude?: number;
  decay?: number;
  trackId?: string;
  floorDb?: number;
  ceilingDb?: number;
}

const WIGGLE_AMOUNTS: Record<BehaviorProperty, number> = { x: 0.02, y: 0.02, scale: 0.05, scaleX: 0.05, scaleY: 0.05, rotation: 5, opacity: 0.2, blur: 4 };
const DRIFT_RATES: Record<BehaviorProperty, number> = { x: 0.05, y: 0.05, scale: 0.1, scaleX: 0.1, scaleY: 0.1, rotation: 90, opacity: -0.2, blur: 2 };
const REACT_AMOUNTS: Record<BehaviorProperty, number> = { x: 0.03, y: 0.03, scale: 0.2, scaleX: 0.2, scaleY: 0.2, rotation: 10, opacity: 0.5, blur: 10 };

const BEHAVIOR_DEFAULTS = {
  wiggleFrequency: 2,
  loopMode: "cycle" as LoopMode,
  loopSide: "out" as LoopSide,
  overshootAmplitude: 0.05,
  overshootFrequency: 4,
  overshootDecay: 8,
  floorDb: -40,
  ceilingDb: -10,
};

const BAKE_PRECISION = 1e6;

const BEHAVIOR_LIST: ClipItems<Behavior> = {
  read: (clip) => clip.behaviors ?? [],
  write: (list) => ({ behaviors: list.length > 0 ? list : undefined }),
  invalid: (list, clip) => behaviorsIssue({ type: clip.type, behaviors: [...list] }) !== null,
};

export function randomBehaviorSeed(): number {
  return Math.floor(Math.random() * (BEHAVIOR_LIMITS.seed[1] + 1));
}

export function defaultReactTrack(doc: Pick<VideoDocument, "tracks">): string | undefined {
  const audio = doc.tracks.filter((track) => track.kind === "audio");
  return (audio.find((track) => track.clips.length > 0) ?? audio[0])?.id;
}

export function draftBehavior(kind: BehaviorKind, property: BehaviorProperty, settings: BehaviorSettings, seed: number, trackId: string | undefined): Behavior | "track" {
  const id = newStudioId("b");
  switch (kind) {
    case "wiggle":
      return { id, kind, property, frequency: settings.frequency ?? BEHAVIOR_DEFAULTS.wiggleFrequency, amount: settings.amount ?? WIGGLE_AMOUNTS[property], seed: settings.seed ?? seed };
    case "loop":
      return { id, kind, property, mode: settings.mode ?? BEHAVIOR_DEFAULTS.loopMode, side: settings.side ?? BEHAVIOR_DEFAULTS.loopSide };
    case "drift":
      return { id, kind, property, rate: settings.rate ?? DRIFT_RATES[property] };
    case "overshoot":
      return { id, kind, property, amplitude: settings.amplitude ?? BEHAVIOR_DEFAULTS.overshootAmplitude, frequency: settings.frequency ?? BEHAVIOR_DEFAULTS.overshootFrequency, decay: settings.decay ?? BEHAVIOR_DEFAULTS.overshootDecay };
    case "audioReact": {
      const track = settings.trackId ?? trackId;
      if (!track) return "track";
      return { id, kind, property, trackId: track, amount: settings.amount ?? REACT_AMOUNTS[property], floorDb: settings.floorDb ?? BEHAVIOR_DEFAULTS.floorDb, ceilingDb: settings.ceilingDb ?? BEHAVIOR_DEFAULTS.ceilingDb };
    }
  }
}

export function foreignSettings(kind: BehaviorKind, settings: BehaviorSettings): string[] {
  return Object.entries(settings)
    .filter(([key, value]) => value !== undefined && !BEHAVIOR_FIELDS[kind].includes(key))
    .map(([key]) => key);
}

function heard(doc: VideoDocument, behavior: Behavior): boolean {
  return behavior.kind !== "audioReact" || audioTrackIds(doc).has(behavior.trackId);
}

export function addBehavior(doc: VideoDocument, clipId: string, behavior: Behavior): BehaviorEdit {
  return editClipItems<Behavior, BehaviorRefusal>(doc, clipId, BEHAVIOR_LIST, (list, clip) => {
    if (!behaviorProperties(clip.type).includes(behavior.property)) return "property";
    if (list.some((other) => other.property === behavior.property && other.kind === behavior.kind)) return "duplicate";
    if (!heard(doc, behavior)) return "track";
    return insertItem(list, behavior);
  });
}

function patchBehavior(current: Behavior, settings: BehaviorSettings): Behavior | BehaviorRefusal {
  if (foreignSettings(current.kind, settings).length > 0) return "field";
  const changes = Object.fromEntries(Object.entries(settings).filter(([, value]) => value !== undefined));
  return { ...current, ...changes } as Behavior;
}

export function updateBehavior(doc: VideoDocument, clipId: string, behaviorId: string, settings: BehaviorSettings): BehaviorEdit {
  return editClipItem<Behavior, BehaviorRefusal>(doc, clipId, behaviorId, BEHAVIOR_LIST, "behaviorMissing", (current) => {
    const next = patchBehavior(current, settings);
    if (typeof next === "string") return next;
    return heard(doc, next) ? next : "track";
  });
}

export function removeBehavior(doc: VideoDocument, clipId: string, behaviorId: string): BehaviorEdit {
  return editClipItems<Behavior, BehaviorRefusal>(doc, clipId, BEHAVIOR_LIST, (list) => removeItem(list, behaviorId) ?? "behaviorMissing");
}

export function bakeTimes(clip: Pick<Clip, "startMs" | "durationMs">): number[] {
  const times = new Set<number>([0, clip.durationMs]);
  for (let frame = Math.ceil((clip.startMs * FRAMES_PER_SECOND) / 1000); exportFrameMs(frame) <= clip.startMs + clip.durationMs; frame++) {
    const local = Math.round(exportFrameMs(frame) - clip.startMs);
    if (local >= 0 && local <= clip.durationMs) times.add(local);
  }
  return [...times].sort((a, b) => a - b);
}

function bakeBlock(clip: Clip, property: BehaviorProperty): BehaviorRefusal | null {
  if ((property === "x" || property === "y") && onPath(clip)) return "path";
  return rivalsOf(property).some((rival) => timedFramesOf(clip.keyframes, rival).length > 0) ? "rival" : null;
}

interface BakeReport {
  keys: number;
  clamped: number;
  absorbed: string[];
}

type BakeResult = ({ ok: true; document: VideoDocument } & BakeReport) | { ok: false; reason: BehaviorRefusal };

export function bakeBehavior(doc: VideoDocument, clipId: string, behaviorId: string, levels: TrackLevels): BakeResult {
  const report: BakeReport = { keys: 0, clamped: 0, absorbed: [] };
  const edit = editVisualClip<BehaviorRefusal>(doc, clipId, (clip) => {
    const target = clip.behaviors?.find((behavior) => behavior.id === behaviorId);
    if (!target) return "behaviorMissing";
    const property = target.property;
    const blocked = bakeBlock(clip, property);
    if (blocked) return blocked;
    const absorbed = (clip.behaviors ?? []).filter((behavior) => behavior.property === property && (behavior.id === behaviorId || KEY_READING_KINDS.has(behavior.kind)));
    if (absorbed.some((behavior) => behavior.kind === "audioReact" && !levels(behavior.trackId))) return "unheard";
    const frames = clip.keyframes?.[property] ?? [];
    const [low, high] = KEYFRAME_RANGES[property];
    const lane: Keyframe[] = bakeTimes(clip).map((atMs) => {
      const raw = stackedValue(frames, absorbed, propertyValue(clip, property, atMs), { startMs: clip.startMs, localMs: atMs, levels });
      const value = Math.min(high, Math.max(low, raw));
      if (value !== raw) report.clamped += 1;
      return { atMs, value: Math.round(value * BAKE_PRECISION) / BAKE_PRECISION, easing: "linear" };
    });
    report.keys = lane.length;
    report.absorbed = absorbed.map((behavior) => behavior.id);
    const kept = (clip.behaviors ?? []).filter((behavior) => !absorbed.includes(behavior));
    return { keyframes: withLane(clip.keyframes, property, lane), behaviors: kept.length > 0 ? kept : undefined };
  });
  return edit.ok ? { ...edit, ...report } : edit;
}

interface TracePoint {
  ms: number;
  value: number;
}

export function behaviorTrace(clip: Clip, property: BehaviorProperty, samples: number, levels: TrackLevels): TracePoint[] {
  if (samples <= 0) return [];
  return Array.from({ length: samples + 1 }, (_, index) => {
    const ms = (index / samples) * clip.durationMs;
    return { ms, value: behavedValue(clip, property, propertyValue(clip, property, ms), ms, levels) };
  });
}
