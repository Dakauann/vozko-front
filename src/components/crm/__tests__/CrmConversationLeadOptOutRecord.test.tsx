import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { ActiveConversation, InboxEntry } from "@/lib/conversations/types";
import type { LeadCard } from "@/lib/leads/types";

const leadActions = vi.hoisted(() => ({
  blockLeadAction: vi.fn(),
  renameLeadAction: vi.fn(),
  getEntryLeadCardAction: vi.fn(),
  setLeadDistrictAction: vi.fn(),
  setLeadOwnerAction: vi.fn(),
  getLeadByIdAction: vi.fn(),
  optOutLeadAction: vi.fn(),
  grantLeadConsentAction: vi.fn(),
}));
const grants = vi.hoisted(() => ({ value: new Set<string>() }));

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
    can: (resource: string, action: string) => grants.value.has(`${resource}:${action}`),
    currentWorkspace: { id: "ws-1" },
  }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import CrmConversationInfosPanel from "../CrmConversationInfosPanel";

const conversation = {
  entry_id: "e-1",
  entry_type: "whatsapp",
  lead_id: "lead-1",
  lead_version: 3,
  lead_name: "Giovana",
  lead_number: "5511900010142",
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
  lead_version: 3,
  lead_name: "Giovana",
  lead_number: "5511900010142",
  blocked: false,
  unread_count: 0,
  last_message_at: "2026-10-16T19:59:00Z",
  window_open: true,
} as InboxEntry;

const optedOutCard: LeadCard = {
  leadId: "lead-1",
  version: 3,
  name: "Giovana",
  blocked: false,
  optedOutAt: "2026-10-16T19:59:00Z",
  optOutSource: "lead_request",
  optOut: { at: "2026-10-16T19:59:00Z", source: "button_reply", actorType: "lead", evidenceType: "button_reply", excerpt: "SAIR" },
  relativesCount: 0,
  referredCount: 0,
};

function renderPanel() {
  const onLeadPatched = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <CrmConversationInfosPanel
          open
          onClose={() => {}}
          conversation={conversation}
          inboxEntry={inboxEntry}
          canBlock={false}
          canManageMemories={false}
          canRenameLead={false}
          onLeadPatched={onLeadPatched}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { onLeadPatched };
}

const contact = ptMessages.leadExit.contact;
const regrant = ptMessages.leadExit.regrant;

beforeEach(() => {
  vi.clearAllMocks();
  grants.value = new Set(["conversations:read"]);
  leadActions.getEntryLeadCardAction.mockResolvedValue({ card: optedOutCard, error: null });
});

describe("contact panel opt-out record", () => {
  it("shows how the lead left and the proof, with no way to undo it for a viewer who cannot record consent", async () => {
    grants.value.add("leads:update");
    renderPanel();
    expect(await screen.findByText(contact.how.button_reply)).toBeInTheDocument();
    expect(screen.getByText(contact.evidence.replace("{excerpt}", "SAIR"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: contact.regrant })).toBeNull();
  });

  it("undoes the opt-out only through a recorded new consent", async () => {
    grants.value.add("leads:update");
    grants.value.add("leads:consent");
    leadActions.grantLeadConsentAction.mockResolvedValue({ lead: { id: "lead-1", workspaceId: "ws-1", number: "5511900010142", version: 4 }, changed: true, error: null });
    const { onLeadPatched } = renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: contact.regrant }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.change(within(dialog).getByLabelText(regrant.note), { target: { value: "Pediu por telefone" } });
    fireEvent.click(within(dialog).getByRole("button", { name: regrant.confirm }));

    await waitFor(() => expect(leadActions.grantLeadConsentAction).toHaveBeenCalledWith("lead-1", { note: "Pediu por telefone", purpose: "" }));
    await waitFor(() => expect(onLeadPatched).toHaveBeenCalledWith("lead-1", { lead_version: 4 }));
  });
});
