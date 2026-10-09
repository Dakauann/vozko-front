import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { toast } from "sonner";

import ptMessages from "@/i18n/messages/pt.json";

const actions = vi.hoisted(() => ({
  createOpportunityAction: vi.fn(),
  updateOpportunityAction: vi.fn(),
  deleteOpportunityAction: vi.fn(),
  listOpportunityConversationsAction: vi.fn(),
  unlinkOpportunityConversationAction: vi.fn(),
}));

vi.mock("@/app/actions/opportunities", () => actions);
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "u-1" } }) }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: () => false, currentWorkspace: { id: "ws-1" } }) }));
vi.mock("@/hooks/use-assignable-members", () => ({ useAssignableMembers: () => ({ members: [], names: new Map() }) }));
vi.mock("@/hooks/use-opportunity-creation", () => ({
  useOpportunityCreation: () => ({
    loading: false,
    open: true,
    setOpen: () => {},
    setup: { pipelineId: "p-1", columns: [{ id: "s-1", name: "Novo", total: 0, valueTotal: 0, entries: null }], customFields: [] },
    start: () => Promise.resolve(true),
  }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import CreateOpportunityButton from "../CreateOpportunityButton";

const t = ptMessages.opportunityDrawer;

beforeEach(() => {
  vi.clearAllMocks();
  actions.createOpportunityAction.mockResolvedValue({ opportunity: { id: "d-1" } });
});

describe("CreateOpportunityButton", () => {
  it("announces a deal created from a conversation once, with the way to its board", async () => {
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <CreateOpportunityButton entryId="e-1" entryType="whatsapp" leadName="Maria" workspaceId="ws-1" />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: t.create }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledTimes(1);
    const [message, options] = vi.mocked(toast.success).mock.calls[0];
    expect(message).toBe(t.fromConversation.created);
    expect(options).toMatchObject({ action: { label: t.fromConversation.viewBoard } });
    expect(actions.createOpportunityAction.mock.calls[0][0]).toMatchObject({ linkEntryId: "e-1", linkEntryType: "whatsapp", title: "Maria" });
  });
});
