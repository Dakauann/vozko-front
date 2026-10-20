import { describe, expect, it } from "vitest";

import IntlMessageFormat from "intl-messageformat";
import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { CHANNEL_REASON_COPY } from "@/lib/conversations/window-closed";

const CATALOGS: Record<string, Record<string, unknown>> = { pt, en, de, es };

const DASHES = new RegExp("[\u2013\u2014]");

const CHANNEL_NAME = "TikTok";

const REQUIRED_KEYS = [
  "channelNames.tiktok",
  "sidebar.nav.tiktok",
  "sidebar.nav.tiktokAccounts",
  "sidebar.nav.connectTiktok",
  "sidebar.families.tiktok",
  "workspaceSettings.resources.tiktok_accounts",
  "workspaceSettings.resourceDescriptions.tiktok_accounts",
  "liveChat.filterTiktok",
  "leadsPage.filters.options.channel.tiktok",
  "metricsOps.common.tiktok",
  "aiChatPage.chart.values.tiktok",
  "aiChatPage.actions.kinds.connect_tiktok.title",
  "aiChatPage.actions.kinds.connect_tiktok.description",
  "aiChatPage.actions.kinds.connect_tiktok.cta",
  "audience.channels.tiktok",
  "crm.messageSender.externalVia.tiktok",
  "conversationWindow.closedByChannel.tiktok.channel_unavailable",
  ...(CHANNEL_REASON_COPY.tiktok ?? []).map((reason) => `conversationWindow.closedByChannel.tiktok.${reason}`),
];

function at(catalog: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined), catalog);
}

describe("TikTok shared messages", () => {
  it("explains the 48 hour window and the message budget in its own words", () => {
    expect(CHANNEL_REASON_COPY.tiktok).toEqual(["expired", "budget_exhausted"]);
    expect(at(pt, "conversationWindow.closedByChannel.tiktok.expired")).toMatch(/48/);
    expect(at(pt, "conversationWindow.closedByChannel.tiktok.budget_exhausted")).toMatch(/10/);
  });

  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    it(`${locale}: defines every shared key the channel needs, as ICU without dashes`, () => {
      for (const key of REQUIRED_KEYS) {
        const value = at(catalog, key);
        expect(typeof value, `${locale}.${key}`).toBe("string");
        expect(value as string, `${locale}.${key}`).not.toMatch(DASHES);
        expect(() => new IntlMessageFormat(value as string, locale), `${locale}.${key}`).not.toThrow();
      }
    });

    it(`${locale}: names the channel the agreed way`, () => {
      expect(at(catalog, "channelNames.tiktok")).toBe(CHANNEL_NAME);
      expect(at(catalog, "liveChat.filterTiktok")).toBe(CHANNEL_NAME);
      expect(at(catalog, "sidebar.families.tiktok")).toBe(CHANNEL_NAME);
    });

    it(`${locale}: carries the TikTok namespace with no dashes`, () => {
      expect(typeof at(catalog, "tiktok")).toBe("object");
      expect(DASHES.test(JSON.stringify(at(catalog, "tiktok")))).toBe(false);
    });
  }
});
