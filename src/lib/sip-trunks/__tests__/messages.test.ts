import { describe, expect, it } from "vitest";

import IntlMessageFormat from "intl-messageformat";
import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { CALL_OUTCOMES, DIALER_ERROR_CODES } from "@/lib/dialer/dial-string";

const CATALOGS: Record<string, Record<string, unknown>> = { pt, en, de, es };

const DASHES = new RegExp("[\\u2013\\u2014]");

const PARITY_NAMESPACES = ["calling", "sipTrunks", "aiChatPage.voice"];

const REQUIRED_KEYS = [
  "sidebar.nav.sipTrunks",
  "sidebar.families.telephony",
  "workspaceSettings.resources.sip_trunks",
  "workspaceSettings.resourceDescriptions.sip_trunks",
  "pricing.services.sip_calls",
  "adminPricing.services.telephony.sip_calls",
  "adminPlans.pricing.services.sip_calls",
  "plansPage.pricing.services.sip_calls",
  "aiChatPage.tools.place_call",
  "aiChatPage.secretHint",
  "aiChatPage.fields.password",
  "aiChatPage.fields.bot_token",
  "aiChatPage.tools.list_telegram_bots",
  "aiChatPage.tools.connect_telegram_bot",
  "aiChatPage.tools.list_calls",
  "aiChatPage.tools.get_call",
  "aiChatPage.tools.list_phone_lines",
  "aiChatPage.tools.create_phone_line",
  "aiChatPage.tools.update_phone_line",
  "aiChatPage.tools.change_phone_line_password",
  "aiChatPage.tools.delete_phone_line",
  "aiChatPage.tools.list_call_queues",
  "aiChatPage.tools.create_call_queue",
  "aiChatPage.tools.update_call_queue",
  "aiChatPage.tools.delete_call_queue",
];

const RUNTIME_KEYS = [
  ...CALL_OUTCOMES.map((outcome) => `calling.dialer.outcome.${outcome}`),
  ...DIALER_ERROR_CODES.map((code) => `calling.dialer.errors.${code}`),
  ...["sip", "whatsapp"].map((channel) => `calling.incoming.channel.${channel}`),
  ...["REGISTERED", "REGISTERING", "FAILED", "UNREGISTERED", "DISABLED"].map((status) => `sipTrunks.status.${status}`),
  ...["BIDIRECTIONAL", "OUTBOUND", "INBOUND"].map((type) => `sipTrunks.form.types.${type}`),
  ...["name", "host", "port", "username", "password", "codecs"].map((field) => `sipTrunks.form.invalid.${field}`),
];

function flatten(value: unknown, prefix = ""): Array<[string, string]> {
  if (typeof value === "string") return [[prefix, value]];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key));
}

function at(catalog: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined), catalog);
}

describe("telephony messages", () => {
  for (const namespace of PARITY_NAMESPACES) {
    const reference = new Set(flatten(at(pt, namespace)).map(([key]) => key));

    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      it(`${locale}: ${namespace} matches pt key for key`, () => {
        const keys = new Set(flatten(at(catalog, namespace)).map(([key]) => key));
        expect([...reference].filter((k) => !keys.has(k)), `${locale} missing`).toEqual([]);
        expect([...keys].filter((k) => !reference.has(k)), `${locale} extra`).toEqual([]);
      });

      it(`${locale}: ${namespace} parses as ICU and has no em or en dashes`, () => {
        for (const [key, message] of flatten(at(catalog, namespace))) {
          expect(() => new IntlMessageFormat(message, locale), `${locale}.${namespace}.${key}`).not.toThrow();
          expect(message, `${locale}.${namespace}.${key}`).not.toMatch(DASHES);
        }
      });
    }
  }

  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    it(`${locale}: defines every cross-app and runtime key`, () => {
      for (const key of [...REQUIRED_KEYS, ...RUNTIME_KEYS]) {
        const value = at(catalog, key);
        expect(typeof value, `${locale}.${key}`).toBe("string");
        expect(value as string, `${locale}.${key}`).not.toMatch(DASHES);
      }
    });

    it(`${locale}: no longer carries the retired whatsappCall namespace`, () => {
      expect(at(catalog, "whatsappCall")).toBeUndefined();
    });
  }
});
