export type BrandGender = "feminine" | "masculine";

const PHRASE_NAMES = ["theBrand", "ofBrand", "inBrand", "toBrand", "byBrand", "aBrand"] as const;
type PhraseName = (typeof PHRASE_NAMES)[number];
type ArticleForms = Record<PhraseName, string>;

const ARTICLE_FORMS: Partial<Record<string, Record<BrandGender, ArticleForms>>> = {
  pt: {
    feminine: { theBrand: "a", ofBrand: "da", inBrand: "na", toBrand: "à", byBrand: "pela", aBrand: "uma" },
    masculine: { theBrand: "o", ofBrand: "do", inBrand: "no", toBrand: "ao", byBrand: "pelo", aBrand: "um" },
  },
  es: {
    feminine: { theBrand: "la", ofBrand: "de la", inBrand: "en la", toBrand: "a la", byBrand: "por la", aBrand: "una" },
    masculine: { theBrand: "el", ofBrand: "del", inBrand: "en el", toBrand: "al", byBrand: "por el", aBrand: "un" },
  },
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const BRAND_PHRASE_TOKENS: readonly string[] = PHRASE_NAMES.flatMap((name) => [
  `{${name}}`,
  `{${capitalize(name)}}`,
]);

export function parseBrandGender(raw: string | undefined): BrandGender | null {
  const normalized = raw?.trim().toLowerCase();
  return normalized === "feminine" || normalized === "masculine" ? normalized : null;
}

export function brandPhraseTokens(name: string, gender: BrandGender, locale: string): Record<string, string> {
  const forms = ARTICLE_FORMS[locale]?.[gender];
  if (!forms) return {};
  const tokens: Record<string, string> = {};
  for (const phrase of PHRASE_NAMES) {
    const text = `${forms[phrase]} ${name}`;
    tokens[`{${phrase}}`] = text;
    tokens[`{${capitalize(phrase)}}`] = capitalize(text);
  }
  return tokens;
}
