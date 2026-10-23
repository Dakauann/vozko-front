import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

const API_KEY_CODES = [
  "api_key_missing",
  "api_key_invalid",
  "api_key_revoked",
  "api_key_scope_missing",
  "api_key_unavailable",
  "api_key_rate_limited",
  "api_key_name_invalid",
  "api_key_scopes_invalid",
  "api_key_limit_reached",
  "api_key_not_found",
  "api_key_cache_unavailable",
  "api_keys_failed",
  "default",
];

const CATALOGS = { pt, en, es, de } as const;

describe("API key error copy", () => {
  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    it(`translates every API key refusal in ${locale}, without dashes`, () => {
      const errors = (catalog.apiKeys as { errors: Record<string, unknown> }).errors;
      const missing = API_KEY_CODES.filter((code) => typeof errors[code] !== "string" || (errors[code] as string).trim() === "");
      expect(missing).toEqual([]);
      expect(API_KEY_CODES.filter((code) => /[–—]/.test(String(errors[code])))).toEqual([]);
    });
  }
});
