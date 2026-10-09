import { describe, expect, it } from "vitest";

import de from "./messages/de.json";
import en from "./messages/en.json";
import es from "./messages/es.json";
import pt from "./messages/pt.json";

const locales = { pt, en, es, de } as Record<string, unknown>;

function lookup(messages: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (node, segment) => (node && typeof node === "object" ? (node as Record<string, unknown>)[segment] : undefined),
    messages,
  );
}

const toastKeys = [
  "agents.detail.toast.idCopied",
  "whatsappCampaignsPage.detail.toast.updatedName",
  "adminBalancePage.form.error.exchangeRateNotLoaded",
];

describe("toast copy that sonner now shows", () => {
  it.each(Object.keys(locales))("is translated in %s", (locale) => {
    for (const key of toastKeys) {
      const value = lookup(locales[locale], key);
      expect(typeof value, `${locale}: ${key}`).toBe("string");
      expect((value as string).trim(), `${locale}: ${key}`).not.toBe("");
    }
  });

  it.each(Object.keys(locales))("names the campaign in the update toast in %s", (locale) => {
    expect(lookup(locales[locale], "whatsappCampaignsPage.detail.toast.updatedName")).toContain("{name}");
  });
});
