import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";

import { toast } from "sonner";

import ptMessages from "@/i18n/messages/pt.json";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import type { LeadDetail as LeadDetailRecord } from "@/lib/leads/types";

const leadActions = vi.hoisted(() => ({
  getLeadByIdAction: vi.fn(),
  getLeadSummaryAction: vi.fn(),
  listLeadRelativesAction: vi.fn(),
  listLeadTimelineAction: vi.fn(),
  listLeadDealsAction: vi.fn(),
  blockLeadAction: vi.fn(),
  optOutLeadAction: vi.fn(),
  anonymizeLeadAction: vi.fn(),
}));
const fieldDefinitions = vi.hoisted(() => ({ value: [] as CustomFieldDefinition[] }));
const grants = vi.hoisted(() => ({ value: new Set<string>() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));
const socket = vi.hoisted(() => ({
  value: null as null | { status: string; subscribeLeadUpdates: (listener: (event: { leadId: string; version: number; fields: string[] }) => void) => () => void },
  listeners: new Set<(event: { leadId: string; version: number; fields: string[] }) => void>(),
}));
const definitionsGate = vi.hoisted(() => ({ hold: false }));
const dialTargets = vi.hoisted(() => ({ fetch: vi.fn() }));
const dealSetup = vi.hoisted(() => ({
  listPipelinesAction: vi.fn(),
  getOpportunityBoardAction: vi.fn(),
}));

vi.mock("@/app/actions/leads", () => leadActions);
vi.mock("@/app/actions/custom-fields", () => ({
  listCustomFieldsAction: () =>
    definitionsGate.hold ? new Promise(() => {}) : Promise.resolve({ fields: fieldDefinitions.value, error: null }),
}));
vi.mock("@/contexts/crm-context", () => ({ useOptionalCrm: () => socket.value }));
vi.mock("@/app/actions/crm-board", () => ({ listPipelinesAction: dealSetup.listPipelinesAction }));
vi.mock("@/app/actions/opportunities", () => ({ getOpportunityBoardAction: dealSetup.getOpportunityBoardAction }));
vi.mock("@/components/crm/OpportunityDrawer", () => ({
  default: (props: { open: boolean; leadId?: string; linkEntryId?: string; pipelineId: string }) =>
    props.open ? <div data-testid="deal-drawer" data-lead={props.leadId ?? ""} data-entry={props.linkEntryId ?? ""} data-pipeline={props.pipelineId} /> : null,
}));
vi.mock("@/contexts/call-session-context", () => ({ useCallSession: () => ({ status: "connected", callState: null }) }));
vi.mock("@/app/actions/sip-trunks", () => ({ fetchDialTargets: dialTargets.fetch }));
vi.mock("@/app/actions/workspace", () => ({
  listAssignableMembersAction: () =>
    Promise.resolve({ members: [{ userId: "u-1", username: "Clara Mendes" }], page: 1, pageSize: 1, totalPages: 1, totalItems: 1 }),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    can: (resource: string, action: string) => grants.value.has(`${resource}:${action}`),
    currentWorkspace: { id: "ws-1" },
  }),
}));
const sendGate = vi.hoisted(() => ({
  states: { send_template: { enabled: false, reason: "permissionSendTemplate" }, send_message: { enabled: false, reason: "permissionSendUnofficial" } } as Record<
    string,
    { enabled: boolean; reason?: string }
  >,
}));
vi.mock("@/components/leads/sends/use-lead-send-gate", () => ({ useLeadSendGate: () => sendGate.states }));
vi.mock("@/components/leads/sends/LeadSendDialog", () => ({
  LeadSendDialog: ({ action, selection }: { action: string; selection: { mode: string; ids: string[] } }) => (
    <div role="dialog" aria-label={action}>
      {selection.mode}:{selection.ids.join(",")}
    </div>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/leads/sheet/LeadSheet", () => ({
  LeadSheet: ({ open, leadId }: { open: boolean; leadId?: string | null }) =>
    open ? <div data-testid="lead-sheet">{leadId}</div> : null,
}));
vi.mock("@/components/crm/LeadMemoriesSection", () => ({
  default: ({ leadId }: { leadId: string }) => <div data-testid="memories">{leadId}</div>,
}));

import { LeadDetail } from "../LeadDetail";
import { subscribeCallRequest, type CallRequest } from "@/lib/call-session/call-session-control";

const classification: CustomFieldDefinition = {
  id: "f-1",
  workspaceId: "ws-1",
  objectType: "lead",
  key: "interesse",
  label: "Interesse",
  type: "select",
  options: ["Matriculado", "Visitou"],
  optionTones: { Matriculado: "chart-2" },
  required: false,
  sensitive: false,
  readable: true,
  role: "classification",
  position: 0,
  createdAt: "",
  updatedAt: "",
};

const health: CustomFieldDefinition = {
  ...classification,
  id: "f-2",
  key: "saude",
  label: "Saúde da aluna",
  type: "text",
  options: undefined,
  optionTones: undefined,
  role: undefined,
  sensitive: true,
  readable: false,
  legalBasis: "consentimento",
  position: 1,
};

function stored(overrides: Partial<LeadDetailRecord> = {}): LeadDetailRecord {
  return {
    id: "lead-1",
    workspaceId: "ws-1",
    number: "5511900010142",
    name: "Maria Aparecida Souza",
    realName: "Maria Aparecida Souza",
    owner: "u-1",
    ownerName: "Clara Mendes",
    blocked: false,
    relativesCount: 2,
    referredCount: 1,
    version: 4,
    phones: [{ id: "p-1", number: "551141990000", label: "landline" }],
    addresses: [
      {
        id: "a-1",
        label: "home",
        primary: true,
        street: "R. das Acácias",
        number: "120",
        district: "Jardim Silveira",
        city: "Barueri",
        state: "SP",
        zipCode: "06402000",
        geoStatus: "pending",
      },
    ],
    customFields: { interesse: "Matriculado", saude: "Restrição alimentar" },
    whatsappCampaigns: 1,
    totalCampaigns: 1,
    whatsappWindowOpen: true,
    campaigns: [],
    ...overrides,
  };
}

function renderDetail(initialTab?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <LeadDetail leadId="lead-1" initialTab={initialTab} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function openTab(name: RegExp) {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });
}

