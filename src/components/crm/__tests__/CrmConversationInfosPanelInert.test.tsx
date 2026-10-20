import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { ActiveConversation, InboxEntry } from "@/lib/conversations/types";

vi.mock("@/components/customer-portfolio/ConversationPortfolio", () => ({ ConversationPortfolio: () => null }));
vi.mock("@/app/actions/leads", () => ({
  blockLeadAction: vi.fn(),
  renameLeadAction: vi.fn(),
  getEntryLeadCardAction: () => Promise.resolve({ card: null, error: { status: 404, code: "lead_not_found" } }),
}));
vi.mock("@/app/actions/custom-fields", () => ({
  listCustomFieldsAction: () => Promise.resolve({ fields: [], error: null }),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: () => false, currentWorkspace: { id: "ws-1" } }),
}));
vi.mock("@/app/actions/opportunities", () => ({
  listOpportunitiesForEntryAction: () => Promise.resolve({ opportunities: [], error: null }),
}));

import CrmConversationInfosPanel from "../CrmConversationInfosPanel";

const conversation = {
  entry_id: "e-1",
  entry_type: "whatsapp",
  lead_id: "lead-1",
  lead_name: "Ana",
  lead_number: "5511999990000",
  messages: [],
  has_more: false,
  unread_count: 0,
  window_open: true,
  window_expires_at: null,
} as unknown as ActiveConversation;

const inboxEntry = {
  entry_id: "e-1",
  entry_type: "whatsapp",
  lead_id: "lead-1",
  lead_name: "Ana",
  lead_number: "5511999990000",
  unread_count: 0,
  last_message_at: "2026-01-01T00:00:00Z",
  window_open: true,
} as unknown as InboxEntry;

function renderPanel(open: boolean) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <CrmConversationInfosPanel
          open={open}
          onClose={() => {}}
          conversation={conversation}
          inboxEntry={inboxEntry}
          canBlock={false}
          canManageMemories={false}
          canRenameLead={false}
          onLeadPatched={vi.fn()}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("CrmConversationInfosPanel when closed", () => {
  it("takes its controls out of the tab order so keyboard users never land in a hidden panel", () => {
    const { container } = renderPanel(false);
    const panel = container.querySelector("aside");
    expect(panel).toHaveAttribute("inert");
  });

  it("stays reachable while open", () => {
    const { container } = renderPanel(true);
    const panel = container.querySelector("aside");
    expect(panel).not.toHaveAttribute("inert");
  });
});
