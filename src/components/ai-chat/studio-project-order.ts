import type { StudioOrderMedia, StudioProjectOrder } from "@/hooks/use-studio-project-creator";
import { VIDEO_ASPECTS, type CanvasSize, type VideoAspect } from "@/lib/studio/document";
import type { MediaClipType } from "@/lib/studio/media-clips";

const MEDIA_TYPES: readonly MediaClipType[] = ["image", "video", "audio"];

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function optional<T>(value: unknown, read: (value: unknown) => T | null): T | undefined | null {
  return value === undefined ? undefined : read(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function media(value: unknown): StudioOrderMedia | null {
  const item = record(value);
  const type = item?.type;
  if (!item || typeof item.mediaId !== "string" || typeof item.url !== "string" || !(MEDIA_TYPES as readonly unknown[]).includes(type)) return null;
  return { mediaId: item.mediaId, url: item.url, type: type as MediaClipType };
}

function size(value: unknown): CanvasSize | null {
  const item = record(value);
  const width = count(item?.width);
  const height = count(item?.height);
  return width === null || height === null ? null : { width, height };
}

function list<T>(value: unknown, read: (value: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(read);
  return items.every((item): item is T => item !== null) ? items : null;
}

function aspect(value: unknown): VideoAspect | null {
  return (VIDEO_ASPECTS as readonly unknown[]).includes(value) ? (value as VideoAspect) : null;
}

export function studioOrderFrom(raw: unknown): StudioProjectOrder | null {
  const order = record(raw);
  if (!order || (order.kind !== "image" && order.kind !== "video")) return null;
  const name = optional(order.name, text);
  const items = optional(order.media, (value) => list(value, media));
  const sizes = optional(order.sizes, (value) => list(value, size));
  const chosen = optional(order.aspect, aspect);
  const durationMs = optional(order.durationMs, count);
  if (name === null || items === null || sizes === null || chosen === null || durationMs === null) return null;
  return { kind: order.kind, name, media: items ?? [], sizes, aspect: chosen, durationMs };
}
