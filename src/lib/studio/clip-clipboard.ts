import type { ClipboardItem, ClipboardPayload } from "./tools";

export const CLIPBOARD_MARK = "vozko.studio.clips";
export const CLIPBOARD_VERSION = 1;

export function encodeClipboard(payload: ClipboardPayload): string {
  return JSON.stringify({ kind: CLIPBOARD_MARK, version: CLIPBOARD_VERSION, payload });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isItem(value: unknown): value is ClipboardItem {
  if (!isRecord(value) || !isRecord(value.clip)) return false;
  const clip = value.clip;
  return (
    typeof value.trackId === "string" &&
    (value.trackKind === "visual" || value.trackKind === "audio") &&
    typeof value.offsetMs === "number" &&
    Number.isFinite(value.offsetMs) &&
    value.offsetMs >= 0 &&
    typeof clip.id === "string" &&
    typeof clip.type === "string" &&
    typeof clip.durationMs === "number" &&
    typeof clip.startMs === "number" &&
    isRecord(clip.transform)
  );
}

export function decodeClipboard(text: string | null | undefined): ClipboardPayload | null {
  if (!text || text.length > 512 * 1024) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.kind !== CLIPBOARD_MARK || parsed.version !== CLIPBOARD_VERSION || !isRecord(parsed.payload)) return null;
  const { items, spanMs } = parsed.payload;
  if (!Array.isArray(items) || items.length === 0 || !items.every(isItem) || typeof spanMs !== "number" || !Number.isFinite(spanMs) || spanMs <= 0) return null;
  return { items, spanMs };
}

export type PasteRoute = { kind: "images"; files: File[] } | { kind: "clips"; payload: ClipboardPayload } | { kind: "none" };

export function pasteRoute(images: File[], text: string | null | undefined, fallback: ClipboardPayload | null): PasteRoute {
  if (images.length > 0) return { kind: "images", files: images };
  const decoded = decodeClipboard(text);
  if (decoded) return { kind: "clips", payload: decoded };
  if (!text && fallback) return { kind: "clips", payload: fallback };
  return { kind: "none" };
}
