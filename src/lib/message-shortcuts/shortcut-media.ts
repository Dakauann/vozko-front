export type MediaFetcher = (url: string, init: RequestInit) => Promise<Response>;

const FALLBACK_CONTENT_TYPE: Record<string, string> = {
  image: "image/jpeg",
  video: "video/mp4",
  audio: "audio/mpeg",
};

const FALLBACK_NAME = "atalho";

function downloadableUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function fileNameOf(url: URL): string {
  const lastSegment = url.pathname.split("/").filter(Boolean).at(-1);
  if (!lastSegment) return FALLBACK_NAME;
  try {
    return decodeURIComponent(lastSegment);
  } catch {
    return lastSegment;
  }
}

export async function fileFromShortcutMedia(rawUrl: string, mediaType: string | undefined, fetcher: MediaFetcher): Promise<File | null> {
  const url = downloadableUrl(rawUrl);
  if (!url) return null;
  try {
    const response = await fetcher(rawUrl, { credentials: "omit" });
    if (!response.ok) return null;
    const blob = await response.blob();
    const type = blob.type || FALLBACK_CONTENT_TYPE[mediaType ?? ""] || "application/octet-stream";
    return new File([blob], fileNameOf(url), { type });
  } catch {
    return null;
  }
}
