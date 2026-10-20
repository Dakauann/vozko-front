import { describe, expect, it } from "vitest";

import { BRAND_PHRASE_TOKENS, brandPhraseTokens, parseBrandGender } from "./brand-phrases";

describe("parseBrandGender", () => {
  it.each([
    ["feminine", "feminine"],
    ["masculine", "masculine"],
    ["  Feminine ", "feminine"],
  ])("accepts %j as a configured gender", (raw, expected) => {
    expect(parseBrandGender(raw)).toBe(expected);
  });

  it.each([undefined, "", "neutral", "f", "a"])("refuses %j instead of picking a gender", (raw) => {
    expect(parseBrandGender(raw)).toBeNull();
  });
});

describe("brandPhraseTokens", () => {
  it("contracts the Portuguese article with a feminine brand", () => {
    expect(brandPhraseTokens("Acme", "feminine", "pt")).toEqual({
      "{theBrand}": "a Acme",
      "{ofBrand}": "da Acme",
      "{inBrand}": "na Acme",
      "{toBrand}": "à Acme",
      "{byBrand}": "pela Acme",
      "{aBrand}": "uma Acme",
      "{TheBrand}": "A Acme",
      "{OfBrand}": "Da Acme",
      "{InBrand}": "Na Acme",
      "{ToBrand}": "À Acme",
      "{ByBrand}": "Pela Acme",
      "{ABrand}": "Uma Acme",
    });
  });

  it("contracts the Portuguese article with a masculine brand", () => {
    expect(brandPhraseTokens("Acme", "masculine", "pt")).toMatchObject({
      "{theBrand}": "o Acme",
      "{ofBrand}": "do Acme",
      "{inBrand}": "no Acme",
      "{toBrand}": "ao Acme",
      "{byBrand}": "pelo Acme",
      "{aBrand}": "um Acme",
      "{TheBrand}": "O Acme",
    });
  });

  it("contracts the Spanish article with each gender", () => {
    expect(brandPhraseTokens("Acme", "feminine", "es")).toMatchObject({
      "{theBrand}": "la Acme",
      "{ofBrand}": "de la Acme",
      "{inBrand}": "en la Acme",
      "{toBrand}": "a la Acme",
      "{byBrand}": "por la Acme",
      "{aBrand}": "una Acme",
      "{TheBrand}": "La Acme",
    });
    expect(brandPhraseTokens("Acme", "masculine", "es")).toMatchObject({
      "{theBrand}": "el Acme",
      "{ofBrand}": "del Acme",
      "{inBrand}": "en el Acme",
      "{toBrand}": "al Acme",
      "{byBrand}": "por el Acme",
      "{aBrand}": "un Acme",
    });
  });

  it("gives no phrases to a language whose copy names the brand without an article", () => {
    expect(brandPhraseTokens("Acme", "feminine", "en")).toEqual({});
    expect(brandPhraseTokens("Acme", "feminine", "de")).toEqual({});
  });

  it("lists every token it can produce", () => {
    expect(Object.keys(brandPhraseTokens("Acme", "feminine", "pt")).sort()).toEqual([...BRAND_PHRASE_TOKENS].sort());
  });
});
