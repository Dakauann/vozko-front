import { describe, expect, it } from "vitest";

import de from "./messages/de.json";
import en from "./messages/en.json";
import es from "./messages/es.json";
import pt from "./messages/pt.json";
import { BRAND_PHRASE_TOKENS } from "@/lib/branding/brand-phrases";
import { flattenCatalog } from "@/test/message-catalog";

const CATALOGS: Record<string, unknown> = { pt, en, es, de };

const FIXED_ARTICLE_BEFORE_BRAND: Record<string, RegExp> = {
  pt: /(?<![\p{L}\p{N}])(o|a|os|as|do|da|dos|das|no|na|nos|nas|ao|à|aos|às|pelo|pela|um|uma|num|numa)\s+\{brandName\}/iu,
  es: /(?<![\p{L}\p{N}])(el|la|los|las|del|al|un|una)\s+\{brandName\}/iu,
};

const LOCALES_WITH_BRAND_PHRASES = new Set(["pt", "es"]);

function stringsOf(locale: string): [string, string][] {
  return [...flattenCatalog(CATALOGS[locale])].filter((entry): entry is [string, string] => typeof entry[1] === "string");
}

describe("brand articles in the catalogs", () => {
  it.each(Object.keys(FIXED_ARTICLE_BEFORE_BRAND))(
    "never types an article before {brandName} in %s, so the configured gender decides it",
    (locale) => {
      const pattern = FIXED_ARTICLE_BEFORE_BRAND[locale];
      const offenders = stringsOf(locale)
        .filter(([, value]) => pattern.test(value))
        .map(([key, value]) => `${key}: ${value.match(pattern)?.[0]}`);
      expect(offenders).toEqual([]);
    },
  );

  it.each(Object.keys(CATALOGS).filter((locale) => !LOCALES_WITH_BRAND_PHRASES.has(locale)))(
    "uses no article phrase token in %s, which names the brand without one",
    (locale) => {
      const offenders = stringsOf(locale)
        .filter(([, value]) => BRAND_PHRASE_TOKENS.some((token) => value.includes(token)))
        .map(([key]) => key);
      expect(offenders).toEqual([]);
    },
  );

  it.each(Object.keys(CATALOGS))("never types the brand name into %s instead of reading it from the brand config", (locale) => {
    const offenders = stringsOf(locale)
      .filter(([, value]) => /\bVozko\b/i.test(value))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });
});
