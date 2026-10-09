import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { toast } from "sonner";

import ptMessages from "@/i18n/messages/pt.json";
import { leadQueryKeys } from "@/hooks/use-lead-records";
import type { Opportunity } from "@/lib/crm/opportunities";

const leadActions = vi.hoisted(() => ({ listLeadDealsAction: vi.fn(), listLeadTimelineAction: vi.fn() }));
const setupActions = vi.hoisted(() => ({
  listPipelinesAction: vi.fn(),
  getOpportunityBoardAction: vi.fn(),
  listCustomFieldsAction: vi.fn(),
}));

vi.mock("@/app/actions/leads", () => leadActions);
vi.mock("@/app/actions/crm-board", () => ({ listPipelinesAction: setupActions.listPipelinesAction }));
vi.mock("@/app/actions/opportunities", () => ({ getOpportunityBoardAction: setupActions.getOpportunityBoardAction }));
vi.mock("@/app/actions/custom-fields", () => ({ listCustomFieldsAction: setupActions.listCustomFieldsAction }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: () => true, currentWorkspace: { id: "ws-1" } }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/crm/OpportunityDrawer", () => ({
  default: (props: {
    open: boolean;
    opportunity: Opportunity | null;
    leadId?: string;
    pipelineId: string;
    defaultTitle?: string;
    heading?: string;
    linkEntryId?: string;
    onSaved: () => void;
  }) =>
    props.open ? (
      <div
        data-testid="drawer"
        data-opportunity={props.opportunity?.id ?? ""}
        data-lead={props.leadId}
        data-pipeline={props.pipelineId}
        data-title={props.defaultTitle}
        data-heading={props.heading ?? ""}
        data-entry={props.linkEntryId ?? ""}
      >
        <button type="button" onClick={props.onSaved}>
          saved
        </button>
      </div>
    ) : null,
}));

import { LeadDealsTab } from "../LeadDealsTab";

const t = ptMessages.leadDetail.deals;
const tDrawer = ptMessages.opportunityDrawer;

function deal(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "d-1",
    workspaceId: "ws-1",
    leadId: "lead-1",
    pipelineId: "p-1",
    stageId: "s-1",
    title: "Matrícula Bruna 2027",
    valueCents: 150000,
    currency: "BRL",
    status: "open",
    ownerId: "u-1",
    ownerName: "Clara M.",
    version: 1,
    createdAt: "2026-09-30T13:00:00Z",
    updatedAt: "2026-09-30T13:00:00Z",
    ...overrides,
  };
}

function page(deals: Opportunity[], next?: string) {
  return { page: { leadId: "lead-1", deals, ...(next ? { next } : {}) }, error: null };
}

function renderTab({ canCreate = true, canEdit = false }: { canCreate?: boolean; canEdit?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <LeadDealsTab leadId="lead-1" leadName="Maria Souza" canCreate={canCreate} canEdit={canEdit} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  setupActions.listPipelinesAction.mockResolvedValue({
    pipelines: [
      { id: "p-1", name: "Atendimentos", isDefault: true },
      { id: "p-2", name: "Rematrículas", isDefault: false },
    ],
  });
  setupActions.getOpportunityBoardAction.mockResolvedValue({ board: { groupBy: "stage", columns: [{ id: "s-1", name: "Novo", total: 0, valueTotal: 0, entries: null }] } });
  setupActions.listCustomFieldsAction.mockResolvedValue({ fields: [] });
});

