import type { CanvasSize, Filters, ImageDocument, Layer } from "./document";
import { fitInside } from "./geometry";
import { deleteLayers, updateLayers, type LayerPatch } from "./layers";

export type ExportFormat = "png" | "jpeg";
export type ExportScale = 1 | 2;

export const DEFAULT_JPEG_QUALITY = 0.9;
export const EXPORT_FALLBACK_BACKGROUND = "#ffffff";
export const EXPORT_FALLBACK_NAME = "estudio";

export const DEFAULT_FILTERS: Filters = { brightness: 0, contrast: 0, saturation: 0, blur: 0 };

export type FilterPresetId = "vivid" | "soft" | "faded" | "dramatic" | "bright";

export const FILTER_PRESETS: readonly { id: FilterPresetId; filters: Filters }[] = [
  { id: "vivid", filters: { brightness: 0.02, contrast: 12, saturation: 0.6, blur: 0 } },
  { id: "soft", filters: { brightness: 0.06, contrast: -12, saturation: -0.3, blur: 0 } },
  { id: "faded", filters: { brightness: 0.08, contrast: -20, saturation: -1.2, blur: 0 } },
  { id: "dramatic", filters: { brightness: -0.06, contrast: 30, saturation: -0.4, blur: 0 } },
  { id: "bright", filters: { brightness: 0.15, contrast: 5, saturation: 0.2, blur: 0 } },
];

export function isDefaultFilters(filters: Filters | undefined): boolean {
  if (!filters) return true;
  return (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).every((key) => filters[key] === DEFAULT_FILTERS[key]);
}

export function commitText(doc: ImageDocument, id: string, text: string): ImageDocument {
  const layer = doc.layers.find((l) => l.id === id);
  if (!layer || layer.text === text) return doc;
  if (text.trim() === "") return deleteLayers(doc, [id]);
  return updateLayers(doc, [id], { text });
}

export function replaceImageAsset(layer: Layer, assetId: string, natural: CanvasSize, canvas: CanvasSize): LayerPatch {
  return { assetId, crop: undefined, transform: fitInside(natural.width, natural.height, layer.transform, canvas) };
}

export function rasterBackground(background: string, format: ExportFormat, transparent: boolean): string | undefined {
  if (background) return background;
  if (format === "png" && transparent) return undefined;
  return EXPORT_FALLBACK_BACKGROUND;
}

export function exportFileName(name: string, format: ExportFormat, scale: ExportScale): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || EXPORT_FALLBACK_NAME}${scale === 2 ? "@2x" : ""}.${format === "jpeg" ? "jpg" : "png"}`;
}

export function visibleLayers(layers: readonly Layer[]): Layer[] {
  return layers.filter((l) => !l.hidden);
}

export const JOB_ERROR_CODES = [
  "too_many_jobs",
  "generation_failed",
  "storage_failed",
  "timed_out",
  "enqueue_failed",
  "poll_failed",
  "insufficient_balance",
  "insufficient_funds",
  "no_subscription",
  "already_generating",
  "reference_unavailable",
  "invalid_request",
  "cost_unreported",
] as const;

export type JobErrorCode = (typeof JOB_ERROR_CODES)[number] | "unknown";

export function jobErrorCode(code: string | undefined): JobErrorCode {
  return (JOB_ERROR_CODES as readonly string[]).includes(code ?? "") ? (code as JobErrorCode) : "unknown";
}
