import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

import { EMAIL_CAMPAIGN_ERROR_CODES, EMAIL_CONSENT_ERROR_CODES, EMAIL_ERROR_CODES } from "../error-codes";
import { CAMPAIGN_STATUSES, HOLD_REASONS, LAUNCH_ISSUE_CODES, MAILBOX_FAMILIES, RECIPIENT_STATUSES, SKIP_REASONS, TEST_OUTCOMES } from "../types";

const CATALOGS = { pt, en, es, de } as const;

function lookup(catalog: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined), catalog);
}

function expectText(locale: string, catalog: unknown, path: string) {
  const value = lookup(catalog, `emailCampaigns.${path}`);
  expect(typeof value === "string" && value.trim().length > 0, `${locale} emailCampaigns.${path}`).toBe(true);
  expect(/[–—]/.test(value as string), `${locale} emailCampaigns.${path} has a dash`).toBe(false);
}

describe("emailCampaigns coded errors", () => {
  it("lists every code the campaign handler and the consent codes can return", () => {
    expect(EMAIL_CAMPAIGN_ERROR_CODES).toHaveLength(48);
    expect(EMAIL_CONSENT_ERROR_CODES).toHaveLength(13);
    expect(EMAIL_CONSENT_ERROR_CODES.every((code) => code.startsWith("email_"))).toBe(true);
  });

  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    it(`translates every code in ${locale}`, () => {
      expectText(locale, catalog, "errors.generic");
      for (const code of EMAIL_ERROR_CODES) expectText(locale, catalog, `errors.${code}`);
    });
  }
});

describe("emailCampaigns enumerations", () => {
  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    it(`labels every backend value in ${locale}`, () => {
      for (const status of CAMPAIGN_STATUSES) expectText(locale, catalog, `status.${status}`);
      for (const reason of HOLD_REASONS) expectText(locale, catalog, `hold.short.${reason}`);
      for (const reason of HOLD_REASONS) expectText(locale, catalog, `detail.hold.${reason}.title`);
      for (const key of ["status.awaitingBalance", "detail.hold.balance_insufficient.body", "detail.hold.balance_insufficient.topUp"]) expectText(locale, catalog, key);
      for (const key of ["description", "notCharged", "charged", "chargedDetail", "sent", "refunded", "refundedDetail", "toRefund", "toRefundEstimate", "final"]) expectText(locale, catalog, `detail.billing.${key}`);
      for (const key of ["firstBatch", "batchNote", "afterFirstBatch", "missingFirstBatch"]) expectText(locale, catalog, `review.cost.${key}`);
      for (const key of ["nowBody", "scheduleBody", "batches"]) expectText(locale, catalog, `send.confirm.${key}`);
      for (const reason of SKIP_REASONS) expectText(locale, catalog, `skip.${reason}`);
      for (const status of RECIPIENT_STATUSES) expectText(locale, catalog, `detail.recipients.statuses.${status}`);
      for (const family of MAILBOX_FAMILIES) expectText(locale, catalog, `detail.providers.families.${family}`);
      for (const outcome of TEST_OUTCOMES) expectText(locale, catalog, `test.outcome.${outcome}`);
      for (const code of LAUNCH_ISSUE_CODES) {
        expectText(locale, catalog, `review.check.issues.${code}.title`);
        expectText(locale, catalog, `review.check.issues.${code}.body`);
      }
    });
  }
});
