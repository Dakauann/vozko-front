import { describe, expect, it } from "vitest";

import IntlMessageFormat from "intl-messageformat";
import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { CLOSED_DETAIL_CATALOGS } from "@/lib/conversations/window-closed";
import { EMAIL_BLOCK_DETAILS } from "@/lib/email/channel";
import { EMAIL_FORWARD_SKIP_REASONS } from "@/lib/email/events";

const CATALOGS: Record<string, Record<string, unknown>> = { pt, en, de, es };

const DASHES = new RegExp("[\\u2013\\u2014]");

const CHANNEL_NAMES: Record<string, string> = { pt: "E-mail", en: "Email", es: "E-mail", de: "E-mail" };

const REQUIRED_KEYS = [
  "channelNames.email",
  "liveChat.filterEmail",
  "leadsPage.filters.options.channel.email",
  "metricsOps.common.email",
  "aiChatPage.chart.values.email",
  "audience.channels.email",
  "crm.messageSender.externalVia.email",
  "workspaceSettings.resources.email_inboxes",
  "workspaceSettings.resourceDescriptions.email_inboxes",
  "workflowsPage.entryPoints.channelKinds.email_inbox",
  "conversationWindow.closedByChannel.email.channel_unavailable",
  "crmConversation.sendError.emailBalanceInsufficient",
  "crmContactPanel.activity.types.email_forward_skipped",
  "crm.emailSubject",
  ...EMAIL_BLOCK_DETAILS.map((detail) => `conversationWindow.closedDetail.email.${detail}`),
  ...[...EMAIL_FORWARD_SKIP_REASONS, "other"].map((reason) => `crmContactPanel.activity.details.emailForwardSkipped.${reason}`),
];

function at(catalog: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined), catalog);
}

describe("email shared messages", () => {
  it("explains exactly the email blocks the server names", () => {
    expect(CLOSED_DETAIL_CATALOGS.email).toBe(EMAIL_BLOCK_DETAILS);
    for (const catalog of Object.values(CATALOGS)) {
      expect(Object.keys(at(catalog, "conversationWindow.closedDetail.email") as object).sort()).toEqual([...EMAIL_BLOCK_DETAILS].sort());
    }
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
      expect(at(catalog, "channelNames.email")).toBe(CHANNEL_NAMES[locale]);
      expect(at(catalog, "liveChat.filterEmail")).toBe(CHANNEL_NAMES[locale]);
    });
  }
});
