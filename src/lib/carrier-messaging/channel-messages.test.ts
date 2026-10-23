import IntlMessageFormat from "intl-messageformat";
import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { CHANNEL_REASON_COPY, CHANNEL_UNAVAILABLE_BY_CHANNEL } from "@/lib/conversations/window-closed";
import { CHANNEL_FILTERS } from "@/lib/live-chat/channel-filter";

const CATALOGS: Record<string, Record<string, unknown>> = { pt, en, de, es };

const DASHES = new RegExp("[\\u2013\\u2014]");

const CHANNELS = { rcs: "RCS", sms: "SMS" } as const;

function at(catalog: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined), catalog);
}

function requiredKeys(channel: keyof typeof CHANNELS): string[] {
  const filter = channel === "rcs" ? "filterRcs" : "filterSms";
  return [
    `channelNames.${channel}`,
    `liveChat.${filter}`,
    `leadsPage.filters.options.channel.${channel}`,
    `metricsOps.common.${channel}`,
    `aiChatPage.chart.values.${channel}`,
    `audience.channels.${channel}`,
    `crm.messageSender.externalVia.${channel}`,
    `conversationWindow.closedByChannel.${channel}.channel_unavailable`,
    ...(CHANNEL_REASON_COPY[channel] ?? []).map((reason) => `conversationWindow.closedByChannel.${channel}.${reason}`),
  ];
}

describe("RCS and SMS shared messages", () => {
  it("only close the window when the sender cannot send", () => {
    for (const channel of Object.keys(CHANNELS) as (keyof typeof CHANNELS)[]) {
      expect(CHANNEL_UNAVAILABLE_BY_CHANNEL[channel]).toBe(true);
      expect(CHANNEL_REASON_COPY[channel] ?? []).toEqual([]);
    }
  });

  it("filter the inbox behind the carrier inbox permission", () => {
    for (const channel of Object.keys(CHANNELS)) {
      const filter = CHANNEL_FILTERS.find((spec) => spec.value === channel);
      expect(filter?.permission).toEqual({ resource: "carrier_inboxes", action: "read" });
    }
  });

  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    it(`${locale}: defines every shared key both channels need, as ICU without dashes`, () => {
      for (const channel of Object.keys(CHANNELS) as (keyof typeof CHANNELS)[]) {
        for (const key of requiredKeys(channel)) {
          const value = at(catalog, key);
          expect(typeof value, `${locale}.${key}`).toBe("string");
          expect(value as string, `${locale}.${key}`).not.toMatch(DASHES);
          expect(() => new IntlMessageFormat(value as string, locale), `${locale}.${key}`).not.toThrow();
        }
      }
    });

    it(`${locale}: names both channels the agreed way`, () => {
      for (const [channel, name] of Object.entries(CHANNELS)) {
        expect(at(catalog, `channelNames.${channel}`)).toBe(name);
        expect(at(catalog, `metricsOps.common.${channel}`)).toBe(name);
      }
    });
  }
});
