import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { toast } from "sonner";

import ptMessages from "@/i18n/messages/pt.json";
import type { ActiveConversation, InboxEntry } from "@/lib/conversations/types";

const blockLeadAction = vi.fn();
const renameLeadAction = vi.fn();
const getEntryLeadCardAction = vi.fn();

vi.mock("@/app/actions/leads", () => ({
  blockLeadAction: (...args: unknown[]) => blockLeadAction(...args),
  renameLeadAction: (...args: unknown[]) => renameLeadAction(...args),
  getEntryLeadCardAction: (...args: unknown[]) => getEntryLeadCardAction(...args),
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
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import CrmConversationInfosPanel from "../CrmConversationInfosPanel";

const conversation = {
  entry_id: "e-1",
  entry_type: "whatsapp",
  lead_id: "lead-1",
  lead_version: 3,
  lead_name: "Ana",
  lead_number: "5511999990000",
  messages: [],
  has_more: false,
  unread_count: 0,
  window_open: true,
  window_expires_at: null,
} as ActiveConversation;

const inboxEntry = {
  entry_id: "e-1",
  entry_type: "whatsapp",
  lead_id: "lead-1",
  lead_version: 4,
  lead_name: "Ana",
  lead_number: "5511999990000",
  blocked: false,
  business_phone_id: "phone-1",
  unread_count: 0,
  last_message_at: "2026-01-01T00:00:00Z",
  window_open: true,
} as InboxEntry;

function renderPanel() {
  const onLeadPatched = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <CrmConversationInfosPanel
          open
          onClose={() => {}}
          conversation={conversation}
          inboxEntry={inboxEntry}
          canBlock
          canManageMemories={false}
          canRenameLead
          onLeadPatched={onLeadPatched}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { onLeadPatched };
}

function confirmBlock() {
  fireEvent.click(screen.getByRole("button", { name: ptMessages.crmContactPanel.blockAction }));
  fireEvent.click(screen.getByRole("button", { name: ptMessages.crmContactPanel.confirmBlockAction }));
}

beforeEach(() => {
  vi.clearAllMocks();
  getEntryLeadCardAction.mockResolvedValue({ card: null, error: { status: 404, code: "lead_not_found" } });
});

describe("CrmConversationInfosPanel lead wiring", () => {
  it("patches the shared store with the block and the version the server answered", async () => {
    blockLeadAction.mockResolvedValue({
      outcome: { leadId: "lead-1", blocked: true, metaApplied: true, version: 5 },
      error: null,
    });
    const { onLeadPatched } = renderPanel();

    confirmBlock();

    await waitFor(() => expect(onLeadPatched).toHaveBeenCalledWith("lead-1", { blocked: true, lead_version: 5 }));
    expect(blockLeadAction).toHaveBeenCalledWith("lead-1", true, "phone-1");
  });

  it("explains a refused block by its code, never with the raw server text", async () => {
    blockLeadAction.mockResolvedValue({
      outcome: null,
      error: { status: 403, code: "forbidden", message: "pq: permission denied" },
    });
    const { onLeadPatched } = renderPanel();

    confirmBlock();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(ptMessages.crmContactPanel.blockError, {
        description: ptMessages.leads.errors.forbidden,
      }),
    );
    expect(onLeadPatched).not.toHaveBeenCalled();
  });

  it("renames with the newest version it holds and patches the store with the stored one", async () => {
    renameLeadAction.mockResolvedValue({
      status: "saved",
      lead: { id: "lead-1", workspaceId: "ws-1", number: "5511999990000", name: "Ana Paula", blocked: false, relativesCount: 0, referredCount: 0, version: 5 },
    });
    const { onLeadPatched } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /Ana/ }));
    const input = screen.getByLabelText(ptMessages.leads.rename.label);
    fireEvent.change(input, { target: { value: "Ana Paula" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(onLeadPatched).toHaveBeenCalledWith("lead-1", { lead_name: "Ana Paula", lead_version: 5 }));
    expect(renameLeadAction).toHaveBeenCalledWith("lead-1", "Ana Paula", 4);
  });
});