const t = ptMessages.leadDetail;

beforeEach(() => {
  sendGate.states = { send_template: { enabled: false, reason: "permissionSendTemplate" }, send_message: { enabled: false, reason: "permissionSendUnofficial" } };
  vi.clearAllMocks();
  grants.value = new Set(["leads:read", "leads:update", "members:read"]);
  fieldDefinitions.value = [classification, health];
  definitionsGate.hold = false;
  socket.listeners = new Set();
  socket.value = null;
  leadActions.getLeadByIdAction.mockResolvedValue({ lead: stored(), error: null });
  leadActions.getLeadSummaryAction.mockResolvedValue({ summary: { memoriesCount: 0, sharedNumbers: [] }, error: null });
  leadActions.listLeadRelativesAction.mockResolvedValue({
    page: { items: [{ relationId: "r-1", leadId: "lead-2", kind: "spouse", dimension: "family", name: "João Souza", number: "5511900023301" }] },
    error: null,
  });
  leadActions.listLeadTimelineAction.mockResolvedValue({
    page: { leadId: "lead-1", items: [{ id: "memory:m-1", kind: "memory", at: "2026-10-08T14:32:00Z", ref: { type: "memory", id: "m-1" }, summary: { text: "Tem dois filhos" } }] },
    error: null,
  });
  leadActions.listLeadDealsAction.mockResolvedValue({ page: { leadId: "lead-1", deals: [] }, error: null });
  dealSetup.listPipelinesAction.mockResolvedValue({ pipelines: [{ id: "p-1", name: "Atendimentos", isDefault: true }] });
  dealSetup.getOpportunityBoardAction.mockResolvedValue({ board: { groupBy: "stage", columns: [{ id: "s-1", name: "Novo", total: 0, valueTotal: 0, entries: null }] } });
});

