import { IMAGE_ASPECTS, type ImageAspect, type MediaFrame, type MediaKind } from "@/lib/media-generation/types";

import type { PendingAction } from "./types";

const TOOL_MEDIA: Record<string, MediaKind> = {
  generate_image: "image",
  generate_music: "music",
  generate_voiceover: "voice",
  render_video: "video",
};

const DEFAULT_ASPECT: ImageAspect = "square";
const ASPECT_FIELD = "format";

export interface MediaPlaceholder {
  kind: MediaKind;
  frame: MediaFrame;
  failed: boolean;
}

interface ToolSegment {
  kind: "tool";
  name: string;
  summary: string;
  ok: boolean;
  running?: boolean;
  frame?: MediaFrame;
}

function parseAspect(value: unknown): ImageAspect | null {
  return IMAGE_ASPECTS.find((aspect) => aspect === value) ?? null;
}

function approvedAspect(approved: PendingAction): ImageAspect | null {
  return parseAspect(approved.args?.aspect) ?? parseAspect(approved.fields?.find((field) => field.key === ASPECT_FIELD)?.value);
}

export function toolStartFrame(name: string, approved?: PendingAction): MediaFrame | undefined {
  const kind = TOOL_MEDIA[name];
  if (!kind) return undefined;
  if (kind === "music" || kind === "voice") return "audio";
  return (approved && approvedAspect(approved)) || DEFAULT_ASPECT;
}

export function mediaPlaceholderOf(seg: ToolSegment): MediaPlaceholder | null {
  const kind = TOOL_MEDIA[seg.name];
  if (!kind || !seg.frame) return null;
  if (seg.running) return { kind, frame: seg.frame, failed: false };
  if (!seg.ok) return { kind, frame: seg.frame, failed: true };
  return null;
}
