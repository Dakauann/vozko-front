import deMessages from "@/i18n/messages/de.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import ptMessages from "@/i18n/messages/pt.json";
import { describe, expect, it } from "vitest";

function keysOf(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => keysOf(child, prefix ? `${prefix}.${key}` : key));
}

describe("campaign detail copy", () => {
  const reference = keysOf(ptMessages.campaignDetail).sort();

  it("names every piece the shared detail components read", () => {
    for (const key of ["live.perMinute", "live.processedOf", "live.remaining", "timeline.bucket.minute", "contacts.viewConversation", "stage.skippedNotOnWhatsApp", "status.RUNNING"]) {
      expect(reference).toContain(key);
    }
  });

  for (const [locale, messages] of Object.entries({ en: enMessages, es: esMessages, de: deMessages })) {
    it(`has the same keys in ${locale}`, () => {
      expect(keysOf(messages.campaignDetail).sort()).toEqual(reference);
    });
  }
});
