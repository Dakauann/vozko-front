import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { ActiveConversation, InboxEntry } from "@/lib/conversations/types";

const leadActions = vi.hoisted(() => ({
  blockLeadAction: vi.fn(),
  renameLeadAction: vi.fn(),
  getEntryLeadCardAction: vi.fn(),
  setLeadDistrictAction: vi.fn(),
  setLeadOwnerAction: vi.fn(),
  getLeadByIdAction: vi.fn(),
  optOutLeadAction: vi.fn(),
}));

vi.mock("@/components/customer-portfolio/ConversationPortfolio", () => ({ ConversationPortfolio: () => null }));
vi.mock("@/app/actions/leads", () => leadActions);
vi.mock("@/app/actions/opportunities", () => ({
  listOpportunitiesForEntryAction: () => Promise.resolve({ opportunities: [], error: null }),
}));
vi.mock("@/app/actions/custom-fields", () => ({
  listCustomFieldsAction: () => Promise.resolve({ fields: [], error: null }),
}));
vi.mock("@/app/actions/workspace", () => ({
  listAssignableMembersAction: () => Promise.resolve({ members: [], page: 1, pageSize: 0, totalPages: 1, totalItems: 0 }),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    can: (resource: string, action: string) => ["conversations:read", "leads:assign"].includes(`${resource}:${action}`),
    currentWorkspace: { id: "ws-1" },
  }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import CrmConversationInfosPanel from "../CrmConversationInfosPanel";

function conversationFor(entryId: string): ActiveConversation {
  return {
    entry_id: entryId,
    entry_type: "unofficial_whatsapp",
    lead_id: `lead-${entryId}`,
    lead_version: 1,
    lead_name: "Maria",
    lead_number: "5511900010142",
    messages: [],
    has_more: false,
    unread_count: 0,
    window_open: true,
    window_expires_at: null,
  } as ActiveConversation;
}

function inboxEntryFor(entryId: string): InboxEntry {
  return {
    entry_id: entryId,
    entry_type: "unofficial_whatsapp",
    lead_id: `lead-${entryId}`,
    lead_version: 1,
    lead_name: "Maria",
    lead_number: "5511900010142",
    blocked: false,
    unread_count: 0,
    last_message_at: "2026-01-01T00:00:00Z",
    window_open: true,
  } as InboxEntry;
}

const t = ptMessages.crmContactPanel.lead;

beforeEach(() => {
  vi.clearAllMocks();
  leadActions.getEntryLeadCardAction.mockImplementation((entryId: string) =>
    Promise.resolve({ card: { leadId: `lead-${entryId}`, version: 1, name: "Maria", blocked: false, relativesCount: 0, referredCount: 0 }, error: null }),
  );
});

describe("inbox contact panel across conversation switches", () => {
  it("keeps one owner row after visiting three conversations, so earlier summaries never linger", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = (entryId: string) => (
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
          <CrmConversationInfosPanel
            open
            onClose={() => {}}
            conversation={conversationFor(entryId)}
            inboxEntry={inboxEntryFor(entryId)}
            canBlock={false}
            canManageMemories={false}
            canRenameLead={false}
            onLeadPatched={() => {}}
          />
        </NextIntlClientProvider>
      </QueryClientProvider>
    );
    const { rerender } = render(view("e-1"));
    await screen.findByText(t.noOwner);
    rerender(view("e-2"));
    await waitFor(() => expect(leadActions.getEntryLeadCardAction.mock.calls.map((call) => call[0])).toContain("e-2"));
    rerender(view("e-3"));
    await waitFor(() => expect(leadActions.getEntryLeadCardAction.mock.calls.map((call) => call[0])).toContain("e-3"));
    await screen.findByText(t.noOwner);
    await waitFor(() => expect(screen.getAllByText(t.noOwner)).toHaveLength(1));
    expect(screen.getAllByRole("button", { name: t.editOwner })).toHaveLength(1);
  });
});
