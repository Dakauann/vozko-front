import type { MediaLayout } from "./types";

interface AttachedMedia {
  url?: unknown;
  layout?: unknown;
}

function positive(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function layoutOf(raw: unknown): MediaLayout | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const candidate = raw as Record<string, unknown>;
  const width = positive(candidate.width);
  const height = positive(candidate.height);
  const thumbhash = typeof candidate.thumbhash === "string" && candidate.thumbhash !== "" ? candidate.thumbhash : undefined;
  if (!width || !height) return undefined;
  return thumbhash ? { width, height, thumbhash } : { width, height };
}

export function messageMedia(message: Record<string, unknown>): { media_url?: string; media_layout?: MediaLayout } {
  const attached = (message.media && typeof message.media === "object" ? message.media : {}) as AttachedMedia;
  const direct = (message.media_url as string | undefined) ?? (message.mediaUrl as string | undefined);
  const url = direct ?? (typeof attached.url === "string" && attached.url !== "" ? attached.url : undefined);
  return {
    media_url: url,
    media_layout: (message.media_layout as MediaLayout | undefined) ?? layoutOf(attached.layout),
  };
}
