import { headroomMs, sourceSpanMs, tailroomMs } from "./clip-time";
import type { Clip, Track } from "./document";
import { ease, type Easing } from "./keyframes";
import { isAudioTransitionKind, transitionWindow, type AudioTransitionKind } from "./transitions";

export type CrossfadeRole = "from" | "to";

export interface CrossfadeWindow {
  fromMs: number;
  toMs: number;
  kind: AudioTransitionKind;
  easing: Easing;
  role: CrossfadeRole;
}

interface VoiceEdges {
  headMs: number;
  tailMs: number;
  fadeIn?: CrossfadeWindow;
  fadeOut?: CrossfadeWindow;
}

export type SourceLength = (assetId: string) => number | undefined;

const QUARTER_TURN = Math.PI / 2;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function crossfadeLevel(kind: AudioTransitionKind, easing: Easing, role: CrossfadeRole, t: number): number {
  const p = clamp01(ease(easing, clamp01(t)));
  if (kind === "constantPower") return role === "from" ? Math.cos(p * QUARTER_TURN) : Math.sin(p * QUARTER_TURN);
  return role === "from" ? 1 - p : p;
}

export function windowLevel(window: CrossfadeWindow, localMs: number): number {
  return crossfadeLevel(window.kind, window.easing, window.role, (localMs - window.fromMs) / (window.toMs - window.fromMs));
}

type EdgeClip = Pick<Clip, "id" | "type" | "assetId" | "startMs" | "durationMs" | "trimInMs" | "speed" | "reverse" | "freeze">;

function knownSource(clip: EdgeClip, sourceMs: SourceLength | undefined): number {
  const known = clip.assetId ? sourceMs?.(clip.assetId) : undefined;
  return known ?? clip.trimInMs + sourceSpanMs(clip);
}

function usable(window: CrossfadeWindow): CrossfadeWindow | undefined {
  return window.toMs > window.fromMs ? window : undefined;
}

export function voiceEdges(track: Pick<Track, "clips" | "transitions">, clip: EdgeClip, sourceMs?: SourceLength): VoiceEdges {
  const edges: VoiceEdges = { headMs: 0, tailMs: 0 };
  const source = knownSource(clip, sourceMs);
  for (const transition of track.transitions ?? []) {
    if (!isAudioTransitionKind(transition.kind) || (transition.toClipId !== clip.id && transition.fromClipId !== clip.id)) continue;
    const window = transitionWindow(transition, track as Track);
    if (!window) continue;
    const fromMs = window.startMs - clip.startMs;
    const toMs = window.endMs - clip.startMs;
    const shape = { kind: transition.kind, easing: transition.easing };
    if (transition.toClipId === clip.id) {
      edges.headMs = Math.max(0, Math.min(-fromMs, headroomMs(clip, source)));
      edges.fadeIn = usable({ fromMs: Math.max(fromMs, -edges.headMs), toMs, role: "to", ...shape });
    } else {
      edges.tailMs = Math.max(0, Math.min(toMs - clip.durationMs, tailroomMs(clip, source)));
      edges.fadeOut = usable({ fromMs, toMs: Math.min(toMs, clip.durationMs + edges.tailMs), role: "from", ...shape });
    }
  }
  return edges;
}
