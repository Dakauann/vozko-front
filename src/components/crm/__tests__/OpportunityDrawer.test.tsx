import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { Opportunity, OpportunityConversationLink } from "@/lib/crm/opportunities";

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

function deal(id: string, title: string, version = 1): Opportunity {
  return {
    id,
    workspaceId: "ws-1",
    pipelineId: "p-1",
    stageId: "s-1",
    title,
    valueCents: 0,
    currency: "BRL",
    status: "open",
    version,
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: `2026-10-0${version}T10:00:00Z`,
  };
}

function link(entryId: string, leadName: string): OpportunityConversationLink {
  return { entryId, entryType: "whatsapp", leadName } as OpportunityConversationLink;
}

function drawer(opportunity: Opportunity | null, open = true) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <OpportunityDrawer
        open={open}
        onOpenChange={() => {}}
        opportunity={opportunity}
        pipelineId="p-1"
        columns={columns}
        customFields={[]}
        workspaceId="ws-1"
        onSaved={() => {}}
      />
    </NextIntlClientProvider>
  );
}

const titleInput = () => screen.getByLabelText(t.title) as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  actions.listOpportunityConversationsAction.mockResolvedValue({ links: [] });
});

describe("OpportunityDrawer draft", () => {
  it("fills the form from the deal it opens, and from the next deal it opens", () => {
    const { rerender } = render(drawer(deal("d-1", "Matrícula Ana")));
    expect(titleInput().value).toBe("Matrícula Ana");

    fireEvent.change(titleInput(), { target: { value: "rascunho" } });
    rerender(drawer(deal("d-2", "Matrícula Bruna")));

    expect(titleInput().value).toBe("Matrícula Bruna");
  });

  it("keeps what the person typed while the same deal is read again unchanged", () => {
    const { rerender } = render(drawer(deal("d-1", "Matrícula Ana")));

    fireEvent.change(titleInput(), { target: { value: "rascunho" } });
    rerender(drawer({ ...deal("d-1", "Matrícula Ana") }));

    expect(titleInput().value).toBe("rascunho");
  });

  it("starts again from the saved deal when it is closed and opened again, or when the deal changed", () => {
    const { rerender } = render(drawer(deal("d-1", "Matrícula Ana")));

    fireEvent.change(titleInput(), { target: { value: "rascunho" } });
    rerender(drawer(deal("d-1", "Matrícula Ana"), false));
    rerender(drawer(deal("d-1", "Matrícula Ana")));
    expect(titleInput().value).toBe("Matrícula Ana");

    fireEvent.change(titleInput(), { target: { value: "rascunho" } });
    rerender(drawer(deal("d-1", "Matrícula Ana 2027", 2)));
    expect(titleInput().value).toBe("Matrícula Ana 2027");
  });
});

describe("OpportunityDrawer linked conversations", () => {
  it("shows the conversations of the deal it opened, never those of the deal opened before", async () => {
    actions.listOpportunityConversationsAction.mockImplementation((id: string) =>
      id === "d-1" ? Promise.resolve({ links: [link("e-1", "Ana")] }) : new Promise(() => {}),
    );
    const { rerender } = render(drawer(deal("d-1", "Matrícula Ana")));
    expect(await screen.findByText("Ana")).toBeInTheDocument();

    rerender(drawer(deal("d-2", "Matrícula Bruna")));

    expect(screen.queryByText("Ana")).toBeNull();
    expect(actions.listOpportunityConversationsAction).toHaveBeenLastCalledWith("d-2");
  });

  it("reads the conversations again after one is unlinked", async () => {
    actions.listOpportunityConversationsAction.mockResolvedValueOnce({ links: [link("e-1", "Ana")] }).mockResolvedValueOnce({ links: [] });
    actions.unlinkOpportunityConversationAction.mockResolvedValue({ success: true });
    render(drawer(deal("d-1", "Matrícula Ana")));

    fireEvent.click(await screen.findByRole("button", { name: ptMessages.opportunityLinkedConversations.unlinkWith.replace("{name}", "Ana") }));

    expect(await screen.findByText(ptMessages.opportunityLinkedConversations.empty)).toBeInTheDocument();
    expect(actions.unlinkOpportunityConversationAction).toHaveBeenCalledWith("d-1", "e-1", "whatsapp");
  });
});
