import { imageScene, videoSceneAt } from "@/lib/studio/agent/scene";
import { resolvedSurface } from "@/lib/studio/components";
import type { Clip, Layer, Track } from "@/lib/studio/document";

import type { Reference } from "./model";
import { SOTA_IDS } from "./references-sota";

export type Tier = "sota" | "complex" | "intermediate" | "simple";

export interface Complexity {
  elements: number;
  effects: number;
  photos: number;
  motion: number;
  score: number;
  tier: Tier;
}

export const TIER_RULE =
  "score = elements + 2 x layers with effects or shadows + 5 x photos + 3 x animated clips; the 11 original references are simple; an expanded piece is complex when it has a photo, motion, at least 25 elements or at least 6 layers with effects, and intermediate otherwise; the sota tier holds the rebuilds of the most liked real designs (references-sota.ts) whatever their score";

const COMPLEX_ELEMENTS = 25;
const COMPLEX_EFFECTS = 6;

function styled(layer: Layer | undefined): boolean {
  return Boolean(layer && ((layer.effects?.some((effect) => !effect.hidden) ?? false) || layer.shadow));
}

function clipsOf(tracks: readonly Track[]): Clip[] {
  return tracks.flatMap((track) => track.clips.flatMap((clip) => [clip, ...(clip.tracks ? clipsOf(clip.tracks) : [])]));
}

function animated(clip: Clip): boolean {
  return Boolean(clip.keyframes && Object.keys(clip.keyframes).length > 0) || Boolean(clip.motionIn || clip.motionOut || clip.textIn || clip.textOut || clip.transitionIn || clip.transitionOut || clip.textAnimators?.length || clip.behaviors?.length);
}

function measure(reference: Reference): Omit<Complexity, "score" | "tier"> {
  if (reference.kind === "image") {
    const doc = { schema: "studio.image" as const, version: 2 as const, artboards: [reference.artboard] };
    const scene = imageScene(resolvedSurface(doc, reference.artboard));
    return {
      elements: scene.elements.length,
      effects: scene.elements.filter((element) => styled(element.layer)).length,
      photos: scene.elements.filter((element) => element.layer?.type === "image").length,
      motion: 0,
    };
  }
  const clips = clipsOf(reference.doc.tracks).filter((clip) => clip.type !== "audio");
  const busiest = Math.max(0, ...Array.from({ length: 6 }, (_, i) => videoSceneAt(reference.doc, Math.round(((i + 0.5) * reference.doc.durationMs) / 6)).elements.length));
  return {
    elements: Math.max(busiest, clips.length),
    effects: clips.filter((clip) => styled(clip.layer) || (clip.effects?.length ?? 0) > 0).length,
    photos: clips.filter((clip) => clip.type === "image" || clip.type === "video").length,
    motion: clips.filter(animated).length,
  };
}

export function complexityOf(reference: Reference, original: boolean): Complexity {
  const parts = measure(reference);
  const score = parts.elements + 2 * parts.effects + 5 * parts.photos + 3 * parts.motion;
  const complex = parts.photos > 0 || parts.motion > 0 || parts.elements >= COMPLEX_ELEMENTS || parts.effects >= COMPLEX_EFFECTS;
  return { ...parts, score, tier: SOTA_IDS.has(reference.id) ? "sota" : original ? "simple" : complex ? "complex" : "intermediate" };
}

export type CostTier = Tier | "motion";

export function costTierOf(complexity: Complexity | undefined, video: boolean): CostTier | undefined {
  return video ? "motion" : complexity?.tier;
}