describe("lead detail header", () => {
  it("loads the lead once and names it with its identity, bairro, classification and owner", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { level: 1, name: "Maria Aparecida Souza" })).toBeInTheDocument();
    expect(screen.getByText("+55 (11) 90001-0142 · Jardim Silveira · Barueri/SP")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("Matriculado").length).toBeGreaterThan(0));
    expect(await screen.findByText("Responsável: Clara Mendes")).toBeInTheDocument();
    expect(leadActions.getLeadByIdAction).toHaveBeenCalledTimes(1);
    expect(leadActions.getLeadByIdAction.mock.calls[0][0]).toBe("lead-1");
  });

  it("calls the lead from the header, before Editar, with the lead attached", async () => {
    grants.value = new Set(["leads:read", "leads:update", "sip_trunks:call", "sip_trunks:read", "call_session:use"]);
    dialTargets.fetch.mockResolvedValue({
      leadId: "lead-1",
      callable: "5511900010142",
      numbers: [{ number: "5511900010142", identity: true }],
      trunks: [{ id: "t1", name: "Matriz" }],
    });
    const requests: CallRequest[] = [];
    const unsubscribe = subscribeCallRequest((request) => requests.push(request));
    renderDetail();
    const callButton = () => screen.getByRole("button", { name: ptMessages.calling.dialTargets.call });
    await screen.findByRole("button", { name: ptMessages.calling.dialTargets.call });
    const edit = screen.getByRole("button", { name: t.actions.edit });
    expect(callButton().compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await waitFor(() => expect(callButton().getAttribute("aria-disabled")).toBeNull());
    fireEvent.click(callButton());
    expect(requests).toEqual([{ phoneNumber: "5511900010142", trunkId: "t1", label: "Matriz", leadId: "lead-1" }]);
    expect(dialTargets.fetch.mock.calls[0][0]).toBe("lead-1");
    unsubscribe();
  });

  it("offers Enviar template before Ligar and Mensagem after it, each sending to this lead", async () => {
    grants.value = new Set(["leads:read", "leads:update", "sip_trunks:call", "sip_trunks:read", "call_session:use"]);
    sendGate.states = { send_template: { enabled: true }, send_message: { enabled: true } };
    dialTargets.fetch.mockResolvedValue({ leadId: "lead-1", callable: "5511900010142", numbers: [], trunks: [{ id: "t1", name: "Matriz" }] });
    renderDetail();
    const call = await screen.findByRole("button", { name: ptMessages.calling.dialTargets.call });
    const template = screen.getByRole("button", { name: t.actions.sendTemplate });
    const message = screen.getByRole("button", { name: t.actions.sendMessage });
    expect(template.compareDocumentPosition(call) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(call.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(message);
    expect(screen.getByRole("dialog", { name: "send_unofficial" })).toHaveTextContent("ids:lead-1");
  });

  it("calls a chosen number from its row in Contato, with one request for the whole page", async () => {
    grants.value = new Set(["leads:read", "leads:update", "sip_trunks:call", "sip_trunks:read", "call_session:use"]);
    dialTargets.fetch.mockResolvedValue({
      leadId: "lead-1",
      callable: "5511900010142",
      numbers: [
        { number: "5511900010142", identity: true },
        { number: "551141990000", identity: false, label: "landline", phoneId: "p-1" },
      ],
      trunks: [{ id: "t1", name: "Matriz" }],
    });
    const requests: CallRequest[] = [];
    const unsubscribe = subscribeCallRequest((request) => requests.push(request));
    renderDetail();
    const landline = () => screen.getByRole("button", { name: /^Ligar para .*4199-0000/ });
    await waitFor(() => expect(landline().getAttribute("aria-disabled")).toBeNull());
    expect(screen.getByRole("button", { name: /^Ligar para .*90001-0142/ })).toBeInTheDocument();
    fireEvent.click(landline());
    expect(requests).toEqual([{ phoneNumber: "551141990000", trunkId: "t1", label: "Matriz", leadId: "lead-1" }]);
    expect(dialTargets.fetch).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("offers no Ligar to someone who may not place calls", async () => {
    renderDetail();
    await screen.findByRole("button", { name: t.actions.edit });
    expect(screen.queryByRole("button", { name: ptMessages.calling.dialTargets.call })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Ligar para / })).toBeNull();
    expect(dialTargets.fetch).not.toHaveBeenCalled();
  });

  it("opens the sheet on Editar", async () => {
    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: t.actions.edit }));
    expect(screen.getByTestId("lead-sheet")).toHaveTextContent("lead-1");
  });

  it("says once that the lead could not be loaded", async () => {
    leadActions.getLeadByIdAction.mockResolvedValue({ lead: null, error: { status: 403, code: "forbidden" } });
    renderDetail();
    expect(await screen.findByText(t.loadFailed)).toBeInTheDocument();
    expect(screen.getAllByText(t.loadFailed)).toHaveLength(1);
    expect(screen.queryByText(ptMessages.metricsOps.common.sectionError)).toBeNull();
  });

  it("says the lead is gone on a 404", async () => {
    leadActions.getLeadByIdAction.mockResolvedValue({ lead: null, error: { status: 404, code: "lead_not_found" } });
    renderDetail();
    expect(await screen.findByText(t.notFound)).toBeInTheDocument();
  });
});

