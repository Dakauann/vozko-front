import type { UtmParams } from "./types";

const UTM_KEYS: Array<[keyof UtmParams, string]> = [
  ["source", "utm_source"],
  ["medium", "utm_medium"],
  ["campaign", "utm_campaign"],
  ["term", "utm_term"],
  ["content", "utm_content"],
];

export function appendUtm(rawUrl: string, utm: UtmParams): string {
  const trimmed = rawUrl.trim();
  const hasUtm = UTM_KEYS.some(([key]) => (utm[key] ?? "").trim() !== "");
  if (!hasUtm || trimmed === "") {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    for (const [key, param] of UTM_KEYS) {
      const value = (utm[key] ?? "").trim();
      if (value !== "") {
        url.searchParams.set(param, value);
      }
    }
    return url.toString();
  } catch {
    return trimmed;
  }
}
