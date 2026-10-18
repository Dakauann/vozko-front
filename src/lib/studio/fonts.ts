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
  "manrope",
  "rubik",
  "space-grotesk",
  "outfit",
  "plus-jakarta-sans",
  "josefin-sans",
  "lora",
  "eb-garamond",
  "libre-baskerville",
  "cormorant-garamond",
  "fraunces",
  "dm-serif-display",
  "anton",
  "archivo-black",
  "alfa-slab-one",
  "bungee",
  "righteous",
  "lobster",
  "titan-one",
  "creepster",
  "abril-fatface",
  "fredoka",
  "staatliches",
  "pacifico",
  "dancing-script",
  "caveat",
  "great-vibes",
  "kaushan-script",
  "sacramento",
  "amatic-sc",
  "shadows-into-light",
  "jetbrains-mono",
  "space-mono",
  "ibm-plex-mono",
  "roboto-mono",
  "dm-mono",
] as const;

export type FontId = (typeof FONT_IDS)[number];

export const FONT_CATEGORIES = ["sans", "serif", "display", "handwriting", "mono"] as const;

export type FontCategory = (typeof FONT_CATEGORIES)[number];

interface StudioFont {
  family: string;
  category: FontCategory;
  weights: readonly number[];
  italic: boolean;
}

const FULL_RANGE = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
const REGULAR = [400] as const;

export const STUDIO_FONTS: Record<FontId, StudioFont> = {
  inter: { family: "Inter", category: "sans", weights: FULL_RANGE, italic: true },
  roboto: { family: "Roboto", category: "sans", weights: FULL_RANGE, italic: true },
  "open-sans": { family: "Open Sans", category: "sans", weights: [300, 400, 500, 600, 700, 800], italic: true },
  montserrat: { family: "Montserrat", category: "sans", weights: FULL_RANGE, italic: true },
  poppins: { family: "Poppins", category: "sans", weights: FULL_RANGE, italic: true },
  lato: { family: "Lato", category: "sans", weights: [100, 300, 400, 700, 900], italic: true },
  nunito: { family: "Nunito", category: "sans", weights: [200, 300, 400, 500, 600, 700, 800, 900], italic: true },
  raleway: { family: "Raleway", category: "sans", weights: FULL_RANGE, italic: true },
  oswald: { family: "Oswald", category: "display", weights: [200, 300, 400, 500, 600, 700], italic: false },
  "playfair-display": { family: "Playfair Display", category: "serif", weights: [400, 500, 600, 700, 800, 900], italic: true },
  merriweather: { family: "Merriweather", category: "serif", weights: [300, 400, 500, 600, 700, 800, 900], italic: true },
  "bebas-neue": { family: "Bebas Neue", category: "display", weights: REGULAR, italic: false },
  "dm-sans": { family: "DM Sans", category: "sans", weights: FULL_RANGE, italic: true },
  "work-sans": { family: "Work Sans", category: "sans", weights: FULL_RANGE, italic: true },
  manrope: { family: "Manrope", category: "sans", weights: [200, 300, 400, 500, 600, 700, 800], italic: false },
  rubik: { family: "Rubik", category: "sans", weights: [300, 400, 500, 600, 700, 800, 900], italic: true },
  "space-grotesk": { family: "Space Grotesk", category: "sans", weights: [300, 400, 500, 600, 700], italic: false },
  outfit: { family: "Outfit", category: "sans", weights: FULL_RANGE, italic: false },
  "plus-jakarta-sans": { family: "Plus Jakarta Sans", category: "sans", weights: [200, 300, 400, 500, 600, 700, 800], italic: true },
  "josefin-sans": { family: "Josefin Sans", category: "sans", weights: [100, 200, 300, 400, 500, 600, 700], italic: true },
  lora: { family: "Lora", category: "serif", weights: [400, 500, 600, 700], italic: true },
  "eb-garamond": { family: "EB Garamond", category: "serif", weights: [400, 500, 600, 700, 800], italic: true },
  "libre-baskerville": { family: "Libre Baskerville", category: "serif", weights: [400, 500, 600, 700], italic: true },
  "cormorant-garamond": { family: "Cormorant Garamond", category: "serif", weights: [300, 400, 500, 600, 700], italic: true },
  fraunces: { family: "Fraunces", category: "serif", weights: FULL_RANGE, italic: true },
  "dm-serif-display": { family: "DM Serif Display", category: "serif", weights: REGULAR, italic: true },
  anton: { family: "Anton", category: "display", weights: REGULAR, italic: false },
  "archivo-black": { family: "Archivo Black", category: "display", weights: REGULAR, italic: false },
  "alfa-slab-one": { family: "Alfa Slab One", category: "display", weights: REGULAR, italic: false },
  bungee: { family: "Bungee", category: "display", weights: REGULAR, italic: false },
  righteous: { family: "Righteous", category: "display", weights: REGULAR, italic: false },
  lobster: { family: "Lobster", category: "display", weights: REGULAR, italic: false },
  "titan-one": { family: "Titan One", category: "display", weights: REGULAR, italic: false },
  creepster: { family: "Creepster", category: "display", weights: REGULAR, italic: false },
  "abril-fatface": { family: "Abril Fatface", category: "display", weights: REGULAR, italic: false },
  fredoka: { family: "Fredoka", category: "display", weights: [300, 400, 500, 600, 700], italic: false },
  staatliches: { family: "Staatliches", category: "display", weights: REGULAR, italic: false },
  pacifico: { family: "Pacifico", category: "handwriting", weights: REGULAR, italic: false },
  "dancing-script": { family: "Dancing Script", category: "handwriting", weights: [400, 500, 600, 700], italic: false },
  caveat: { family: "Caveat", category: "handwriting", weights: [400, 500, 600, 700], italic: false },
  "great-vibes": { family: "Great Vibes", category: "handwriting", weights: REGULAR, italic: false },
  "kaushan-script": { family: "Kaushan Script", category: "handwriting", weights: REGULAR, italic: false },
  sacramento: { family: "Sacramento", category: "handwriting", weights: REGULAR, italic: false },
  "amatic-sc": { family: "Amatic SC", category: "handwriting", weights: [400, 700], italic: false },
  "shadows-into-light": { family: "Shadows Into Light", category: "handwriting", weights: REGULAR, italic: false },
  "jetbrains-mono": { family: "JetBrains Mono", category: "mono", weights: [100, 200, 300, 400, 500, 600, 700, 800], italic: true },
  "space-mono": { family: "Space Mono", category: "mono", weights: [400, 700], italic: true },
  "ibm-plex-mono": { family: "IBM Plex Mono", category: "mono", weights: [100, 200, 300, 400, 500, 600, 700], italic: true },
  "roboto-mono": { family: "Roboto Mono", category: "mono", weights: [100, 200, 300, 400, 500, 600, 700], italic: true },
  "dm-mono": { family: "DM Mono", category: "mono", weights: [300, 400, 500], italic: true },
};

export function fontsIn(category: FontCategory): FontId[] {
  return FONT_IDS.filter((id) => STUDIO_FONTS[id].category === category);
}

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
