import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

const BACKEND = resolve(__dirname, "../../../../vozko-back/delivery/http");
const CATALOGS: Record<string, unknown> = { pt, en, es, de };

const SCOPES = [
  { path: "googleSheets.errors", golden: "googlesheet/testdata/error_codes.golden", codes: [
    "google_account_not_connected",
    "google_sheet_account_changed",
    "google_sheet_changed",
    "google_sheet_column_archived",
    "google_sheet_failed",
    "google_sheet_google_busy",
    "google_sheet_idempotency_key_required",
    "google_sheet_invalid_definition",
    "google_sheet_invalid_value",
    "google_sheet_not_active",
    "google_sheet_not_found",
    "google_sheet_origin_required",
    "google_sheet_required_column_missing",
    "google_sheet_row_not_found",
    "google_sheet_row_too_large",
    "google_sheet_system_column",
    "google_sheet_unknown_column",
    "google_sheet_unresolved_variable",
    "google_sheet_value_not_in_options",
    "google_sheet_value_too_long",
    "google_sheet_write_access_lost",
    "google_sheet_write_account_refused",
    "google_sheet_write_google_unavailable",
    "google_sheet_write_rate_limited",
    "google_sheet_write_refused_by_google",
    "google_sheet_write_spreadsheet_missing",
    "invalid_body",
  ] },
  { path: "googleSheets.reasons", golden: "googlesheet/testdata/attention_reasons.golden", codes: [
    "access_lost",
    "account_changed",
    "google_unavailable",
    "header_mismatch",
    "sheet_full",
    "spreadsheet_missing",
  ] },
  { path: "googleAccount.errors", golden: "googleaccount/testdata/error_codes.golden", codes: [
    "expired_state",
    "google_account_authorization_declined",
    "google_account_connect_failed",
    "google_account_failed",
    "google_account_needs_reconnect",
    "google_account_not_connected",
    "google_account_scope_not_granted",
    "google_account_unknown_product",
    "invalid_state",
    "workspace_required",
  ] },
];

function scopeOf(messages: unknown, path: string): Record<string, unknown> {
  return path.split(".").reduce<Record<string, unknown>>((node, segment) => (node?.[segment] ?? {}) as Record<string, unknown>, messages as Record<string, unknown>);
}

function goldenCodes(path: string): string[] {
  return readFileSync(resolve(BACKEND, path), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

const backendPresent = SCOPES.every((scope) => existsSync(resolve(BACKEND, scope.golden)));

describe("google codes", () => {
  it.each(Object.keys(CATALOGS))("translates every code in %s", (locale) => {
    const missing = SCOPES.flatMap((scope) => {
      const texts = scopeOf(CATALOGS[locale], scope.path);
      return scope.codes.filter((code) => typeof texts[code] !== "string" || !(texts[code] as string).trim()).map((code) => `${scope.path}.${code}`);
    });
    expect(missing).toEqual([]);
  });

  it.skipIf(!backendPresent).each(SCOPES.map((scope) => [scope.path, scope] as const))("matches the %s codes the backend declares", (_, scope) => {
    expect([...scope.codes].sort()).toEqual(goldenCodes(scope.golden));
  });
});
