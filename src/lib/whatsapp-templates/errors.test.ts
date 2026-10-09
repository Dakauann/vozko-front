import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import deMessages from "@/i18n/messages/de.json";
import { TEMPLATE_ERROR_CODES } from "./errors";

type Messages = { whatsappTemplates: { errors: Record<string, string> } };

describe("TEMPLATE_ERROR_CODES", () => {
  it("has a message for every code in every locale", () => {
    const locales: [string, Messages][] = [
      ["pt", ptMessages as unknown as Messages],
      ["en", enMessages as unknown as Messages],
      ["es", esMessages as unknown as Messages],
      ["de", deMessages as unknown as Messages],
    ];
    for (const [locale, messages] of locales) {
      for (const code of TEMPLATE_ERROR_CODES) {
        expect(messages.whatsappTemplates.errors[code], `${locale}: ${code}`).toBeTruthy();
      }
    }
  });

  it("knows the quote refusal", () => {
    expect(TEMPLATE_ERROR_CODES).toContain("template_quote_out_of_range");
  });
});