describe("lead detail summary", () => {
  it("counts the deals and the memories on their tabs from one summary read", async () => {
    leadActions.getLeadSummaryAction.mockResolvedValue({ summary: { dealsCount: 1, memoriesCount: 4, sharedNumbers: [] }, error: null });
    renderDetail();
    await waitFor(() => expect(screen.getByRole("tab", { name: /Negócios/ })).toHaveTextContent(`${t.tabs.deals}1`));
    expect(screen.getByRole("tab", { name: /Memórias/ })).toHaveTextContent(`${t.tabs.memories}4`);
    expect(leadActions.getLeadSummaryAction).toHaveBeenCalledTimes(1);
    expect(leadActions.getLeadSummaryAction.mock.calls[0][0]).toBe("lead-1");
    expect(leadActions.listLeadDealsAction).not.toHaveBeenCalled();
  });

  it("shows no deal count to a viewer the server gives none", async () => {
    leadActions.getLeadSummaryAction.mockResolvedValue({ summary: { memoriesCount: 2, sharedNumbers: [] }, error: null });
    renderDetail();
    await waitFor(() => expect(screen.getByRole("tab", { name: /Memórias/ })).toHaveTextContent(`${t.tabs.memories}2`));
    expect(screen.getByRole("tab", { name: /Negócios/ }).textContent).toBe(t.tabs.deals);
  });

  it("keeps the page when the summary fails, without counts or holders", async () => {
    leadActions.getLeadSummaryAction.mockResolvedValue({ summary: null, error: { status: 500, message: "boom" } });
    renderDetail();
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(leadActions.getLeadSummaryAction).toHaveBeenCalled());
    expect(screen.getByRole("tab", { name: /Memórias/ }).textContent).toBe(t.tabs.memories);
    expect(screen.queryByText(/também de/)).toBeNull();
  });

  it("names the other leads that share a contact phone, each a link to its lead", async () => {
    leadActions.getLeadSummaryAction.mockResolvedValue({
      summary: {
        memoriesCount: 0,
        sharedNumbers: [{ number: "551141990000", holders: [{ leadId: "lead-2", name: "João Souza" }, { leadId: "lead-3", name: "Bruna Souza" }], more: false }],
      },
      error: null,
    });
    renderDetail();
    const contact = await screen.findByRole("region", { name: t.contact.title });
    expect(await within(contact).findByText(/também de/)).toHaveTextContent("também de João Souza e Bruna Souza");
    expect(within(contact).getByRole("link", { name: "João Souza" })).toHaveAttribute("href", "/dashboard/leads/lead-2");
    expect(within(contact).getAllByText(/também de/)).toHaveLength(1);
  });
});

describe("lead detail tabs", () => {
  it("asks for the family only when Família opens, once", async () => {
    renderDetail();
    await screen.findByRole("heading", { level: 1 });
    expect(leadActions.listLeadRelativesAction).not.toHaveBeenCalled();
    expect(screen.queryByTestId("memories")).toBeNull();

    openTab(/Família/);
    expect(await screen.findByText("João Souza")).toBeInTheDocument();
    expect(screen.getByText(ptMessages.leadSheet.family.kinds.spouse)).toBeInTheDocument();
    expect(leadActions.listLeadRelativesAction).toHaveBeenCalledTimes(1);
    expect(leadActions.listLeadRelativesAction.mock.calls[0][0]).toBe("lead-1");

    openTab(/Memórias/);
    expect(await screen.findByTestId("memories")).toHaveTextContent("lead-1");
    openTab(/Família/);
    expect(await screen.findByText("João Souza")).toBeInTheDocument();
    expect(leadActions.listLeadRelativesAction).toHaveBeenCalledTimes(1);
  });

  it("orders the tabs as Visão geral, Família, Linha do tempo, Negócios, Memórias, Campanhas", async () => {
    renderDetail();
    await screen.findByRole("heading", { level: 1 });
    const names = screen.getAllByRole("tab").map((tab) => tab.textContent?.replace(/\d+$/, ""));
    expect(names).toEqual([t.tabs.overview, t.tabs.family, t.tabs.timeline, t.tabs.deals, t.tabs.memories, t.tabs.campaigns]);
  });

  it("asks for the timeline only when Linha do tempo opens, once", async () => {
    renderDetail();
    await screen.findByRole("heading", { level: 1 });
    expect(leadActions.listLeadTimelineAction).not.toHaveBeenCalled();

    openTab(/Linha do tempo/);
    expect(await screen.findByText("Memória: Tem dois filhos")).toBeInTheDocument();
    expect(leadActions.listLeadTimelineAction).toHaveBeenCalledTimes(1);
    expect(leadActions.listLeadTimelineAction.mock.calls[0][0]).toBe("lead-1");

    openTab(/Visão geral/);
    openTab(/Linha do tempo/);
    expect(await screen.findByText("Memória: Tem dois filhos")).toBeInTheDocument();
    expect(leadActions.listLeadTimelineAction).toHaveBeenCalledTimes(1);
    expect(leadActions.listLeadDealsAction).not.toHaveBeenCalled();
  });

  it("sends the empty timeline to Memórias to record the first memory", async () => {
    leadActions.listLeadTimelineAction.mockResolvedValue({ page: { leadId: "lead-1", items: [] }, error: null });
    renderDetail("timeline");
    fireEvent.click(await screen.findByRole("button", { name: t.timeline.addMemory }));
    expect(await screen.findByTestId("memories")).toHaveTextContent("lead-1");
  });

  it("asks for the deals only when Negócios opens, and offers Novo atendimento to whoever may create deals", async () => {
    grants.value = new Set(["leads:read", "conversations:create"]);
    renderDetail();
    await screen.findByRole("heading", { level: 1 });
    expect(leadActions.listLeadDealsAction).not.toHaveBeenCalled();

    openTab(/Negócios/);
    expect(await screen.findByText(t.deals.empty)).toBeInTheDocument();
    expect(within(screen.getByRole("tabpanel")).getByRole("button", { name: t.deals.add })).toBeInTheDocument();
    expect(leadActions.listLeadDealsAction).toHaveBeenCalledTimes(1);
    expect(leadActions.listLeadDealsAction.mock.calls[0][0]).toBe("lead-1");
  });

  it("offers no Novo atendimento without conversations:create", async () => {
    renderDetail("deals");
    expect(await screen.findByText(t.deals.empty)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.deals.add })).toBeNull();
  });

  it("opens Novo atendimento from the page header for this lead, with no conversation", async () => {
    grants.value = new Set(["leads:read", "conversations:create"]);
    renderDetail();
    await screen.findByRole("heading", { level: 1 });

    fireEvent.click(screen.getByRole("button", { name: t.deals.add }));

    const drawer = await screen.findByTestId("deal-drawer");
    expect(drawer.dataset.lead).toBe("lead-1");
    expect(drawer.dataset.entry).toBe("");
    expect(drawer.dataset.pipeline).toBe("p-1");
  });

  it("starts on the tab the link asked for", async () => {
    renderDetail("family");
    expect(await screen.findByText("João Souza")).toBeInTheDocument();
  });

  it("offers to add a relative when the family is empty", async () => {
    leadActions.listLeadRelativesAction.mockResolvedValue({ page: { items: [] }, error: null });
    renderDetail("family");
    expect(await screen.findByText(t.family.empty)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.family.add }));
    expect(screen.getByTestId("lead-sheet")).toHaveTextContent("lead-1");
  });

  it("shows the section error, not an empty list, when the family fails", async () => {
    leadActions.listLeadRelativesAction.mockResolvedValue({ page: null, error: { status: 500, message: "boom" } });
    renderDetail("family");
    expect(await screen.findByRole("alert", undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByText(t.family.empty)).toBeNull();
  });

  it("pages the family with the cursor the server gave", async () => {
    leadActions.listLeadRelativesAction
      .mockResolvedValueOnce({ page: { items: [{ relationId: "r-1", leadId: "lead-2", kind: "spouse", dimension: "family", name: "João Souza" }], next: "cur-1" }, error: null })
      .mockResolvedValueOnce({ page: { items: [{ relationId: "r-2", leadId: "lead-3", kind: "child", dimension: "family", name: "Bruna Souza" }] }, error: null });
    renderDetail("family");
    fireEvent.click(await screen.findByRole("button", { name: t.family.loadMore }));
    expect(await screen.findByText("Bruna Souza")).toBeInTheDocument();
    expect(leadActions.listLeadRelativesAction.mock.calls[1][1]).toMatchObject({ after: "cur-1" });
    expect(screen.queryByRole("button", { name: t.family.loadMore })).toBeNull();
  });
});

