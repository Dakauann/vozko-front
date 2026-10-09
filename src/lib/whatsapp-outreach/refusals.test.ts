import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import deMessages from "@/i18n/messages/de.json";

import { OUTREACH_REFUSAL_CODES, isRetryableQuoteRefusal, isTemplateSendRefusal, outreachRefusalKey } from "./refusals";

describe("outreachRefusalKey", () => {
  it.each([
    ["lead_opted_out", "errors.lead_opted_out"],
    ["lead_blocked", "errors.lead_blocked"],
    ["send_outcome_unknown", "errors.send_outcome_unknown"],
    ["conversation_not_found", "errors.conversation_not_found"],
    ["quote_out_of_range", "errors.quote_out_of_range"],
    ["quote_unavailable", "errors.quote_unavailable"],
  ])("names the copy of %s", (code, key) => {
    expect(outreachRefusalKey(code)).toBe(key);
  });

  it("answers the generic failure for the WS fallback code and for codes it does not know", () => {
    expect(outreachRefusalKey("template_send_failed")).toBe("errors.send_failed");
    expect(outreachRefusalKey("something_new")).toBe("errors.send_failed");
    expect(outreachRefusalKey(undefined)).toBe("errors.send_failed");
  });

  it("answers the caller's fallback for an unknown code", () => {
    expect(outreachRefusalKey("scope_unavailable", "quote_unavailable")).toBe("errors.quote_unavailable");
  });

  it.each([
    ["pt", ptMessages],
    ["en", enMessages],
    ["es", esMessages],
    ["de", deMessages],
  ])("has copy for every refusal in %s", (_locale, messages) => {
    const errors = (messages as { whatsappOutreach: { errors: Record<string, string> } }).whatsappOutreach.errors;
    for (const code of OUTREACH_REFUSAL_CODES) {
      expect(errors[code], code).toBeTruthy();
    }
  });
});

describe("isTemplateSendRefusal", () => {
  it("recognises a reopen window refusal by its entry and the missing status", () => {
    expect(isTemplateSendRefusal({ code: "lead_opted_out", message: "x", entry_id: "e-1", entry_type: "whatsapp" })).toBe(true);
  });

  it("leaves status change refusals and entry-less errors alone", () => {
    expect(
      isTemplateSendRefusal({ code: "forbidden", message: "x", entry_id: "e-1", entry_type: "whatsapp", status: "finished" }),
    ).toBe(false);
    expect(isTemplateSendRefusal({ code: "insufficient_balance", message: "x" })).toBe(false);
  });
});

describe("isRetryableQuoteRefusal", () => {
  it.each([["quote_unavailable"], ["scope_unavailable"], [undefined]])("offers another try for %s, which reads as unavailable", (code) => {
    expect(isRetryableQuoteRefusal(code)).toBe(true);
  });

  it.each([["quote_out_of_range"], ["pricing_unavailable"], ["forbidden"], ["not_found"]])(
    "offers no retry for %s, which would answer the same",
    (code) => {
      expect(isRetryableQuoteRefusal(code)).toBe(false);
    },
  );
});
