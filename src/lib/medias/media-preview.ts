export type MediaKind = "image" | "video" | "audio" | "document";

export type MediaDetail = "glance" | "full";

export interface MediaSources {
  url: string;
  previewUrl: string;
}

export type MediaVisual =
  | { element: "img"; src: string; priority: "low" | "auto" }
  | { element: "video"; src: string; poster: string }
  | { element: "audio" }
  | { element: "document" }
  | { element: "placeholder" };

const URL_TYPES: [RegExp, string][] = [
  [/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i, "image"],
  [/\.(mp4|webm|mov)$/i, "video"],
  [/\.(mp3|wav|ogg|m4a|opus)$/i, "audio"],
  [/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv)$/i, "document"],
];

export function mediaTypeFromUrl(url: string): string {
  const path = url.split(/[?#]/)[0];
  return URL_TYPES.find(([pattern]) => pattern.test(path))?.[1] ?? "";
}

export function mediaKindOf(type: string): MediaKind {
  const normalized = type.toLowerCase();
  if (normalized.includes("image") || normalized === "sticker") return "image";
  if (normalized.includes("video")) return "video";
  if (normalized.includes("audio")) return "audio";
  return "document";
}

function imageThumbnail(previewUrl: string): string {
  return previewUrl && mediaTypeFromUrl(previewUrl) !== "video" ? previewUrl : "";
}

function imagePriority(detail: MediaDetail): "low" | "auto" {
  return detail === "glance" ? "low" : "auto";
}

export function mediaVisual(detail: MediaDetail, kind: MediaKind, sources: MediaSources): MediaVisual {
  if (kind === "audio") return { element: "audio" };
  if (kind === "document") return { element: "document" };
  if (kind === "image") {
    const src = sources.previewUrl || sources.url;
    return src ? { element: "img", src, priority: imagePriority(detail) } : { element: "placeholder" };
  }
  const poster = sources.previewUrl !== sources.url ? imageThumbnail(sources.previewUrl) : "";
  if (detail === "glance" && poster) return { element: "img", src: poster, priority: imagePriority(detail) };
  return sources.url ? { element: "video", src: sources.url, poster } : { element: "placeholder" };
}
