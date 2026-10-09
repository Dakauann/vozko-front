import type { Clip } from "./document";
import { isEditableTarget, type KeyStroke } from "./keymap";
import { KEYFRAME_LIMITS, KEYFRAME_PROPERTIES, keyframeCount, keyframesIssue, shiftKeyframes, type Easing, type Keyframe, type KeyframeProperty, type Keyframes } from "./keyframes";
import type { Refusal } from "./selection-edit";
import type { ClipPatch } from "./timeline";

export const KEYFRAME_PRESETS = ["kenBurns", "enterLeft", "slideUp", "fadeIn", "fadeOut", "pulse", "spin", "wobble", "pop", "drop", "springIn"] as const;

export type KeyframePresetId = (typeof KEYFRAME_PRESETS)[number];

type PresetClip = Pick<Clip, "transform" | "durationMs">;

const ENTRANCE_MS = 700;
const FADE_MS = 600;
const KEN_BURNS_SCALE = 1.15;
const PULSE_SCALE = 1.08;
const PULSE_PERIOD_MS = 400;
const WOBBLE_DEGREES = 6;
const WOBBLE_PERIOD_MS = 160;
const SLIDE_DISTANCE = 0.25;
const POP_MS = 450;
const POP_FROM = 0.5;
const POP_FADE_MS = 150;
const DROP_MS = 900;
const DROP_DISTANCE = 0.3;
const SPRING_MS = 800;
const SPRING_FROM = 0.3;

function key(atMs: number, value: number, easing: Easing = "linear"): Keyframe {
  return { atMs: Math.round(atMs), value, easing };
}

function entrance(clip: PresetClip): number {
  return Math.min(ENTRANCE_MS, clip.durationMs);
}

function upTo(clip: PresetClip, ms: number): number {
  return Math.min(ms, clip.durationMs);
}

function fadeUp(clip: PresetClip, ms: number): Keyframe[] {
  return [key(0, 0, "easeOut"), key(upTo(clip, ms), clip.transform.opacity)];
}

function evenTimes(durationMs: number, periodMs: number): number[] {
  const count = Math.min(KEYFRAME_LIMITS.perProperty, Math.max(2, Math.floor(durationMs / periodMs) + 1));
  return Array.from({ length: count }, (_, i) => Math.round((i * durationMs) / (count - 1)));
}

function oscillate(clip: PresetClip, periodMs: number, rest: number, peak: (i: number) => number): Keyframe[] {
  const times = evenTimes(clip.durationMs, periodMs);
  return times.map((atMs, i) => key(atMs, i === 0 || i === times.length - 1 ? rest : peak(i), "easeInOut"));
}

const BUILDERS: Record<KeyframePresetId, (clip: PresetClip) => Keyframes> = {
  kenBurns: (clip) => ({ scale: [key(0, 1), key(clip.durationMs, KEN_BURNS_SCALE)] }),
  enterLeft: (clip) => ({ x: [key(0, -clip.transform.w / 2, "easeOut"), key(entrance(clip), clip.transform.x)] }),
  slideUp: (clip) => ({
    y: [key(0, clip.transform.y + SLIDE_DISTANCE, "easeOut"), key(entrance(clip), clip.transform.y)],
    opacity: [key(0, 0, "easeOut"), key(entrance(clip), clip.transform.opacity)],
  }),
  fadeIn: (clip) => ({ opacity: [key(0, 0, "easeOut"), key(Math.min(FADE_MS, clip.durationMs), clip.transform.opacity)] }),
  fadeOut: (clip) => ({ opacity: [key(Math.max(0, clip.durationMs - FADE_MS), clip.transform.opacity, "easeIn"), key(clip.durationMs, 0)] }),
  pulse: (clip) => ({ scale: oscillate(clip, PULSE_PERIOD_MS, 1, (i) => (i % 2 === 1 ? PULSE_SCALE : 1)) }),
  spin: (clip) => ({ rotation: [key(0, clip.transform.rotation), key(clip.durationMs, clip.transform.rotation + 360)] }),
  wobble: (clip) => ({
    rotation: oscillate(clip, WOBBLE_PERIOD_MS, clip.transform.rotation, (i) => clip.transform.rotation + (i % 2 === 1 ? -WOBBLE_DEGREES : WOBBLE_DEGREES)),
  }),
  pop: (clip) => ({ scale: [key(0, POP_FROM, "backOut"), key(upTo(clip, POP_MS), 1)], opacity: fadeUp(clip, POP_FADE_MS) }),
  drop: (clip) => ({ y: [key(0, clip.transform.y - DROP_DISTANCE, "bounce"), key(upTo(clip, DROP_MS), clip.transform.y)], opacity: fadeUp(clip, POP_FADE_MS) }),
  springIn: (clip) => ({ scale: [key(0, SPRING_FROM, "spring"), key(upTo(clip, SPRING_MS), 1)], opacity: fadeUp(clip, POP_FADE_MS) }),
};

