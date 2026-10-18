import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import deMessages from "@/i18n/messages/de.json";
import { TEMPLATE_ERROR_CODES, templateEditErrorMessage, templateErrorMessage } from "./errors";

type Messages = { whatsappTemplates: { errors: Record<string, string>; contentEdit: { windowUntil: string } } };

const locales: [string, Messages][] = [
  ["pt", ptMessages as unknown as Messages],
  ["en", enMessages as unknown as Messages],
  ["es", esMessages as unknown as Messages],
  ["de", deMessages as unknown as Messages],
];

describe("TEMPLATE_ERROR_CODES", () => {
  it("has a message for every code in every locale", () => {
    for (const [locale, messages] of locales) {
      for (const code of TEMPLATE_ERROR_CODES) {
        expect(messages.whatsappTemplates.errors[code], `${locale}: ${code}`).toBeTruthy();
      }
    }
  });

  it("knows the quote refusal", () => {
    expect(TEMPLATE_ERROR_CODES).toContain("template_quote_out_of_range");
  });

  it("knows every refusal of a content edit", () => {
    for (const code of [
      "template_access_denied",
      "template_edit_not_owner",
      "template_in_use",
      "template_not_editable",
      "template_edit_category_locked",
      "template_edit_unsupported",
      "template_edit_window",
      "template_provider_rejected",
    ]) {
      expect(TEMPLATE_ERROR_CODES).toContain(code);
    }
  });

  it("says when the next edit is allowed in every locale", () => {
    for (const [locale, messages] of locales) {
      expect(messages.whatsappTemplates.contentEdit.windowUntil, locale).toContain("{when}");
    }
  });
});

const known = new Set(["templateExit.errors.button_action_stale"]);
const t = Object.assign((key: string, values?: Record<string, string>) => (values ? `${key} ${JSON.stringify(values)}` : key), {
  has: (key: string) => known.has(key),
});

describe("templateErrorMessage", () => {
  it("localizes the button action refusals the exit guard writes", () => {
    expect(templateErrorMessage(t, "button_action_stale", "stale")).toBe("templateExit.errors.button_action_stale");
  });

  it("keeps the server message for a code nobody knows", () => {
    expect(templateErrorMessage(t, "something_new", "Something new")).toBe("Something new");
  });
});

describe("templateEditErrorMessage", () => {
  const when = (at: Date) => at.toISOString();

  it("says when the next edit is allowed", () => {
    const message = templateEditErrorMessage(t, { code: "template_edit_window", error: "window", expected: { nextEditAt: "2026-10-18T09:30:00Z" } }, when);
    expect(message).toBe(`whatsappTemplates.contentEdit.windowUntil ${JSON.stringify({ when: "2026-10-18T09:30:00.000Z" })}`);
  });

  it("falls back to the plain window message without a readable time", () => {
    expect(templateEditErrorMessage(t, { code: "template_edit_window", error: "window", expected: { nextEditAt: "soon" } }, when)).toBe(
      "whatsappTemplates.errors.template_edit_window",
    );
    expect(templateEditErrorMessage(t, { code: "template_edit_window", error: "window" }, when)).toBe("whatsappTemplates.errors.template_edit_window");
  });

  it("localizes the other refusals and keeps Meta's own words", () => {
    expect(templateEditErrorMessage(t, { code: "template_in_use", error: "busy" }, when)).toBe("whatsappTemplates.errors.template_in_use");
    expect(templateEditErrorMessage(t, { code: "template_provider_rejected", error: "Invalid parameter" }, when)).toBe("Invalid parameter");
  });
});
