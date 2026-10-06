import { IMAGE_ASPECTS, type ImageAspect } from "@/lib/media-generation/types";

export interface VideoPlanScene {
  mediaId: string;
  url: string;
  kind: "image" | "video";
  seconds: number;
}

export interface VideoPlanTrack {
  mediaId: string;
  url: string;
}

export interface VideoPlan {
  aspect: ImageAspect;
  scenes: VideoPlanScene[];
  music?: VideoPlanTrack;
  voice?: VideoPlanTrack;
  totalSeconds: number;
}

const SCENE_KINDS: readonly VideoPlanScene["kind"][] = ["image", "video"];

type Parsed<T> = T | null | undefined;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function filled(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function parseScene(value: unknown): VideoPlanScene | null {
  const item = record(value);
  const mediaId = filled(item?.mediaId);
  const url = filled(item?.url);
  const kind = SCENE_KINDS.find((candidate) => candidate === item?.kind);
  const seconds = item?.seconds;
  if (!mediaId || !url || !kind || typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  return { mediaId, url, kind, seconds };
}

function parseTrack(value: unknown): Parsed<VideoPlanTrack> {
  if (value === undefined || value === null) return undefined;
  const item = record(value);
  const mediaId = filled(item?.mediaId);
  const url = filled(item?.url);
  return mediaId && url ? { mediaId, url } : null;
}

export function parseVideoPlan(data: unknown): VideoPlan | null {
  const plan = record(data);
  const aspect = IMAGE_ASPECTS.find((candidate) => candidate === plan?.aspect);
  if (!plan || !aspect || !Array.isArray(plan.scenes) || plan.scenes.length === 0) return null;
  const scenes = plan.scenes.map(parseScene);
  if (scenes.some((scene) => scene === null)) return null;
  const music = parseTrack(plan.music);
  const voice = parseTrack(plan.voice);
  if (music === null || voice === null) return null;
  const valid = scenes as VideoPlanScene[];
  return {
    aspect,
    scenes: valid,
    ...(music ? { music } : {}),
    ...(voice ? { voice } : {}),
    totalSeconds: valid.reduce((total, scene) => total + scene.seconds, 0),
  };
}
