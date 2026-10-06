export const FONT_IDS = [
  "inter",
  "roboto",
  "open-sans",
  "montserrat",
  "poppins",
  "lato",
  "nunito",
  "raleway",
  "oswald",
  "playfair-display",
  "merriweather",
  "bebas-neue",
  "dm-sans",
  "work-sans",
] as const;

export type FontId = (typeof FONT_IDS)[number];

export interface StudioFont {
  family: string;
  weights: readonly number[];
  italic: boolean;
}

const FULL_RANGE = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

export const STUDIO_FONTS: Record<FontId, StudioFont> = {
  inter: { family: "Inter", weights: FULL_RANGE, italic: true },
  roboto: { family: "Roboto", weights: FULL_RANGE, italic: true },
  "open-sans": { family: "Open Sans", weights: [300, 400, 500, 600, 700, 800], italic: true },
  montserrat: { family: "Montserrat", weights: FULL_RANGE, italic: true },
  poppins: { family: "Poppins", weights: FULL_RANGE, italic: true },
  lato: { family: "Lato", weights: [100, 300, 400, 700, 900], italic: true },
  nunito: { family: "Nunito", weights: [200, 300, 400, 500, 600, 700, 800, 900], italic: true },
  raleway: { family: "Raleway", weights: FULL_RANGE, italic: true },
  oswald: { family: "Oswald", weights: [200, 300, 400, 500, 600, 700], italic: false },
  "playfair-display": { family: "Playfair Display", weights: [400, 500, 600, 700, 800, 900], italic: true },
  merriweather: { family: "Merriweather", weights: [300, 400, 500, 600, 700, 800, 900], italic: true },
  "bebas-neue": { family: "Bebas Neue", weights: [400], italic: false },
  "dm-sans": { family: "DM Sans", weights: FULL_RANGE, italic: true },
  "work-sans": { family: "Work Sans", weights: FULL_RANGE, italic: true },
};

export const DEFAULT_FONT_ID: FontId = "inter";
export const DEFAULT_FONT_WEIGHT = 400;

export function isFontId(value: unknown): value is FontId {
  return typeof value === "string" && (FONT_IDS as readonly string[]).includes(value);
}

export function nearestFontWeight(fontId: FontId, weight: number): number {
  const { weights } = STUDIO_FONTS[fontId];
  return weights.reduce((best, candidate) => (Math.abs(candidate - weight) < Math.abs(best - weight) ? candidate : best), weights[0]);
}

export function fontStyleOf(fontId: FontId, weight: number, italic: boolean): { weight: number; italic: boolean } {
  return { weight: nearestFontWeight(fontId, weight), italic: italic && STUDIO_FONTS[fontId].italic };
}

export function cssFontOf(fontId: FontId, weight: number, italic: boolean, sizePx: number): string {
  const style = fontStyleOf(fontId, weight, italic);
  return `${style.italic ? "italic " : ""}${style.weight} ${sizePx}px "${STUDIO_FONTS[fontId].family}"`;
}
