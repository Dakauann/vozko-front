import type { ImageAspect } from "@/lib/image-generation/types";

import type { PendingAction } from "./types";

export const IMAGE_TOOL = "generate_image";

const ASPECTS: readonly ImageAspect[] = ["square", "portrait", "story"];
const DEFAULT_ASPECT: ImageAspect = "square";
const ASPECT_FIELD = "format";

export interface ImagePlaceholder {
  aspect: ImageAspect;
  failed: boolean;
}

interface ToolSegment {
  kind: "tool";
  name: string;
  summary: string;
  ok: boolean;
  running?: boolean;
  aspect?: ImageAspect;
}

function parseAspect(value: unknown): ImageAspect | null {
  return ASPECTS.find((aspect) => aspect === value) ?? null;
}

function approvedAspect(approved: PendingAction): ImageAspect | null {
  return parseAspect(approved.args?.aspect) ?? parseAspect(approved.fields?.find((field) => field.key === ASPECT_FIELD)?.value);
}

export function toolStartAspect(name: string, approved?: PendingAction): ImageAspect | undefined {
  if (name !== IMAGE_TOOL) return undefined;
  return (approved && approvedAspect(approved)) || DEFAULT_ASPECT;
}

export function imagePlaceholderOf(seg: ToolSegment): ImagePlaceholder | null {
  if (seg.name !== IMAGE_TOOL || !seg.aspect) return null;
  if (seg.running) return { aspect: seg.aspect, failed: false };
  if (!seg.ok) return { aspect: seg.aspect, failed: true };
  return null;
}
