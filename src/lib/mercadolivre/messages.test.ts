import { describe, expect, it } from "vitest";

import IntlMessageFormat from "intl-messageformat";
import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { CHANNEL_UNAVAILABLE_BY_CHANNEL, CLOSED_DETAIL_CATALOGS } from "@/lib/conversations/window-closed";
import { MERCADOLIVRE_BLOCK_SUBSTATUSES } from "@/lib/mercadolivre/window";
import { MERCADOLIVRE_ACCOUNT_TABS } from "@/components/mercadolivre/mercadolivre-account-tabs";
import { accountStatusKey } from "@/lib/mercadolivre/account";
import { MERCADOLIVRE_CONNECT_FACTS } from "@/lib/mercadolivre/connect";
import { MERCADOLIVRE_MODERATION_REASONS, type MercadoLivreModerationState } from "@/lib/mercadolivre/message-metadata";
import { MERCADOLIVRE_ORDER_STATUSES, MERCADOLIVRE_SHIPPING_STATUSES, MERCADOLIVRE_SHIPPING_SUBSTATUSES } from "@/lib/mercadolivre/pack";
import { QUESTION_STATUS_FILTERS } from "@/lib/mercadolivre/questions";
import { DOCUMENTED_REASONS, REASON_ERROR_CODES } from "@/lib/mercadolivre/reasons";
import {
  MERCADOLIVRE_ACCOUNT_STATUSES,
  MERCADOLIVRE_CAPABILITIES,
  MERCADOLIVRE_CONNECT_ERRORS,
  MERCADOLIVRE_ANSWER_SOURCES,
  MERCADOLIVRE_ERROR_CODES,
  MERCADOLIVRE_LISTING_STATUSES,
  MERCADOLIVRE_QUESTION_STATUSES,
} from "@/lib/mercadolivre/types";

const CATALOGS: Record<string, Record<string, unknown>> = { pt, en, de, es };

const MODERATION_STATES: readonly MercadoLivreModerationState[] = ["pending_review", "pending_translation", "blocked", "unknown"];

const AUTOMATION_PANEL_KEYS = [
  "title",
  "modeLabel",
  "modeAgent",
  "modeWorkflow",
  "agentLabel",
  "agentHint",
  "agentSearch",
  "agentEmpty",
  "agentInactive",
  "workflowLabel",
  "workflowHint",
  "workflowSearch",
  "workflowEmpty",
  "enableLabel",
  "enableHint",
  "enableRequiresAgent",
  "enableRequiresWorkflow",
  "statusActive",
  "statusInactive",
  "saving",
  "saved",
  "saveFailed",
  "activeNote",
  "activeNoteWorkflow",
  "pipelineLabel",
  "pipelineHint",
  "pipelineDefault",
  "disclosureTitle",
  "disclosureHint",
  "disclosurePlaceholder",
  "disclosureSave",
  "moderationTitle",
  "moderationBody",
];

const DASHES = new RegExp("[\u2013\u2014]");

const PACK_UI_KEYS = [
  "title",
  "order",
  "shipping",
  "quantityPrice",
  "total",
  "moreItems",
  "showItems",
  "hideItems",
  "refreshed",
  "pending",
  "stillPending",
  "failed",
  "openListing",
];

const CHANNEL_NAME = "Mercado Livre";

const MAX_DETAIL_LENGTH = 140;

