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
vi.mock("@/components/crm/OpportunityHistory", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import OpportunityDrawer from "../OpportunityDrawer";

const t = ptMessages.opportunityDrawer;

const columns = [{ id: "s-1", name: "Novo", total: 0, valueTotal: 0, entries: null }];

function renderDrawer(props: { leadId?: string; defaultTitle?: string; heading?: string }) {
  const onSaved = vi.fn();
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <OpportunityDrawer
        open
        onOpenChange={() => {}}
        opportunity={null}
        pipelineId="p-1"
        columns={columns}
        customFields={[]}
        workspaceId="ws-1"
        onSaved={onSaved}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return onSaved;
}

beforeEach(() => {
  vi.clearAllMocks();
  actions.createOpportunityAction.mockResolvedValue({ opportunity: { id: "d-1" } });
});

describe("OpportunityDrawer for a lead", () => {
  it("creates the deal with the lead it was opened for and no conversation", async () => {
    const onSaved = renderDrawer({ leadId: "lead-1", defaultTitle: "Maria" });

    fireEvent.click(screen.getByRole("button", { name: t.create }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const input = actions.createOpportunityAction.mock.calls[0][0];
    expect(input).toMatchObject({ pipelineId: "p-1", stageId: "s-1", title: "Maria", leadId: "lead-1" });
    expect(input.linkEntryId).toBeUndefined();
  });

  it("lets a deal with a lead be saved without a title, as the server accepts a lead in place of one", async () => {
    const onSaved = renderDrawer({ leadId: "lead-1" });

    fireEvent.click(screen.getByRole("button", { name: t.create }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(actions.createOpportunityAction.mock.calls[0][0]).toMatchObject({ title: "", leadId: "lead-1" });
  });

  it("still needs a title for a deal without a lead", () => {
    renderDrawer({});

    expect(screen.getByRole("button", { name: t.create })).toBeDisabled();
  });

  it("speaks the viewer's language when it creates, and takes the heading of the entry point that opened it", async () => {
    renderDrawer({ leadId: "lead-1", heading: "Novo atendimento" });

    expect(screen.getByText("Novo atendimento")).toBeInTheDocument();
    expect(screen.queryByText(t.createTitle)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t.create }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.created));
  });

  it("explains a refused creation in the viewer's language when the server gives no reason", async () => {
    actions.createOpportunityAction.mockResolvedValue({ opportunity: null, error: null });
    renderDrawer({ leadId: "lead-1" });

    expect(screen.getByText(t.createTitle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.create }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(t.createFailed));
  });
});