describe("lead overview", () => {
  it("keeps sensitive values from a viewer without leads:read_sensitive", async () => {
    leadActions.getLeadByIdAction.mockResolvedValue({ lead: stored({ customFields: { interesse: "Matriculado" } }), error: null });
    renderDetail();
    const fields = await screen.findByRole("region", { name: t.customFields.title });
    await waitFor(() => expect(within(fields).getByText("Interesse")).toBeInTheDocument());
    expect(within(fields).queryByText("Saúde da aluna")).toBeNull();
    expect(within(fields).getByText(/1 campo sensível não aparece/)).toBeInTheDocument();
  });

  it("shows a loading line, not the empty state, while the field definitions load", async () => {
    definitionsGate.hold = true;
    renderDetail();
    const fields = await screen.findByRole("region", { name: t.customFields.title });
    expect(within(fields).getByText(t.customFields.loading)).toBeInTheDocument();
    expect(within(fields).queryByText(t.customFields.empty)).toBeNull();
  });

  it("locks a sensitive value for a viewer the server lets read it", async () => {
    fieldDefinitions.value = [classification, { ...health, readable: true }];
    renderDetail();
    const fields = await screen.findByRole("region", { name: t.customFields.title });
    expect(await within(fields).findByText("Restrição alimentar")).toBeInTheDocument();
    expect(within(fields).getByLabelText("Dado sensível. Base legal: consentimento")).toBeInTheDocument();
  });

  it("shows the street only to a viewer who may read addresses", async () => {
    renderDetail();
    const address = await screen.findByRole("region", { name: t.address.title });
    expect(within(address).getByText(t.address.restricted)).toBeInTheDocument();
    expect(within(address).getByText(t.address.geoStatus.pending)).toBeInTheDocument();
  });

  it("offers to add an address only to a viewer who may read addresses", async () => {
    leadActions.getLeadByIdAction.mockResolvedValue({ lead: stored({ addresses: [] }), error: null });
    renderDetail();
    const address = await screen.findByRole("region", { name: t.address.title });
    expect(within(address).getByText(t.address.empty)).toBeInTheDocument();
    expect(within(address).queryByRole("button", { name: t.address.add })).toBeNull();
  });

  it("opens the sheet from the empty address block with leads:read_addresses", async () => {
    grants.value.add("leads:read_addresses");
    leadActions.getLeadByIdAction.mockResolvedValue({ lead: stored({ addresses: [] }), error: null });
    renderDetail();
    const address = await screen.findByRole("region", { name: t.address.title });
    fireEvent.click(within(address).getByRole("button", { name: t.address.add }));
    expect(screen.getByTestId("lead-sheet")).toHaveTextContent("lead-1");
  });

  it("shows the full address with leads:read_addresses", async () => {
    grants.value.add("leads:read_addresses");
    renderDetail();
    const address = await screen.findByRole("region", { name: t.address.title });
    expect(within(address).getByText("R. das Acácias, 120")).toBeInTheDocument();
    expect(within(address).queryByText(t.address.restricted)).toBeNull();
  });

  it("falls back to the member list when the server sent no owner name", async () => {
    leadActions.getLeadByIdAction.mockResolvedValue({ lead: stored({ ownerName: undefined }), error: null });
    renderDetail();
    expect(await screen.findByText("Responsável: Clara Mendes")).toBeInTheDocument();
  });

  it("names the owner the server sent, even one missing from the member list", async () => {
    leadActions.getLeadByIdAction.mockResolvedValue({ lead: stored({ owner: "u-9", ownerName: "Marina Costa" }), error: null });
    renderDetail();
    expect(await screen.findByText("Responsável: Marina Costa")).toBeInTheDocument();
  });

  it("shows the purpose the consent was given for", async () => {
    leadActions.getLeadByIdAction.mockResolvedValue({
      lead: stored({ whatsappOptIn: { grantedAt: "2026-09-20T12:00:00Z", source: "form", purpose: "Avisos da matrícula" } }),
      error: null,
    });
    renderDetail();
    const consent = await screen.findByRole("region", { name: t.consent.title });
    expect(within(consent).getByText(t.consent.purpose)).toBeInTheDocument();
    expect(within(consent).getByText("Avisos da matrícula")).toBeInTheDocument();
  });

  it("leaves the purpose out when the consent names none", async () => {
    leadActions.getLeadByIdAction.mockResolvedValue({
      lead: stored({ whatsappOptIn: { grantedAt: "2026-09-20T12:00:00Z", source: "form" } }),
      error: null,
    });
    renderDetail();
    const consent = await screen.findByRole("region", { name: t.consent.title });
    expect(within(consent).queryByText(t.consent.purpose)).toBeNull();
  });

  it("links a located address to the leads map, focused on this lead, with leads:read_addresses", async () => {
    grants.value.add("leads:read_addresses");
    leadActions.getLeadByIdAction.mockResolvedValue({
      lead: stored({ addresses: [{ ...stored().addresses![0], geoStatus: "located", latitude: -23.5, longitude: -46.87, precision: "exact" }] }),
      error: null,
    });
    renderDetail();
    const address = await screen.findByRole("region", { name: t.address.title });
    expect(within(address).getByRole("link", { name: t.address.showOnMap })).toHaveAttribute("href", "/dashboard/leads?view=map&focus=lead-1");
  });

  it("offers no map link without leads:read_addresses or without a position", async () => {
    leadActions.getLeadByIdAction.mockResolvedValue({
      lead: stored({ addresses: [{ ...stored().addresses![0], geoStatus: "located", latitude: -23.5, longitude: -46.87, precision: "exact" }] }),
      error: null,
    });
    const { unmount } = renderDetail();
    const restricted = await screen.findByRole("region", { name: t.address.title });
    expect(within(restricted).queryByRole("link", { name: t.address.showOnMap })).toBeNull();
    unmount();

    grants.value.add("leads:read_addresses");
    leadActions.getLeadByIdAction.mockResolvedValue({ lead: stored(), error: null });
    renderDetail();
    const pending = await screen.findByRole("region", { name: t.address.title });
    expect(within(pending).queryByRole("link", { name: t.address.showOnMap })).toBeNull();
  });

  it("counts a missing consent instead of hiding it", async () => {
    renderDetail();
    const consent = await screen.findByRole("region", { name: t.consent.title });
    expect(within(consent).getByText(t.consent.none)).toBeInTheDocument();
  });

  it("says who decided the opt-out", async () => {
    leadActions.getLeadByIdAction.mockResolvedValue({
      lead: stored({ optedOutAt: "2026-10-08T12:00:00Z", optOutSource: "lead_request" }),
      error: null,
    });
    renderDetail();
    const consent = await screen.findByRole("region", { name: t.consent.title });
    expect(within(consent).getByText(/a pedido do lead/)).toBeInTheDocument();
  });
});

