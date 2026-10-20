import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { LeadTimelineItem } from "@/lib/leads/timeline";

const timeline = vi.hoisted(() => ({ items: [] as LeadTimelineItem[] }));

vi.mock("@/hooks/use-lead-records", () => ({
  useLeadTimeline: () => ({ isPending: false, isError: false, data: { pages: [{ leadId: "lead-1", items: timeline.items }] } }),
}));

import { LeadOtherConversations } from "../LeadOtherConversations";

const t = ptMessages.crmContactPanel;

function renderList() {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <LeadOtherConversations leadId="lead-1" current={{ entryId: "w-1", entryType: "whatsapp" }} active />
    </NextIntlClientProvider>,
  );
}

describe("other conversations of the contact", () => {
  it("tells an official WhatsApp conversation from the QR code one and names the campaign, keeping the date", () => {
    timeline.items = [
      { id: "1", kind: "conversation", at: "2026-10-01T10:00:00Z", ref: { type: "entry", id: "u-9", entryType: "unofficial_whatsapp" }, summary: { channel: "unofficial_whatsapp" } },
      { id: "2", kind: "campaign_sent", at: "2026-09-30T10:00:00Z", ref: { type: "entry", id: "u-9", entryType: "unofficial_whatsapp" }, summary: { channel: "unofficial_whatsapp", title: "Volta às aulas" } },
      { id: "3", kind: "conversation", at: "2026-09-20T10:00:00Z", ref: { type: "entry", id: "w-2", entryType: "whatsapp" }, summary: { channel: "whatsapp" } },
    ];
    renderList();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent(t.openConversation.replace("{channel}", ptMessages.channelNames.unofficial_whatsapp));
    expect(links[0]).toHaveTextContent(t.conversationCampaign.replace("{campaign}", "Volta às aulas"));
    expect(links[0].querySelector("time")).toHaveAttribute("dateTime", "2026-10-01T10:00:00Z");
    expect(links[1]).toHaveTextContent(t.openConversation.replace("{channel}", ptMessages.channelNames.whatsapp));
    expect(links[1]).not.toHaveTextContent(t.conversationCampaign.replace("{campaign}", ""));
  });

  it("names the line beside the campaign on the second line, and the line alone when no campaign is known", () => {
    timeline.items = [
      { id: "1", kind: "conversation", at: "2026-10-01T10:00:00Z", ref: { type: "entry", id: "w-2", entryType: "whatsapp" }, summary: { channel: "whatsapp", line: "+55 11 4000-1000" } },
      { id: "2", kind: "campaign_read", at: "2026-09-30T10:00:00Z", ref: { type: "entry", id: "w-2", entryType: "whatsapp" }, summary: { channel: "whatsapp", title: "Volta às aulas" } },
      { id: "3", kind: "conversation", at: "2026-09-20T10:00:00Z", ref: { type: "entry", id: "w-3", entryType: "whatsapp" }, summary: { channel: "whatsapp", line: "+55 11 4000-2000" } },
    ];
    renderList();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent(t.conversationLineAndCampaign.replace("{line}", "+55 11 4000-1000").replace("{campaign}", "Volta às aulas"));
    expect(links[1]).toHaveTextContent("+55 11 4000-2000");
    expect(links[1]).not.toHaveTextContent(t.conversationCampaign.replace("{campaign}", ""));
  });
});
