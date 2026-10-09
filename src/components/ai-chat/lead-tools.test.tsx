import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-access", () => ({ useAccess: () => ({ decideScreen: () => ({ status: "allowed" }) }) }));
vi.mock("@/hooks/use-open-in-studio", () => ({ useOpenInStudio: () => ({ open: vi.fn(), opening: null }) }));

import deMessages from "@/i18n/messages/de.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import ptMessages from "@/i18n/messages/pt.json";
import type { PendingAction } from "@/lib/aichat/types";
import type { UIMessage } from "@/lib/aichat/ui-message";

import { MessageBubble, useBubbleLabels } from "./message-list";

const LEAD_TOOLS = ["search_leads", "lead_geo_summary", "prepare_lead_action", "start_lead_send", "cancel_lead_send"] as const;

const CARD_FIELDS = [
  "action",
  "leads",
  "changes",
  "skipped",
  "parts",
  "estimatedCost",
  "balance",
  "capRemaining",
  "budget",
  "dailyCap",
  "estimatedDays",
  "next",
  "campaign",
  "recipients",
  "counted",
  "finalCost",
  "entries",
] as const;

const LOCALES = { pt: ptMessages, en: enMessages, es: esMessages, de: deMessages };

function Bubble({ message }: { message: UIMessage }) {
  return <MessageBubble message={message} live={false} onApprove={vi.fn()} onReject={vi.fn()} onEditImage={vi.fn()} labels={useBubbleLabels()} />;
}

function renderPending(pending: PendingAction) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <Bubble message={{ id: "a-1", role: "assistant", content: "", createdAt: "2026-10-08T12:00:00Z", pending }} />
    </NextIntlClientProvider>,
  );
}

describe("Elo lead tools", () => {
  it("names every lead tool in all four languages", () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      for (const tool of LEAD_TOOLS) {
        expect(messages.aiChatPage.tools[tool as keyof typeof messages.aiChatPage.tools], `${locale} ${tool}`).toBeTruthy();
      }
      for (const key of CARD_FIELDS) {
        expect(messages.aiChatPage.fields[key as keyof typeof messages.aiChatPage.fields], `${locale} ${key}`).toBeTruthy();
      }
      expect(Object.keys(messages.aiChatPage.toolFields.prepare_lead_action).sort()).toEqual(["budget", "changes", "leads"]);
    }
  });

  it("shows the lead action card with labels that fit a group of leads, never code names", () => {
    renderPending({
      id: "p-1",
      toolName: "prepare_lead_action",
      status: "pending",
      fields: [
        { key: "action", value: "classificar: Interesse = quente" },
        { key: "leads", value: "5000 leads do filtro" },
        { key: "changes", value: "4700" },
        { key: "skipped", value: "300 já tinham esse valor" },
      ],
    });
    const card = screen.getByText(ptMessages.aiChatPage.tools.prepare_lead_action).closest("div.rounded-lg") as HTMLElement;
    expect(within(card).getByText(ptMessages.aiChatPage.toolFields.prepare_lead_action.changes)).toBeTruthy();
    expect(within(card).getByText(ptMessages.aiChatPage.toolFields.prepare_lead_action.leads)).toBeTruthy();
    expect(within(card).getByText(ptMessages.aiChatPage.fields.skipped)).toBeTruthy();
    expect(within(card).queryByText(ptMessages.aiChatPage.fields.changes)).toBeNull();
    expect(within(card).queryByText(/prepare lead action/i)).toBeNull();
  });

  it("keeps the shared label for the same key on other tools", () => {
    renderPending({ id: "p-2", toolName: "edit_ad_text", status: "pending", fields: [{ key: "changes", value: "título" }] });
    expect(screen.getByText(ptMessages.aiChatPage.fields.changes)).toBeTruthy();
  });

  it("renders the counted preview under the send card", () => {
    renderPending({
      id: "p-3",
      toolName: "start_lead_send",
      status: "pending",
      fields: [{ key: "recipients", value: "1200" }],
      preview: {
        kind: "lead_action",
        data: { stage: "start", action: "send_unofficial", matched: 1500, selected: 1500, eligible: 1200, partial: false, skipped: { blocked: 300 } },
      },
    });
    expect(screen.getByText(ptMessages.leadSends.review.skipped.blocked)).toBeTruthy();
    expect(screen.getAllByText(ptMessages.aiChatPage.fields.recipients).map((node) => node.tagName)).toEqual(["SPAN"]);
  });

  it("states each count and cost once, leaving to the card only what the preview does not show", () => {
    renderPending({
      id: "p-4",
      toolName: "start_lead_send",
      status: "pending",
      fields: [
        { key: "campaign", value: "Reativação" },
        { key: "recipients", value: "1200" },
        { key: "skipped", value: "300 bloqueados" },
        { key: "counted", value: "52 com a janela aberta" },
        { key: "finalCost", value: "US$ 75.00" },
        { key: "balance", value: "US$ 50.00" },
      ],
      preview: {
        kind: "lead_action",
        data: {
          stage: "start",
          action: "send_template",
          matched: 1500,
          selected: 1500,
          eligible: 1200,
          partial: false,
          skipped: { blocked: 300 },
          counted: { window_open: 52 },
          quote: { count: 1200, parts: 1, splitRequired: false, maxPerCampaign: 150000, unitPriceMicros: 62500, costMicros: 75000000, balanceMicros: 90000000, currency: "USD", affordable: true, fits: 1200 },
        },
      },
    });
    const card = screen.getByText(ptMessages.aiChatPage.tools.start_lead_send).closest("div.rounded-lg") as HTMLElement;
    const terms = within(card).getAllByRole("term").map((node) => node.textContent);
    expect(terms).toContain(ptMessages.aiChatPage.fields.campaign);
    expect(terms).toContain(ptMessages.aiChatPage.fields.finalCost);
    expect(within(card).queryByText("1200")).toBeNull();
    expect(within(card).queryByText("300 bloqueados")).toBeNull();
    expect(within(card).queryByText("52 com a janela aberta")).toBeNull();
    expect(within(card).queryByText("US$ 50.00")).toBeNull();
    expect(within(card).getByText("US$ 75.00")).toBeTruthy();
    expect(within(card).getAllByText(ptMessages.leadSends.review.skipped.blocked)).toHaveLength(1);
  });

  it("keeps every row when the preview cannot be read", () => {
    renderPending({
      id: "p-5",
      toolName: "start_lead_send",
      status: "pending",
      fields: [{ key: "recipients", value: "1200" }],
      preview: { kind: "lead_action", data: { stage: "start", action: "send_template", selected: "muitos" } },
    });
    expect(screen.getByText("1200")).toBeTruthy();
  });
});