function openMoreActions() {
  fireEvent.keyDown(screen.getByRole("button", { name: t.actions.more }), { key: "Enter" });
}

function connectSocket() {
  socket.value = {
    status: "connected",
    subscribeLeadUpdates: (listener) => {
      socket.listeners.add(listener);
      return () => socket.listeners.delete(listener);
    },
  };
}

function emit(event: { leadId: string; version: number; fields: string[] }) {
  for (const listener of socket.listeners) listener(event);
}

describe("lead detail freshness", () => {
  it("reads the lead again when the socket says this lead moved to a newer version", async () => {
    connectSocket();
    renderDetail();
    await screen.findByRole("heading", { level: 1 });
    expect(leadActions.getLeadByIdAction).toHaveBeenCalledTimes(1);

    emit({ leadId: "lead-2", version: 9, fields: ["name"] });
    emit({ leadId: "lead-1", version: 4, fields: ["name"] });
    expect(leadActions.getLeadByIdAction).toHaveBeenCalledTimes(1);

    leadActions.getLeadByIdAction.mockResolvedValue({ lead: stored({ version: 5, realName: "Maria Souza" }), error: null });
    emit({ leadId: "lead-1", version: 5, fields: ["name"] });
    expect(await screen.findByRole("heading", { level: 1, name: "Maria Souza" })).toBeInTheDocument();
    expect(leadActions.getLeadByIdAction).toHaveBeenCalledTimes(2);
  });

  it("leaves the page with a notice when the lead is anonymized elsewhere", async () => {
    connectSocket();
    renderDetail();
    await screen.findByRole("heading", { level: 1 });

    emit({ leadId: "lead-1", version: 5, fields: ["anonymized"] });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/leads"));
    expect(toast.info).toHaveBeenCalledWith(t.anonymizedElsewhere);
    expect(leadActions.getLeadByIdAction).toHaveBeenCalledTimes(1);
  });

  it("reads the lead again on focus when there is no live socket", async () => {
    renderDetail();
    await screen.findByRole("heading", { level: 1 });
    fireEvent.focus(window);
    await waitFor(() => expect(leadActions.getLeadByIdAction).toHaveBeenCalledTimes(2));
  });

  it("reads only the first timeline page again when the lead moves to a newer version", async () => {
    connectSocket();
    leadActions.listLeadTimelineAction
      .mockResolvedValueOnce({ page: { leadId: "lead-1", items: [{ id: "memory:m-1", kind: "memory", at: "2026-10-08T14:32:00Z", ref: { type: "memory", id: "m-1" }, summary: { text: "Primeira" } }], next: "cur-1" }, error: null })
      .mockResolvedValueOnce({ page: { leadId: "lead-1", items: [{ id: "memory:m-2", kind: "memory", at: "2026-10-07T14:32:00Z", ref: { type: "memory", id: "m-2" }, summary: { text: "Segunda" } }] }, error: null });
    renderDetail("timeline");
    fireEvent.click(await screen.findByRole("button", { name: t.timeline.loadMore }));
    expect(await screen.findByText("Memória: Segunda")).toBeInTheDocument();

    leadActions.getLeadByIdAction.mockResolvedValue({ lead: stored({ version: 5 }), error: null });
    emit({ leadId: "lead-1", version: 5, fields: ["name"] });

    await waitFor(() => expect(leadActions.listLeadTimelineAction).toHaveBeenCalledTimes(3));
    expect(leadActions.listLeadTimelineAction.mock.calls[2][1]).toMatchObject({ before: undefined });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(leadActions.listLeadTimelineAction).toHaveBeenCalledTimes(3);
  });

  it("leaves the deals alone when the lead record changes", async () => {
    connectSocket();
    renderDetail("deals");
    expect(await screen.findByText(t.deals.empty)).toBeInTheDocument();

    leadActions.getLeadByIdAction.mockResolvedValue({ lead: stored({ version: 5 }), error: null });
    emit({ leadId: "lead-1", version: 5, fields: ["name"] });

    await waitFor(() => expect(leadActions.getLeadByIdAction).toHaveBeenCalledTimes(2));
    expect(leadActions.listLeadDealsAction).toHaveBeenCalledTimes(1);
  });

  it("never reads on focus while the socket keeps the page fresh", async () => {
    connectSocket();
    renderDetail();
    await screen.findByRole("heading", { level: 1 });
    fireEvent.focus(window);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(leadActions.getLeadByIdAction).toHaveBeenCalledTimes(1);
  });
});

