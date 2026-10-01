export type AdPlatform = "facebook" | "instagram";

export interface AdOrigin {
  platform: AdPlatform | null;
  title: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function webAddress(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function adOriginOf(raw: unknown): AdOrigin | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const title = text(data.title);
  if (!title && !text(data.adId)) return null;
  const platform = data.platform === "facebook" || data.platform === "instagram" ? data.platform : null;
  const image = data.image && typeof data.image === "object" ? (data.image as Record<string, unknown>) : null;
  return {
    platform,
    title,
    sourceUrl: webAddress(data.sourceUrl),
    imageUrl: webAddress(image?.url),
  };
}
