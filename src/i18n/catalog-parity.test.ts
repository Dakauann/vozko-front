import { describe, expect, it } from "vitest";

import de from "./messages/de.json";
import en from "./messages/en.json";
import es from "./messages/es.json";
import pt from "./messages/pt.json";
import { BRAND_PHRASE_TOKENS } from "@/lib/branding/brand-phrases";
import { flattenCatalog, messageArguments } from "@/test/message-catalog";

const REFERENCE = "pt";
const CATALOGS: Record<string, unknown> = { pt, en, es, de };
const FLAT = Object.fromEntries(Object.entries(CATALOGS).map(([locale, catalog]) => [locale, flattenCatalog(catalog)]));
const OTHERS = Object.keys(CATALOGS).filter((locale) => locale !== REFERENCE);

const BRAND_PHRASE_ARGUMENTS = new Set(BRAND_PHRASE_TOKENS.map((token) => token.slice(1, -1)));

function comparableArguments(message: string): string {
  const names = messageArguments(message).map((name) => (BRAND_PHRASE_ARGUMENTS.has(name) ? "brandName" : name));
  return [...new Set(names)].sort().join(", ");
}

function keysOnlyIn(locale: string, other: string): string[] {
  return [...FLAT[locale].keys()].filter((key) => !FLAT[other].has(key)).sort();
}

describe("messageArguments", () => {
  it("reads simple, formatted and nested plural arguments", () => {
    expect(messageArguments("Olá {name}, você tem {count, plural, =0 {nada} one {# item de {owner}} other {# itens}}")).toEqual([
      "count",
      "name",
      "owner",
    ]);
  });

  it("reads select branches and number formats", () => {
    expect(messageArguments("{gender, select, female {Ela pagou {amount, number}} other {Pagou {amount, number}}}")).toEqual([
      "amount",
      "gender",
    ]);
  });

  it("ignores quoted braces and plain text", () => {
    expect(messageArguments("Use '{name}' literally, it''s {real}")).toEqual(["real"]);
    expect(messageArguments("Sem variáveis")).toEqual([]);
  });
});

describe("message catalogs", () => {
  it.each(OTHERS)(`has every ${REFERENCE} key in %s`, (locale) => {
    expect(keysOnlyIn(REFERENCE, locale)).toEqual([]);
  });

  it.each(OTHERS)(`has no key in %s that ${REFERENCE} lacks`, (locale) => {
    expect(keysOnlyIn(locale, REFERENCE)).toEqual([]);
  });

  it.each(OTHERS)(`uses the same placeholders as ${REFERENCE} in %s`, (locale) => {
    const mismatches: string[] = [];
    for (const [key, value] of FLAT[REFERENCE]) {
      const other = FLAT[locale].get(key);
      if (typeof value !== "string" || typeof other !== "string") continue;
      const expected = comparableArguments(value);
      const actual = comparableArguments(other);
      if (expected !== actual) mismatches.push(`${key}: ${REFERENCE} [${expected}] vs ${locale} [${actual}]`);
    }
    expect(mismatches).toEqual([]);
  });
});
