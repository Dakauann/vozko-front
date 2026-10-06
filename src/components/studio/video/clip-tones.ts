import { ImageSquare, Smiley, Square, TextT, VideoCamera, Waveform, type Icon } from "@/components/icons";
import type { Clip, ClipType, TrackKind } from "@/lib/studio/document";

export type ClipKind = "video" | "image" | "text" | "shape" | "icon" | "audio";

export type PlateIndex = 1 | 2 | 3 | 4 | 5;

export interface ClipTone {
  plate: PlateIndex;
  glyph: Icon;
}

export const CLIP_KIND_TONES: Record<ClipKind, ClipTone> = {
  video: { plate: 2, glyph: VideoCamera },
  image: { plate: 4, glyph: ImageSquare },
  text: { plate: 5, glyph: TextT },
  shape: { plate: 3, glyph: Square },
  icon: { plate: 3, glyph: Smiley },
  audio: { plate: 1, glyph: Waveform },
};

const TILE: Record<PlateIndex, string> = { 1: "tile-1", 2: "tile-2", 3: "tile-3", 4: "tile-4", 5: "tile-5" };

const PLATE_FILL: Record<PlateIndex, string> = {
  1: "bg-[hsl(var(--plate-1))]",
  2: "bg-[hsl(var(--plate-2))]",
  3: "bg-[hsl(var(--plate-3))]",
  4: "bg-[hsl(var(--plate-4))]",
  5: "bg-[hsl(var(--plate-5))]",
};

const PLATE_TEXT: Record<PlateIndex, string> = {
  1: "text-[hsl(var(--plate-1))]",
  2: "text-[hsl(var(--plate-2))]",
  3: "text-[hsl(var(--plate-3))]",
  4: "text-[hsl(var(--plate-4))]",
  5: "text-[hsl(var(--plate-5))]",
};

export function clipKind(clip: Pick<Clip, "type" | "layer">): ClipKind {
  if (clip.type !== "overlay") return clip.type;
  if (clip.layer?.type === "icon") return "icon";
  if (clip.layer?.type === "shape" || clip.layer?.type === "image") return "shape";
  return "text";
}

export function kindTile(kind: ClipKind): string {
  return TILE[CLIP_KIND_TONES[kind].plate];
}

export function kindFill(kind: ClipKind): string {
  return PLATE_FILL[CLIP_KIND_TONES[kind].plate];
}

export function kindInk(kind: ClipKind): string {
  return PLATE_TEXT[CLIP_KIND_TONES[kind].plate];
}

export function kindPlateVar(kind: ClipKind): string {
  return `--plate-${CLIP_KIND_TONES[kind].plate}`;
}

export const TRACK_KIND: Record<TrackKind, ClipKind> = { visual: "video", audio: "audio" };

export const MEDIA_KIND: Record<"video" | "image" | "audio", ClipKind> = { video: "video", image: "image", audio: "audio" };

export const CLIP_TILE: Record<ClipType, string> = {
  video: kindTile("video"),
  image: kindTile("image"),
  overlay: kindTile("text"),
  audio: kindTile("audio"),
};

export const CLIP_PLATE: Record<ClipType, string> = {
  video: kindFill("video"),
  image: kindFill("image"),
  overlay: kindFill("text"),
  audio: kindFill("audio"),
};

export const CLIP_GLYPH: Record<ClipType, Icon> = {
  video: CLIP_KIND_TONES.video.glyph,
  image: CLIP_KIND_TONES.image.glyph,
  overlay: CLIP_KIND_TONES.text.glyph,
  audio: CLIP_KIND_TONES.audio.glyph,
};

export const TRACK_TILE: Record<TrackKind, string> = { visual: kindTile("video"), audio: kindTile("audio") };

export const TRACK_GLYPH: Record<TrackKind, Icon> = { visual: CLIP_KIND_TONES.video.glyph, audio: CLIP_KIND_TONES.audio.glyph };