const REQUIRED_KEYS = [
  "channelNames.mercadolivre",
  "sidebar.nav.mercadolivre",
  "sidebar.nav.mercadolivreAccounts",
  "sidebar.nav.connectMercadoLivre",
  "sidebar.families.mercadolivre",
  "workspaceSettings.resources.mercadolivre_accounts",
  "workspaceSettings.resourceDescriptions.mercadolivre_accounts",
  "liveChat.filterMercadoLivre",
  "leadsPage.filters.options.channel.mercadolivre",
  "metricsOps.common.mercadolivre",
  "aiChatPage.chart.values.mercadolivre",
  "aiChatPage.actions.kinds.connect_mercadolivre.title",
  "aiChatPage.actions.kinds.connect_mercadolivre.description",
  "aiChatPage.actions.kinds.connect_mercadolivre.cta",
  "conversationWindow.textCharset",
  "crmContactPanel.activity.types.agent_reply_withheld",
  "crmContactPanel.activity.details.agentReplyWithheld",
  ...["accounts", "connect", "account"].flatMap((screen) => [`mercadolivre.screens.${screen}.title`, `mercadolivre.screens.${screen}.description`]),
  ...MERCADOLIVRE_BLOCK_SUBSTATUSES.map((substatus) => `conversationWindow.closedDetail.mercadolivre.${substatus}`),
  ...Object.keys(CHANNEL_UNAVAILABLE_BY_CHANNEL).map((channel) => `conversationWindow.closedByChannel.${channel}.channel_unavailable`),
  ...MERCADOLIVRE_ACCOUNT_STATUSES.map((status) => `mercadolivre.${accountStatusKey(status)}`),
  ...MERCADOLIVRE_CAPABILITIES.map((capability) => `mercadolivre.capability.${capability}`),
  ...MERCADOLIVRE_CONNECT_ERRORS.map((reason) => `mercadolivre.connectError.${reason}`),
  ...[...MERCADOLIVRE_ERROR_CODES, "generic"].map((code) => `mercadolivre.errors.${code}`),
  ...MERCADOLIVRE_CONNECT_FACTS.flatMap((fact) => [`mercadolivre.connect.facts.${fact}.term`, `mercadolivre.connect.facts.${fact}.detail`]),
  ...MODERATION_STATES.map((state) => `mercadolivre.thread.moderation.${state}`),
  ...[...MERCADOLIVRE_MODERATION_REASONS, "unknown"].map((reason) => `mercadolivre.thread.moderationReason.${reason}`),
  ...MERCADOLIVRE_ACCOUNT_TABS.map((tab) => `mercadolivre.account.tabs.${tab.label}`),
  ...AUTOMATION_PANEL_KEYS.map((key) => `mercadolivre.automation.${key}`),
  ...[...MERCADOLIVRE_QUESTION_STATUSES, "unknown"].map((status) => `mercadolivre.questions.status.${status}`),
  ...QUESTION_STATUS_FILTERS.map((filter) => `mercadolivre.questions.statusFilter.${filter}`),
  ...MERCADOLIVRE_ANSWER_SOURCES.map((source) => `mercadolivre.questions.answeredBy.${source}`),
  ...[...MERCADOLIVRE_LISTING_STATUSES, "unknown"].map((status) => `mercadolivre.listingStatus.${status}`),
  ...["all", ...MERCADOLIVRE_LISTING_STATUSES].map((filter) => `mercadolivre.listings.statusFilter.${filter}`),
  ...[...REASON_ERROR_CODES, "generic"].map((code) => `mercadolivre.reasons.errors.${code}`),
  ...DOCUMENTED_REASONS.map((reason) => `mercadolivre.reasons.option.${reason}`),
  ...["empty", "charset", "too_long", "cap_reached", "unavailable", "text_not_accepted", "template_unknown", "missing_value", "invalid_value"].map(
    (error) => `mercadolivre.reasons.local.${error}`,
  ),
  ...["total", "weekdaysWorkingHours", "weekdaysExtraHours", "weekend"].map((slot) => `mercadolivre.questions.responseTime.slot.${slot}`),
  "crmComposer.attachments.channelRefusedType",
  "crmComposer.attachments.channelRefusedSize",
  "crmComposer.attachments.channelLimitsUnknown",
  "crmComposer.attachments.channelTakesNone",
  ...["image", "video", "audio", "document"].map((kind) => `crmComposer.attachments.anyOfKind.${kind}`),
  ...PACK_UI_KEYS.map((key) => `mercadolivre.pack.${key}`),
  ...MERCADOLIVRE_ORDER_STATUSES.map((status) => `mercadolivre.pack.orderStatus.${status}`),
  ...MERCADOLIVRE_SHIPPING_STATUSES.map((status) => `mercadolivre.pack.shippingStatus.${status}`),
  ...MERCADOLIVRE_SHIPPING_SUBSTATUSES.map((substatus) => `mercadolivre.pack.shippingSubstatus.${substatus}`),
];

function at(catalog: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined), catalog);
}

function leaves(value: unknown, prefix: string): string[] {
  if (typeof value === "string") return [prefix];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => leaves(child, `${prefix}.${key}`));
}

describe("Mercado Livre messages", () => {
  it("covers every block substatus the server maps, and nothing else", () => {
    expect(MERCADOLIVRE_BLOCK_SUBSTATUSES).toHaveLength(26);
    expect(new Set(MERCADOLIVRE_BLOCK_SUBSTATUSES).size).toBe(26);
    expect(CLOSED_DETAIL_CATALOGS.mercadolivre).toBe(MERCADOLIVRE_BLOCK_SUBSTATUSES);
    for (const catalog of Object.values(CATALOGS)) {
      expect(Object.keys(at(catalog, "conversationWindow.closedDetail.mercadolivre") as object).sort()).toEqual([...MERCADOLIVRE_BLOCK_SUBSTATUSES].sort());
    }
  });

  it("covers exactly the order and shipping statuses the summary knows", () => {
    for (const catalog of Object.values(CATALOGS)) {
      expect(Object.keys(at(catalog, "mercadolivre.pack.orderStatus") as object).sort()).toEqual([...MERCADOLIVRE_ORDER_STATUSES].sort());
      expect(Object.keys(at(catalog, "mercadolivre.pack.shippingStatus") as object).sort()).toEqual([...MERCADOLIVRE_SHIPPING_STATUSES].sort());
      expect(Object.keys(at(catalog, "mercadolivre.pack.shippingSubstatus") as object).sort()).toEqual([...MERCADOLIVRE_SHIPPING_SUBSTATUSES].sort());
    }
  });

  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    it(`${locale}: defines every key the channel needs, as ICU without dashes`, () => {
      for (const key of REQUIRED_KEYS) {
        const value = at(catalog, key);
        expect(typeof value, `${locale}.${key}`).toBe("string");
        expect(value as string, `${locale}.${key}`).not.toMatch(DASHES);
        expect(() => new IntlMessageFormat(value as string, locale), `${locale}.${key}`).not.toThrow();
      }
    });

    it(`${locale}: keeps each block explanation short`, () => {
      for (const key of leaves(at(catalog, "conversationWindow.closedDetail"), "closedDetail")) {
        const value = at(catalog, `conversationWindow.${key}`) as string;
        expect(value.length, `${locale}.${key}`).toBeLessThanOrEqual(MAX_DETAIL_LENGTH);
      }
    });

    it(`${locale}: names the channel the agreed way`, () => {
      expect(at(catalog, "channelNames.mercadolivre")).toBe(CHANNEL_NAME);
      expect(at(catalog, "liveChat.filterMercadoLivre")).toBe(CHANNEL_NAME);
      expect(at(catalog, "sidebar.families.mercadolivre")).toBe(CHANNEL_NAME);
    });

    it(`${locale}: the shared channel-unavailable copy names no specific channel`, () => {
      expect(at(catalog, "conversationWindow.closed.channel_unavailable") as string).not.toMatch(/WhatsApp|número|number|número|Nummer/i);
    });
  }
});