describe("lead campaigns tab", () => {
  it("offers Enviar template from the empty campaigns tab to whoever may send", async () => {
    sendGate.states = { send_template: { enabled: true }, send_message: { enabled: true } };
    renderDetail("campaigns");
    const panel = await screen.findByRole("tabpanel");
    expect(within(panel).getByText(t.campaigns.empty)).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: t.actions.sendTemplate }));
    expect(screen.getByRole("dialog", { name: "send_template" })).toHaveTextContent("ids:lead-1");
  });

  it("keeps the empty campaigns tab without the action when templates may not be sent", async () => {
    renderDetail("campaigns");
    const panel = await screen.findByRole("tabpanel");
    expect(within(panel).getByText(t.campaigns.empty)).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: t.actions.sendTemplate })).toBeNull();
  });
});

describe("lead detail actions", () => {
  it("opens the actions menu from an elevated ghost icon button", async () => {
    grants.value.add("leads:block");
    renderDetail();
    await screen.findByRole("heading", { level: 1 });
    const trigger = screen.getByRole("button", { name: t.actions.more });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger.className).toContain("min-h-[34px] w-9");
  });

  it("offers Anonimizar only to holders of leads:anonymize", async () => {
    grants.value.add("leads:block");
    renderDetail();
    await screen.findByRole("heading", { level: 1 });
    openMoreActions();
    expect(await screen.findByRole("menuitem", { name: t.actions.block })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: t.actions.anonymize })).toBeNull();
  });

  it("anonymizes only after the confirmation and leaves the page", async () => {
    grants.value.add("leads:anonymize");
    leadActions.anonymizeLeadAction.mockResolvedValue({
      outcome: { leadId: "lead-1", version: 5, anonymizedAt: "2026-10-08T12:00:00Z", erased: {} },
      error: null,
    });
    renderDetail();
    await screen.findByRole("heading", { level: 1 });
    openMoreActions();
    fireEvent.click(await screen.findByRole("menuitem", { name: t.actions.anonymize }));
    expect(leadActions.anonymizeLeadAction).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: t.anonymize.confirm }));

    await waitFor(() => expect(leadActions.anonymizeLeadAction).toHaveBeenCalledWith("lead-1"));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/leads"));
  });

  it("records the opt-out and shows it in the header", async () => {
    leadActions.optOutLeadAction.mockResolvedValue({ lead: { ...stored(), version: 5, optedOutAt: "2026-10-08T12:00:00Z" }, error: null });
    renderDetail();
    await screen.findByRole("heading", { level: 1 });
    openMoreActions();
    fireEvent.click(await screen.findByRole("menuitem", { name: t.actions.optOut }));
    const dialog = await screen.findByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: t.optOut.confirm });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("radio", { name: t.optOut.sources.lead_request }));
    fireEvent.click(confirm);

    await waitFor(() => expect(leadActions.optOutLeadAction).toHaveBeenCalledWith("lead-1", "lead_request"));
    expect(await screen.findAllByText(t.optedOut)).not.toHaveLength(0);
  });

  it("records an opt-out decided by the team as the team's decision", async () => {
    leadActions.optOutLeadAction.mockResolvedValue({ lead: { ...stored(), version: 5, optedOutAt: "2026-10-08T12:00:00Z", optOutSource: "operator" }, error: null });
    renderDetail();
    await screen.findByRole("heading", { level: 1 });
    openMoreActions();
    fireEvent.click(await screen.findByRole("menuitem", { name: t.actions.optOut }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: t.optOut.sources.operator }));
    fireEvent.click(within(dialog).getByRole("button", { name: t.optOut.confirm }));

    await waitFor(() => expect(leadActions.optOutLeadAction).toHaveBeenCalledWith("lead-1", "operator"));
    expect(toast.success).toHaveBeenCalledWith(t.optOut.done);
    expect(t.optOut.done).not.toMatch(/pedido/i);
  });

  it("picks who decided from anywhere on the row and names the choice once", async () => {
    renderDetail();
    await screen.findByRole("heading", { level: 1 });
    openMoreActions();
    fireEvent.click(await screen.findByRole("menuitem", { name: t.actions.optOut }));
    const dialog = await screen.findByRole("alertdialog");

    const group = within(dialog).getByRole("radiogroup", { name: t.optOut.sourceLabel });
    expect(group).not.toHaveAttribute("aria-label");
    expect(within(dialog).getAllByText(t.optOut.sourceLabel)).toHaveLength(1);

    const operator = within(dialog).getByRole("radio", { name: t.optOut.sources.operator });
    const row = operator.closest("label");
    expect(row).not.toBeNull();
    fireEvent.click(row!);
    expect(operator).toBeChecked();
    expect(within(dialog).getByRole("button", { name: t.optOut.confirm })).toBeEnabled();
  });

  it("explains a refused opt-out with the server's reason", async () => {
    leadActions.optOutLeadAction.mockResolvedValue({ lead: null, error: { status: 400, code: "lead_opt_out_source_invalid", message: "x" } });
    renderDetail();
    await screen.findByRole("heading", { level: 1 });
    openMoreActions();
    fireEvent.click(await screen.findByRole("menuitem", { name: t.actions.optOut }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: t.optOut.sources.lead_request }));
    fireEvent.click(within(dialog).getByRole("button", { name: t.optOut.confirm }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(t.optOut.failed, { description: ptMessages.leads.errors.lead_opt_out_source_invalid }),
    );
  });
});