describe("lead deals tab", () => {
  it("lists the deals of the lead with status, value and owner", async () => {
    leadActions.listLeadDealsAction.mockResolvedValue(page([deal(), deal({ id: "d-2", title: "", status: "won", valueCents: 0, ownerId: "", ownerName: "" })]));

    renderTab();

    expect(await screen.findByText("Matrícula Bruna 2027")).toBeInTheDocument();
    expect(screen.getByText(t.status.open)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?1\.500,00/)).toBeInTheDocument();
    expect(screen.getByText("Responsável: Clara M.")).toBeInTheDocument();
    expect(screen.getByText(t.untitled)).toBeInTheDocument();
    expect(screen.getByText(t.status.won)).toBeInTheDocument();
    expect(screen.getByText(t.noOwner)).toBeInTheDocument();
    expect(leadActions.listLeadDealsAction).toHaveBeenCalledTimes(1);
    expect(leadActions.listLeadDealsAction.mock.calls[0][0]).toBe("lead-1");
    expect(leadActions.listLeadDealsAction.mock.calls[0][1]).toMatchObject({ before: undefined, limit: 30 });
  });

  it("opens the opportunity creation with the lead preset and no conversation, from the empty state", async () => {
    leadActions.listLeadDealsAction.mockResolvedValue(page([]));

    renderTab();

    expect(await screen.findByText(t.empty)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.add }));

    const drawer = await screen.findByTestId("drawer");
    expect(drawer.dataset.lead).toBe("lead-1");
    expect(drawer.dataset.pipeline).toBe("p-1");
    expect(drawer.dataset.title).toBe("Maria Souza");
    expect(drawer.dataset.entry).toBe("");
    expect(drawer.dataset.opportunity).toBe("");
    expect(drawer.dataset.heading).toBe(t.add);
  });

  it("reads the deals again once the new one is saved", async () => {
    leadActions.listLeadDealsAction.mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([deal()]));

    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: t.add }));
    fireEvent.click(await screen.findByRole("button", { name: "saved" }));

    expect(await screen.findByText("Matrícula Bruna 2027")).toBeInTheDocument();
    expect(leadActions.listLeadDealsAction).toHaveBeenCalledTimes(2);
  });

  it("keeps Novo atendimento in the header once the lead has deals", async () => {
    leadActions.listLeadDealsAction.mockResolvedValue(page([deal()]));

    renderTab();

    await screen.findByText("Matrícula Bruna 2027");
    expect(screen.getByRole("button", { name: t.add })).toBeInTheDocument();
  });

  it("offers no Novo atendimento to a viewer who may not create deals", async () => {
    leadActions.listLeadDealsAction.mockResolvedValue(page([]));

    renderTab({ canCreate: false });

    expect(await screen.findByText(t.empty)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.add })).toBeNull();
  });

  it("says the viewer has no access to deals instead of an error or an empty list", async () => {
    leadActions.listLeadDealsAction.mockResolvedValue({ page: null, error: { status: 403, code: "deals_forbidden", message: "no" } });

    renderTab();

    expect(await screen.findByText(t.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(t.empty)).toBeNull();
    expect(screen.queryByRole("button", { name: t.add })).toBeNull();
  });

  it("shows the section error when the deals cannot be read", async () => {
    leadActions.listLeadDealsAction.mockResolvedValue({ page: null, error: { status: 400, code: "lead_page_invalid", message: "bad" } });

    renderTab();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(t.empty)).toBeNull();
  });

  it("explains when the pipeline cannot be opened", async () => {
    leadActions.listLeadDealsAction.mockResolvedValue(page([]));
    setupActions.listPipelinesAction.mockResolvedValue({ pipelines: [] });

    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: t.add }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(tDrawer.openFailed));
    expect(screen.queryByTestId("drawer")).toBeNull();
  });

  it("pages the deals with the cursor the server gave", async () => {
    leadActions.listLeadDealsAction.mockResolvedValueOnce(page([deal()], "cur-1")).mockResolvedValueOnce(page([deal({ id: "d-9", title: "Rematrícula" })]));

    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: t.loadMore }));

    expect(await screen.findByText("Rematrícula")).toBeInTheDocument();
    expect(leadActions.listLeadDealsAction.mock.calls[1][1]).toMatchObject({ before: "cur-1" });
    expect(screen.queryByRole("button", { name: t.loadMore })).toBeNull();
  });

  it("opens a deal from its title on the stages of its own pipeline, to move, reassign or close it", async () => {
    leadActions.listLeadDealsAction.mockResolvedValueOnce(page([deal({ pipelineId: "p-2" })])).mockResolvedValueOnce(page([deal({ pipelineId: "p-2", status: "won" })]));

    renderTab({ canEdit: true });

    fireEvent.click(await screen.findByRole("button", { name: "Matrícula Bruna 2027" }));

    const drawer = await screen.findByTestId("drawer");
    expect(drawer.dataset.opportunity).toBe("d-1");
    expect(drawer.dataset.pipeline).toBe("p-2");
    expect(setupActions.getOpportunityBoardAction).toHaveBeenCalledWith({ groupBy: "stage", pipelineId: "p-2", pageSize: 1 });

    fireEvent.click(screen.getByRole("button", { name: "saved" }));
    expect(await screen.findByText(t.status.won)).toBeInTheDocument();
    expect(leadActions.listLeadDealsAction).toHaveBeenCalledTimes(2);
  });

  it("lists the deal as text for a viewer who may not change deals", async () => {
    leadActions.listLeadDealsAction.mockResolvedValue(page([deal()]));

    renderTab();

    expect(await screen.findByText("Matrícula Bruna 2027")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Matrícula Bruna 2027" })).toBeNull();
  });

  it("shows a status it does not know as open, never the raw value", async () => {
    leadActions.listLeadDealsAction.mockResolvedValue(page([deal({ status: "archived" as Opportunity["status"] })]));

    renderTab();

    expect(await screen.findByText(t.status.open)).toBeInTheDocument();
    expect(screen.queryByText("archived")).toBeNull();
  });

  it("keeps the loaded deals and offers a retry when reading them again fails", async () => {
    leadActions.listLeadDealsAction.mockResolvedValueOnce(page([deal()])).mockResolvedValue({ page: null, error: { status: 400, code: "lead_page_invalid", message: "bad" } });

    const client = renderTab();
    await screen.findByText("Matrícula Bruna 2027");

    await client.invalidateQueries({ queryKey: leadQueryKeys.deals("ws-1", "lead-1") });

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Matrícula Bruna 2027")).toBeInTheDocument();
  });
});
