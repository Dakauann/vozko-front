import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

import { CHOICE_STATS_ERROR_CODES } from "./error-codes";

const CATALOGS: Record<string, unknown> = { pt, en, es, de };
const BACKEND_GOLDEN = resolve(__dirname, "../../../../vozko-back/delivery/http/choicestatshttp/testdata/choice_stats_error_codes.golden");

function errorsOf(messages: unknown): Record<string, unknown> {
  const scope = (messages as Record<string, Record<string, unknown> | undefined>).choiceStats;
  return (scope?.errors ?? {}) as Record<string, unknown>;
}

function goldenCodes(): string[] {
  const codes = readFileSync(BACKEND_GOLDEN, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return [...new Set(codes)].sort();
}

describe("choice stats error codes", () => {
  it("lists every code once and sorted", () => {
    expect([...CHOICE_STATS_ERROR_CODES].sort()).toEqual([...CHOICE_STATS_ERROR_CODES]);
    expect(new Set(CHOICE_STATS_ERROR_CODES).size).toBe(CHOICE_STATS_ERROR_CODES.length);
  });

  it.each(Object.keys(CATALOGS))("translates every code in %s", (locale) => {
    const errors = errorsOf(CATALOGS[locale]);
    const missing = CHOICE_STATS_ERROR_CODES.filter((code) => typeof errors[code] !== "string" || !(errors[code] as string).trim());
    expect(missing).toEqual([]);
  });

  it.skipIf(!existsSync(BACKEND_GOLDEN))("matches the codes the backend declares in its golden file", () => {
    expect([...CHOICE_STATS_ERROR_CODES]).toEqual(goldenCodes());
  });
});
