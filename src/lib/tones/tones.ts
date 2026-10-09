export const TONE_KEYS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "neutral"] as const;

export type ToneKey = (typeof TONE_KEYS)[number];

export interface ToneStyle {
  token: string;
  hollow: boolean;
}

const NEUTRAL_TOKEN = "--muted-foreground";
const SELECTION_SAFE_TOKENS: Partial<Record<ToneKey, string>> = { "chart-1": "--foreground" };

export function isToneKey(value: unknown): value is ToneKey {
  return typeof value === "string" && (TONE_KEYS as readonly string[]).includes(value);
}

export function toneStyle(tone: ToneKey): ToneStyle {
  if (tone === "neutral") return { token: NEUTRAL_TOKEN, hollow: true };
  return { token: SELECTION_SAFE_TOKENS[tone] ?? `--${tone}`, hollow: false };
}

export function cssTokenColor(token: string, alpha?: number): string {
  return alpha === undefined ? `hsl(var(${token}))` : `hsl(var(${token}) / ${alpha})`;
}

export function toneCssColor(tone: ToneKey): string {
  return cssTokenColor(toneStyle(tone).token);
}
