export interface SafeZone {
  top: number;
  bottom: number;
  side: number;
}

export const FEED_MEDIA_RATIO = "4 / 5";
export const CAROUSEL_CARD_RATIO = "1 / 1";
export const STORY_RATIO = "9 / 16";

export const STORY_SAFE_ZONE: SafeZone = { top: 0.14, bottom: 0.35, side: 0.06 };

export const TEXT_LIMITS = {
  feed: { headline: 40, description: 30 },
  carousel: { primaryText: 80, headline: 20, description: 18 },
} as const;

export const PREVIEW_TILE_WIDTH = 280;
export const PREVIEW_TILE_ZOOM = 0.55;

export interface ClippedText {
  text: string;
  clipped: boolean;
}

const WORD_BREAK_FLOOR = 0.6;

export function clipText(value: string | undefined, limit: number): ClippedText {
  const clean = (value ?? "").trim();
  if (clean.length <= limit) return { text: clean, clipped: false };
  const cut = clean.slice(0, limit);
  const lastSpace = cut.search(/\s\S*$/);
  const atWord = lastSpace >= Math.floor(limit * WORD_BREAK_FLOOR) ? cut.slice(0, lastSpace) : cut;
  return { text: atWord.replace(/[\s.,;:!?-]+$/, ""), clipped: true };
}

export function safeZoneInsets(zone: SafeZone): { top: string; bottom: string; left: string; right: string } {
  const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;
  return { top: percent(zone.top), bottom: percent(zone.bottom), left: percent(zone.side), right: percent(zone.side) };
}
