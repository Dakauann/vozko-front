import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

import { CAMPAIGN_DRAFT_ERROR_CODES, launchRefusalOf } from "./types";

const CATALOGS = { pt, en, es, de } as const;

describe("launchRefusalOf", () => {
  it("reads the comma separated codes the launch refusal sends", () => {
    expect(launchRefusalOf({ blocks: "template_not_ready,phone_unavailable", confirms: "", fingerprint: "abc" })).toEqual({
      blocks: ["template_not_ready", "phone_unavailable"],
      confirms: [],
      fingerprint: "abc",
    });
  });

  it("accepts arrays and fails closed on missing details", () => {
    expect(launchRefusalOf({ blocks: ["nothing_pending"], confirms: ["no_exit"] })).toEqual({ blocks: ["nothing_pending"], confirms: ["no_exit"], fingerprint: "" });
    expect(launchRefusalOf(undefined)).toEqual({ blocks: [], confirms: [], fingerprint: "" });
  });
});

describe("campaignWizard catalogs", () => {
  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    it(`translates every draft and launch code in ${locale}`, () => {
      const errors = catalog.campaignWizard.errors as Record<string, string>;
      for (const code of [...CAMPAIGN_DRAFT_ERROR_CODES, "generic"]) {
        expect(typeof errors[code] === "string" && errors[code].trim().length > 0, `${locale} ${code}`).toBe(true);
        expect(/[\u2013\u2014]/.test(errors[code]), `${locale} ${code} has a dash`).toBe(false);
      }
    });
  }
});