export function presetKeyframes(id: KeyframePresetId, clip: PresetClip): Keyframes {
  return BUILDERS[id](clip);
}

function refusalFor(keyframes: Keyframes | undefined, clip: PresetClip): Refusal | null {
  const issue = keyframesIssue(keyframes, clip.transform);
  if (issue === null) return null;
  return issue === "too_many" ? "keyframeLimit" : "outOfRange";
}

function checked(keyframes: Keyframes | undefined, clip: PresetClip): ClipPatch | Refusal {
  return refusalFor(keyframes, clip) ?? { keyframes };
}

function presentProperties(k: Keyframes): KeyframeProperty[] {
  return KEYFRAME_PROPERTIES.filter((property) => (k[property] ?? []).length > 0);
}

export function withPreset(clip: PresetClip & Pick<Clip, "keyframes">, id: KeyframePresetId): Keyframes {
  const preset = presetKeyframes(id, clip);
  const keyframes: Keyframes = { ...clip.keyframes };
  for (const property of presentProperties(preset)) keyframes[property] = preset[property];
  return keyframes;
}

export function presetPatch(clip: PresetClip & Pick<Clip, "keyframes">, id: KeyframePresetId): ClipPatch | Refusal {
  return checked(withPreset(clip, id), clip);
}

export function captureKeyframes(clip: Pick<Clip, "keyframes">): Keyframes | null {
  if (keyframeCount(clip.keyframes) === 0) return null;
  const first = Math.min(...KEYFRAME_PROPERTIES.flatMap((property) => (clip.keyframes?.[property] ?? []).map((frame) => frame.atMs)));
  return shiftKeyframes(clip.keyframes, -first) ?? null;
}

export function pastePatch(clip: PresetClip & Pick<Clip, "keyframes">, snippet: Keyframes, localMs: number | null): ClipPatch | Refusal {
  if (localMs === null) return "keyframeOutside";
  const placed = shiftKeyframes(snippet, Math.round(localMs)) ?? {};
  const keyframes: Keyframes = { ...clip.keyframes };
  for (const property of presentProperties(placed)) {
    const incoming = placed[property] ?? [];
    const times = new Set(incoming.map((frame) => frame.atMs));
    const kept = (clip.keyframes?.[property] ?? []).filter((frame) => !times.has(frame.atMs));
    keyframes[property] = [...kept, ...incoming].sort((a, b) => a.atMs - b.atMs);
  }
  return checked(keyframes, clip);
}

export type KeyframeClipboardAction = "copy" | "paste";

export function keyframeClipboardAction(stroke: KeyStroke): KeyframeClipboardAction | null {
  if (!(stroke.ctrlKey || stroke.metaKey) || !stroke.altKey || stroke.shiftKey || isEditableTarget(stroke.target)) return null;
  const letter = stroke.code ? stroke.code.replace(/^Key/, "").toLowerCase() : stroke.key.toLowerCase();
  if (letter === "c") return "copy";
  if (letter === "v") return "paste";
  return null;
}
