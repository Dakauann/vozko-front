import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import type { ConversationMessage } from "@/lib/conversations/types";

import { emailCampaignName } from "./campaign";

function message(channel: string, metadata?: Record<string, unknown>) {
  return { channel, entry_type: channel, metadata } as Pick<ConversationMessage, "metadata" | "channel" | "entry_type">;
}

describe("email campaign name", () => {
  it("reads the campaign name an email campaign original carries", () => {
    expect(emailCampaignName(message("email", { email_campaign_name: " Black Friday " }))).toBe("Black Friday");
  });

  it("falls back to no name when there is none or the row is not an email", () => {
    expect(emailCampaignName(message("email", {}))).toBeNull();
    expect(emailCampaignName(message("email", { email_campaign_name: "  " }))).toBeNull();
    expect(emailCampaignName(message("whatsapp", { email_campaign_name: "Black Friday" }))).toBeNull();
  });

  it("has the named badge in all four languages", () => {
    for (const catalog of [pt, en, es, de]) {
      expect(catalog.crm.messageSender.campaignNamed).toContain("{name}");
    }
  });
});
