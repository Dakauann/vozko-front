import { IMAGE_SCHEMA, DOCUMENT_VERSION, STUDIO_LIMITS, type ImageDocument, type Layer, type StudioGroup } from "./document";
import { groupAncestry } from "./groups";
import { parseDocument } from "./validate";

export const CLIPBOARD_PREFIX = "vozko-studio-layers:";

export interface ClipboardContent {
  layers: Layer[];
  groups: StudioGroup[];
}

export function clipboardOf(doc: ImageDocument, ids: readonly string[]): ClipboardContent {
  const wanted = new Set(ids);
  const layers = doc.layers.filter((l) => wanted.has(l.id));
  const used = new Set(layers.flatMap((l) => groupAncestry(doc, l.groupId)));
  return { layers, groups: (doc.groups ?? []).filter((g) => used.has(g.id)) };
}

export function encodeClipboard(content: ClipboardContent): string {
  return `${CLIPBOARD_PREFIX}${JSON.stringify(content)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function decodeClipboard(text: string): ClipboardContent | null {
  if (!text.startsWith(CLIPBOARD_PREFIX)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(CLIPBOARD_PREFIX.length));
  } catch {
    return null;
  }
  if (!isRecord(raw) || !Array.isArray(raw.layers) || raw.layers.length === 0 || raw.layers.length > STUDIO_LIMITS.maxLayers) return null;
  if (Object.keys(raw).some((key) => key !== "layers" && key !== "groups")) return null;
  const parsed = parseDocument("image", {
    schema: IMAGE_SCHEMA,
    version: DOCUMENT_VERSION,
    canvas: { width: STUDIO_LIMITS.minCanvasSide, height: STUDIO_LIMITS.minCanvasSide, background: "" },
    layers: raw.layers,
    ...(raw.groups === undefined ? {} : { groups: raw.groups }),
  });
  return parsed.ok ? { layers: parsed.document.layers, groups: parsed.document.groups ?? [] } : null;
}
