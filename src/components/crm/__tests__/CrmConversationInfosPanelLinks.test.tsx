import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { ActiveConversation, InboxEntry } from "@/lib/conversations/types";

const drawer = vi.hoisted(() => ({ edit: vi.fn(() => Promise.resolve(true)) }));

vi.mock("@/components/customer-portfolio/ConversationPortfolio", () => ({ ConversationPortfolio: () => null }));
vi.mock("@/components/crm/OpportunityDrawer", () => ({ default: () => null }));
vi.mock("@/hooks/use-opportunity-creation", () => ({
  useOpportunityDrawer: () => ({ loading: false, open: false, setOpen: vi.fn(), setup: null, opportunity: null, start: vi.fn(), edit: drawer.edit }),
}));
vi.mock("@/app/actions/leads", () => ({
  blockLeadAction: vi.fn(),
  renameLeadAction: vi.fn(),
  getEntryLeadCardAction: () => Promise.resolve({ card: null, error: { status: 404, code: "lead_not_found" } }),
  listLeadTimelineAction: () =>
    Promise.resolve({
      page: {
        leadId: "lead-1",
        items: [
          { id: "1", kind: "conversation", at: "2026-10-18T10:00:00Z", ref: { type: "entry", id: "e-1", entryType: "whatsapp" }, summary: {} },
          { id: "2", kind: "conversation", at: "2026-10-17T10:00:00Z", ref: { type: "entry", id: "i-9", entryType: "instagram" }, summary: {} },
        ],
      },
      error: null,
    }),
}));
vi.mock("@/app/actions/custom-fields", () => ({
  listCustomFieldsAction: () => Promise.resolve({ fields: [], error: null }),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: () => false, currentWorkspace: { id: "ws-1" } }),
}));
vi.mock("@/app/actions/opportunities", () => ({
  listOpportunitiesForEntryAction: () =>
    Promise.resolve({ opportunities: [{ id: "deal-1", title: "Plano anual", status: "open", valueCents: 0, currency: "BRL" }], error: null }),
}));

import CrmConversationInfosPanel from "../CrmConversationInfosPanel";

const conversation = {
  entry_id: "e-1",
  entry_type: "whatsapp",
  lead_id: "lead-1",
  lead_name: "Ana",
  lead_number: "5511999990000",
  lead_metadata: { email: "ana@empresa.com" },
  messages: [],
  unread_count: 0,
  window_open: true,
  window_expires_at: null,
} as unknown as ActiveConversation;

const inboxEntry = { ...conversation, last_message_at: "2026-10-18T10:00:00Z" } as unknown as InboxEntry;

function renderPanel(onOpenConversation = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <CrmConversationInfosPanel
          open
          onClose={() => {}}
          conversation={conversation}
          inboxEntry={inboxEntry}
          canBlock={false}
          canManageMemories={false}
          canRenameLead={false}
          canReadLead
          onLeadPatched={vi.fn()}
          onOpenConversation={onOpenConversation}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return onOpenConversation;
}

describe("the contact panel links", () => {
  it("lists the contact's other conversations and opens one in place", async () => {
    const onOpenConversation = renderPanel();
    const link = await screen.findByRole("link", { name: /Instagram/ });
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).toBeNull();
    fireEvent.click(link);
    expect(onOpenConversation).toHaveBeenCalledWith("i-9", "instagram");
  });

  it("offers labelled copy buttons for the phone and an email address", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: ptMessages.crmContactPanel.copyPhone })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ptMessages.crmContactPanel.copyEmail })).toBeInTheDocument();
  });

  it("announces a copy politely", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: ptMessages.crmContactPanel.copyPhone }));
    await waitFor(() => expect(screen.getByText(ptMessages.crmContactPanel.phoneCopied)).toHaveAttribute("role", "status"));
  });

  it("opens an opportunity from its row", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: ptMessages.crmContactPanel.tabs.insights }));
    const row = await screen.findByRole("button", { name: /Plano anual/ });
    fireEvent.click(row);
    expect(drawer.edit).toHaveBeenCalledWith(expect.objectContaining({ id: "deal-1" }));
  });
});
