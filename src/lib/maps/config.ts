export const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

export type MapStyleConfigError = "not_https" | "invalid_url";

export type MapStyleSetting = { ok: true; url: string } | { ok: false; reason: MapStyleConfigError };

function isSameOriginPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\");
}

export function resolveMapStyleUrl(configured: string | undefined): MapStyleSetting {
  const value = configured?.trim();
  if (!value) return { ok: true, url: DEFAULT_MAP_STYLE_URL };
  if (isSameOriginPath(value)) return { ok: true, url: value };
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (parsed.protocol === "https:") return { ok: true, url: value };
  if (parsed.protocol === "http:") return { ok: false, reason: "not_https" };
  return { ok: false, reason: "invalid_url" };
}

export function mapStyleSetting(): MapStyleSetting {
  return resolveMapStyleUrl(process.env.NEXT_PUBLIC_MAP_STYLE_URL);
}
