import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { AudienceCount, ChannelFields, ListPreview } from "@/lib/campaign-audience/types";
import type { AudienceChannel } from "@/lib/campaign-audience/types";

vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws1" }, can: () => true }) }));
const toolbar = vi.hoisted(() => ({ place: { groups: [{ conjunction: "and", predicates: [{ field: "district", operator: "in", values: ["ceilandia"] }] }] } }));
vi.mock("@/components/leads/LeadsToolbar", () => ({
  LeadsToolbar: ({ filter, onFilterChange, onSearchChange }: { filter: unknown; onFilterChange: (filter: unknown) => void; onSearchChange: (search: string) => void }) => (
    <div data-testid="leads-toolbar">
      {JSON.stringify(filter)}
      <button
        type="button"
        onClick={() => {
          onSearchChange("ana");
          onFilterChange(toolbar.place);
        }}
      >
        buscar e filtrar
      </button>
    </div>
  ),
}));
vi.mock("@/components/leads/LeadSavedViews", () => ({ default: () => null }));
vi.mock("@/hooks/use-lead-field-definitions", () => ({ useLeadFieldDefinitions: () => ({ definitions: [] }) }));

const sheet = vi.hoisted(() => ({ leadId: "lead-new" }));
vi.mock("@/components/leads/sheet/LeadSheet", () => ({
  LeadSheet: ({ open, leadId, onSaved }: { open: boolean; leadId?: string | null; onSaved: (lead: { id: string }) => void }) =>
    open ? (
      <button type="button" onClick={() => onSaved({ id: leadId ?? sheet.leadId })}>
        {leadId ? `salvar edição de ${leadId}` : "salvar lead de teste"}
      </button>
    ) : null,
}));

const actions = vi.hoisted(() => ({
  countAudienceAction: vi.fn(),
  listAudienceFieldsAction: vi.fn(),
  uploadAudienceListAction: vi.fn(),
  pasteAudienceListAction: vi.fn(),
  previewAudienceListAction: vi.fn(),
  searchAudienceRowsAction: vi.fn(),
  addAudienceRowAction: vi.fn(),
  editAudienceRowAction: vi.fn(),
  removeAudienceRowAction: vi.fn(),
  downloadAudienceSampleAction: vi.fn(),
  listTemplateFieldsAction: vi.fn(),
  listAudienceLeadsAction: vi.fn(),
}));
vi.mock("@/app/actions/campaign-audience", () => actions);

import { AudienceCreateHint, CampaignAudienceStep } from "../CampaignAudienceStep";
import { SlotMark } from "../slot-focus";
import { useCampaignAudience } from "../use-campaign-audience";
import type { AudienceDraft } from "@/lib/campaign-audience/draft";

const step = ptMessages.campaignAudience.step;
const SETTLE = { timeout: 3000 };

const FIELDS = [
  { source: "lead.first_name", kind: "lead", column: "primeiro_nome" },
  { source: "lead.district", kind: "lead", column: "bairro" },
  { source: "lead.custom:serie", kind: "custom", column: "serie", key: "serie", label: "Série de interesse", type: "text" },
];

function leadsCount(overrides: Partial<AudienceCount> = {}): AudienceCount {
  return {
    channel: "whatsapp",
    source: "leads",
    matched: 1284,
    withContact: 1198,
    sendable: null,
    out: { no_identity: 86, blocked: 6 },
    outTotal: 92,
    requiredVariables: 2,
    variables: [
      { key: "1", name: "1", header: false, source: "lead.first_name", missing: 0, policy: "", suggested: true, choiceRequired: false },
      { key: "2", name: "2", header: false, source: "lead.custom:serie", missing: 18, policy: "", suggested: false, choiceRequired: true },
    ],
    blockers: ["variable_choice_required"],
    selection: { selected: 1284, confirmCount: 1284, fingerprint: "fp" },
    list: null,
    metadataMissing: [],
    ...overrides,
  };
}

const PREVIEW: ListPreview = {
  id: "list-1",
  channel: "whatsapp",
  contact: "phone",
  fileName: "matriculas.xlsx",
  lines: 1211,
  rows: 1204,
  existing: 1176,
  new: 28,
  header: true,
  columns: {
    contact: "telefone",
    name: "nome",
    variables: [
      { slot: 1, column: "primeiro_nome", field: "lead.first_name", fill: "column" },
      { slot: 2, column: "var2", fill: "column" },
    ],
    metadata: [],
  },
  variableColumns: 2,
  skipped: { total: 2, byReason: { invalid_number: 1, duplicate: 1 }, lines: [{ line: 14, reason: "invalid_number", raw: "119;Bruna" }, { line: 88, reason: "duplicate", raw: "5511;João", duplicateOf: 12 }] },
  metadataMissing: [],
  expiresAt: null,
};

function Harness({ channel, fields, initial }: { channel: AudienceChannel; fields: ChannelFields; initial?: Partial<AudienceDraft> }) {
  const audience = useCampaignAudience({ channel, fields, initial });
  return (
    <>
      <CampaignAudienceStep audience={audience} message="Olá, {{1}}! Série {{2}}." />
      <AudienceCreateHint audience={audience} />
      <span data-testid="recipients">{JSON.stringify(audience.recipients)}</span>
    </>
  );
}

function renderStep(channel: AudienceChannel, fields: ChannelFields = {}, initial?: Partial<AudienceDraft>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <Harness channel={channel} fields={fields} initial={initial} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function sheetQuery() {
  return actions.listAudienceLeadsAction.mock.calls.find((call) => call[3]?.limit === 50);
}

function lastCountSpec() {
  const calls = actions.countAudienceAction.mock.calls;
  return calls[calls.length - 1]?.[1];
}

beforeEach(() => {
  Object.values(actions).forEach((action) => action.mockReset());
  actions.listAudienceFieldsAction.mockResolvedValue({ data: FIELDS, error: null });
  actions.countAudienceAction.mockResolvedValue({ data: leadsCount(), error: null });
  actions.searchAudienceRowsAction.mockResolvedValue({ data: { items: [], page: 1, pageSize: 50, totalPages: 0, totalItems: 0 }, error: null });
  actions.listAudienceLeadsAction.mockResolvedValue({ data: { items: [], page: 1, pageSize: 5, totalPages: 0, totalItems: 0 }, error: null });
  actions.previewAudienceListAction.mockResolvedValue({ data: PREVIEW, error: null });
});

describe("CampaignAudienceStep sources", () => {
  it("starts the official template on the list", () => {
    renderStep("whatsapp", { templateId: "tpl-1" });
    expect(screen.getByRole("button", { name: step.sources.list })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: step.list.upload })).toBeInTheDocument();
    expect(screen.queryByTestId("leads-toolbar")).not.toBeInTheDocument();
  });

  it.each(["email", "unofficial"] as const)("starts %s on the leads with the new lead button", (channel) => {
    renderStep(channel, channel === "unofficial" ? { message: { kind: "text", bodies: ["Oi {{1}}"] } } : {});
    expect(screen.getByRole("button", { name: step.sources.leads })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("leads-toolbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ptMessages.leadsPage.header.newLead })).toBeInTheDocument();
  });

  it("offers only the leads to the carrier channel", () => {
    renderStep("carrier", { kind: "marketing" });
    expect(screen.queryByRole("button", { name: step.sources.list })).not.toBeInTheDocument();
    expect(screen.getByTestId("leads-toolbar")).toBeInTheDocument();
  });
});

describe("CampaignAudienceStep list", () => {
  it("uploads the file to the server and shows its preview", async () => {
    actions.uploadAudienceListAction.mockResolvedValue({ data: PREVIEW, error: null });
    actions.countAudienceAction.mockResolvedValue({
      data: leadsCount({ source: "list", sendable: 1191, blockers: [], out: { blocked: 6 }, outTotal: 6, selection: null, list: { id: "list-1", rows: 1204, existing: 1176, new: 28 }, variables: [] }),
      error: null,
    });
    renderStep("whatsapp", { templateId: "tpl-1" });
    const file = new File(["telefone;nome"], "matriculas.xlsx");
    fireEvent.change(screen.getByTestId("audience-list-file"), { target: { files: [file] } });

    expect(await screen.findByText("matriculas.xlsx")).toBeInTheDocument();
    expect(actions.uploadAudienceListAction).toHaveBeenCalledWith("whatsapp", file, { templateId: "tpl-1" });
    expect(screen.getByText(step.list.columns.title)).toBeInTheDocument();
    expect(screen.getByText("primeiro_nome")).toBeInTheDocument();
    expect(screen.getByText(/1.176 já são leads e 28 leads novos/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /2 linhas ignoradas/ }));
    expect(screen.getByText("119;Bruna")).toBeInTheDocument();
    expect(screen.getByText("repetido da linha 12")).toBeInTheDocument();

    await waitFor(() => expect(lastCountSpec()).toEqual({ source: "list", listId: "list-1" }), SETTLE);
    await waitFor(() => expect(screen.getByTestId("recipients")).toHaveTextContent('{"source":"list","listId":"list-1"}'), SETTLE);
  });

  it("lays the list figures across the full width", async () => {
    actions.uploadAudienceListAction.mockResolvedValue({ data: PREVIEW, error: null });
    renderStep("whatsapp", { templateId: "tpl-1" });
    fireEvent.change(screen.getByTestId("audience-list-file"), { target: { files: [new File(["a"], "a.csv")] } });
    const label = await screen.findByText(step.count.matched.list);
    expect(label.closest(".grid")).toHaveClass("xl:grid-cols-3");
  });

  it("searches an email list by address or name", async () => {
    const preview: ListPreview = { ...PREVIEW, channel: "email", contact: "email", columns: { variables: [], metadata: [] }, variableColumns: 0 };
    actions.uploadAudienceListAction.mockResolvedValue({ data: preview, error: null });
    actions.countAudienceAction.mockResolvedValue({ data: leadsCount({ channel: "email", source: "list", blockers: [], variables: [], selection: null }), error: null });
    renderStep("email", {}, { source: "list" });
    fireEvent.change(screen.getByTestId("audience-list-file"), { target: { files: [new File(["a"], "a.csv")] } });
    expect(await screen.findByRole("searchbox", { name: ptMessages.campaignContactList.searchEmail })).toHaveAttribute("placeholder", ptMessages.campaignContactList.searchEmail);
  });

  it("says why the server refused the file", async () => {
    actions.uploadAudienceListAction.mockResolvedValue({ data: null, error: { message: "x", code: "audience_contact_column_missing", status: 422 } });
    renderStep("whatsapp", { templateId: "tpl-1" });
    fireEvent.change(screen.getByTestId("audience-list-file"), { target: { files: [new File(["a"], "a.csv")] } });
    expect(await screen.findByText(ptMessages.campaignAudience.errors.audience_contact_column_missing)).toBeInTheDocument();
  });
});

describe("CampaignAudienceStep automation metadata", () => {
  const automation = { templateId: "tpl-1", workflowId: "wf-1" };

  it("sends the chosen flow with the list and shows the rows lacking its metadata", async () => {
    const preview = { ...PREVIEW, metadataMissing: [{ key: "turma", missing: 2, lines: [41, 97] }] };
    actions.uploadAudienceListAction.mockResolvedValue({ data: preview, error: null });
    actions.previewAudienceListAction.mockResolvedValue({ data: preview, error: null });
    actions.searchAudienceRowsAction.mockResolvedValue({
      data: { items: [{ id: "r1", line: 41, contact: "5511900010142", name: "Maria", variables: ["Maria", "1"], metadata: {}, missing: [], metadataMissing: ["turma"], existing: true }], page: 1, pageSize: 50, totalPages: 1, totalItems: 1 },
      error: null,
    });
    actions.countAudienceAction.mockResolvedValue({
      data: leadsCount({ source: "list", sendable: 1200, blockers: ["list_metadata_missing"], selection: null, list: { id: "list-1", rows: 1204, existing: 1176, new: 28 }, variables: [], metadataMissing: preview.metadataMissing }),
      error: null,
    });
    renderStep("whatsapp", automation);
    fireEvent.change(screen.getByTestId("audience-list-file"), { target: { files: [new File(["a"], "a.csv")] } });

    expect(await screen.findByText(/1 coluna exigida pelo fluxo ou agente/)).toBeInTheDocument();
    expect(actions.uploadAudienceListAction).toHaveBeenCalledWith("whatsapp", expect.any(File), automation);
    fireEvent.click(screen.getByRole("button", { name: /1 coluna exigida pelo fluxo ou agente/ }));
    expect(screen.getByText("Linhas 41, 97").closest("li")).toHaveTextContent("turmafalta em 2 contatos");

    expect(await screen.findByRole("columnheader", { name: "turma" })).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: ptMessages.campaignContactList.missingValue }).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText(step.blocked.list_metadata_missing)).toBeInTheDocument(), SETTLE);
    expect(actions.searchAudienceRowsAction.mock.calls[0][2]).toEqual(automation);
  });

  it("explains that leads cannot feed the metadata a flow needs and keeps the create closed", async () => {
    actions.countAudienceAction.mockResolvedValue({
      data: leadsCount({ blockers: ["leads_metadata_unavailable"], sendable: 1000, variables: [], metadataMissing: [{ key: "escola", missing: 1284, lines: [] }] }),
      error: null,
    });
    renderStep("whatsapp", automation, { source: "leads", pick: "everyone" });

    expect(await screen.findByText(step.leadsMetadata.title, undefined, SETTLE)).toBeInTheDocument();
    expect(screen.getByText(/Leads não carregam escola/)).toBeInTheDocument();
    actions.listAudienceLeadsAction.mockResolvedValue({ data: { items: [], page: 1, pageSize: 50, totalPages: 0, totalItems: 0 }, error: null });
    fireEvent.click(screen.getByRole("button", { name: /escola/ }));
    await waitFor(() => expect(actions.listAudienceLeadsAction.mock.calls.at(-1)?.[3]).toEqual({ metadataKey: "escola", search: "", page: 1, limit: 50 }));
    expect(screen.getByText(step.blocked.leads_metadata_unavailable)).toBeInTheDocument();
    expect(screen.getByTestId("recipients")).toHaveTextContent("null");
    expect(actions.countAudienceAction.mock.calls[0][2]).toEqual(automation);
  });
});

describe("CampaignAudienceStep variables", () => {
  it("keeps fixed text editable after a failed count and recovers when the text is filled", async () => {
    renderStep("whatsapp", { templateId: "tpl-1" }, { source: "leads", pick: "everyone" });
    const source = await screen.findByRole("combobox", { name: /Origem da variável.*1/ }, SETTLE);
    actions.countAudienceAction.mockResolvedValue({ data: null, error: { code: "send_binding_literal_empty", message: "empty", status: 422 } });
    fireEvent.keyDown(source, { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: ptMessages.leadSends.bindings.sources.literal }));
    await screen.findByText(ptMessages.campaignAudience.errors.send_binding_literal_empty, undefined, SETTLE);
    const input = screen.getByRole("textbox", { name: /Texto da variável.*1/ });
    expect(input).toHaveValue("");
    expect(screen.getByTestId("recipients")).toHaveTextContent("null");
    actions.countAudienceAction.mockResolvedValue({ data: leadsCount({ blockers: [], sendable: 1 }), error: null });
    fireEvent.change(input, { target: { value: "Dakauann" } });
    await waitFor(() => expect(lastCountSpec()?.variables).toContainEqual({ key: "1", source: "literal", value: "Dakauann" }), SETTLE);
    await waitFor(() => expect(screen.getByTestId("recipients")).not.toHaveTextContent("null"), SETTLE);
  });

  it("opens a saved incomplete fixed-text choice as a blocking editable field", async () => {
    actions.countAudienceAction.mockResolvedValue({ data: leadsCount({
      blockers: ["variable_source_required"],
      variables: [{ key: "1", name: "1", header: false, source: "literal", value: "", missing: 0, policy: "", suggested: false, choiceRequired: false }],
    }), error: null });
    renderStep("whatsapp", { templateId: "tpl-1" }, { source: "leads", pick: "everyone", variables: { "1": { source: "literal", value: "" } } });
    expect(await screen.findByRole("textbox", { name: /Texto da variável.*1/ }, SETTLE)).toHaveValue("");
    expect(screen.getByTestId("recipients")).toHaveTextContent("null");
  });

  it("keeps the create closed until a missing variable has a choice", async () => {
    renderStep("whatsapp", { templateId: "tpl-1" }, { source: "leads", pick: "everyone" });

    expect(await screen.findByText("Falta escolher o que fazer em {{2}}", undefined, SETTLE)).toBeInTheDocument();
    expect(screen.getByText(/A Meta recusa template com variável vazia/)).toBeInTheDocument();
    expect(await screen.findByText("Escolha o que fazer em {{2}} para criar a campanha.")).toBeInTheDocument();
    expect(screen.getByTestId("recipients")).toHaveTextContent("null");
    expect(screen.getByText(step.variables.suggested)).toBeInTheDocument();

    actions.countAudienceAction.mockResolvedValue({
      data: leadsCount({
        sendable: 1100,
        blockers: [],
        variables: [
          { key: "1", name: "1", header: false, source: "lead.first_name", missing: 0, policy: "", suggested: true, choiceRequired: false },
          { key: "2", name: "2", header: false, source: "lead.custom:serie", missing: 18, policy: "exclude", suggested: false, choiceRequired: false },
        ],
      }),
      error: null,
    });
    fireEvent.click(screen.getByRole("button", { name: step.variables.exclude }));

    await waitFor(() => expect(lastCountSpec()).toEqual({ source: "leads", selection: { mode: "everyone" }, variables: [{ key: "2", missing: "exclude" }] }), SETTLE);
    await waitFor(() => expect(screen.getByTestId("recipients")).toHaveTextContent('"expectedCount":1284'), SETTLE);
    expect(screen.queryByText("Escolha o que fazer em {{2}} para criar a campanha.")).not.toBeInTheDocument();
  });

  it("counts who is left out with the channel reasons and shows n/d while a choice is pending", async () => {
    renderStep("whatsapp", { templateId: "tpl-1" }, { source: "leads", pick: "everyone" });
    const panel = (await screen.findByText(step.count.title, undefined, SETTLE)).closest("section") as HTMLElement;
    await waitFor(() => expect(within(panel).getByText(ptMessages.leadSends.review.skipped.no_identity)).toBeInTheDocument(), SETTLE);
    expect(within(panel).getByText("86")).toBeInTheDocument();
    expect(within(panel).getAllByText("n/d").length).toBeGreaterThan(0);
  });

  it("stacks the count figures in the side column of the leads view so every label reads in full", async () => {
    renderStep("whatsapp", { templateId: "tpl-1" }, { source: "leads", pick: "everyone" });
    const label = await screen.findByText(step.count.matched.leads, undefined, SETTLE);
    const strip = label.closest(".grid") as HTMLElement;
    expect(strip).toHaveClass("xl:grid-cols-1");
    expect(strip).not.toHaveClass("xl:grid-cols-3");
  });

  it("translates a refusal of the count shared with the campaign creates", async () => {
    actions.countAudienceAction.mockResolvedValue({ data: null, error: { message: "template", code: "send_template_unavailable", status: 422 } });
    renderStep("whatsapp", { templateId: "tpl-1" }, { source: "leads", pick: "everyone" });
    expect(await screen.findByText(ptMessages.campaignAudience.errors.send_template_unavailable, undefined, SETTLE)).toBeInTheDocument();
    expect(screen.queryByText(/campaignAudience\.errors/)).not.toBeInTheDocument();
  });

  it("counts as soon as the leads are picked and keeps the create closed until the template is chosen", async () => {
    actions.countAudienceAction.mockResolvedValue({ data: leadsCount({ sendable: 900, blockers: ["template_required"], variables: [] }), error: null });
    renderStep("whatsapp", {}, { source: "leads", pick: "everyone" });
    await waitFor(() => expect(lastCountSpec()).toEqual({ source: "leads", selection: { mode: "everyone" } }), SETTLE);
    expect(actions.countAudienceAction.mock.calls.at(-1)?.[2]).toEqual({});
    expect(await screen.findByText(step.blocked.template_required)).toBeInTheDocument();
    expect(screen.getByText("900")).toBeInTheDocument();
    expect(screen.queryByText(step.variables.title)).not.toBeInTheDocument();
  });

  it("asks the unofficial message before the create with its own reason", async () => {
    actions.countAudienceAction.mockResolvedValue({ data: leadsCount({ channel: "unofficial", sendable: 900, blockers: ["message_required"], variables: [] }), error: null });
    renderStep("unofficial", {}, { pick: "everyone" });
    expect(await screen.findByText(step.blocked.message_required, undefined, SETTLE)).toBeInTheDocument();
  });

  it("labels named and header slots as the server names them", async () => {
    actions.countAudienceAction.mockResolvedValue({
      data: leadsCount({
        blockers: ["variable_choice_required"],
        variables: [
          { key: "1", name: "loja", header: true, source: "lead.city", missing: 4, policy: "", suggested: true, choiceRequired: true },
          { key: "2", name: "nome", header: false, source: "lead.first_name", missing: 2, policy: "text", text: "cliente", suggested: true, choiceRequired: false },
        ],
      }),
      error: null,
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function Named() {
      const audience = useCampaignAudience({ channel: "whatsapp", fields: { templateId: "tpl-1" }, initial: { source: "leads", pick: "everyone" } });
      return (
        <>
          <CampaignAudienceStep audience={audience} message="Olá, {{nome}}!" />
          <AudienceCreateHint audience={audience} />
        </>
      );
    }
    render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
          <Named />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Escolha o que fazer em {{loja}} no cabeçalho para criar a campanha.", undefined, SETTLE)).toBeInTheDocument();
    expect(screen.getByText("{{nome}}")).toBeInTheDocument();
    expect(screen.getByText(step.slot.header)).toBeInTheDocument();
    expect(screen.getByText("Falta escolher o que fazer em {{loja}} no cabeçalho")).toBeInTheDocument();
    const bubble = screen.getByText("cliente", { selector: "span" });
    expect(bubble.parentElement).toHaveTextContent("Olá, cliente!");
  });
});

describe("CampaignAudienceStep switching sources", () => {
  const BAIRRO = { groups: [{ conjunction: "and", predicates: [{ field: "district", operator: "in", values: ["ceilandia"] }] }] };

  it("never shows the count of the other source and keeps each source's state while toggling", async () => {
    actions.uploadAudienceListAction.mockResolvedValue({ data: PREVIEW, error: null });
    actions.countAudienceAction.mockImplementation(async (_channel: string, spec: { source: string }) => ({
      data:
        spec.source === "list"
          ? leadsCount({ source: "list", matched: 2, withContact: 2, sendable: 2, out: {}, outTotal: 0, blockers: [], variables: [], selection: null, list: { id: "list-1", rows: 2, existing: 2, new: 0 } })
          : leadsCount({ matched: 40, withContact: 39, sendable: 38, blockers: [], variables: [] }),
      error: null,
    }));
    renderStep("email", {}, { source: "list", filter: BAIRRO as never });
    fireEvent.change(screen.getByTestId("audience-list-file"), { target: { files: [new File(["a"], "a.csv")] } });
    await waitFor(() => expect(lastCountSpec()).toEqual({ source: "list", listId: "list-1" }), SETTLE);

    fireEvent.click(screen.getByRole("button", { name: step.sources.leads }));
    expect(screen.getByTestId("leads-toolbar")).toHaveTextContent("ceilandia");
    await waitFor(() => expect(lastCountSpec()?.source).toBe("leads"), SETTLE);
    expect(await screen.findByText("38")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: step.sources.list }));
    expect(await screen.findByText("matriculas.xlsx")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: step.sources.leads }));
    expect(screen.getByTestId("leads-toolbar")).toHaveTextContent("ceilandia");
  });

  it("keeps both changes when the toolbar changes the search and the filter at once", async () => {
    actions.countAudienceAction.mockResolvedValue({ data: leadsCount({ blockers: [], variables: [] }), error: null });
    renderStep("email", {});
    fireEvent.click(screen.getByRole("button", { name: "buscar e filtrar" }));
    expect(screen.getByTestId("leads-toolbar")).toHaveTextContent("ceilandia");
    await waitFor(() => expect(JSON.stringify(lastCountSpec())).toContain("ana"), SETTLE);
    expect(JSON.stringify(lastCountSpec())).toContain("ceilandia");
  });

  it("shows n/d instead of the list numbers when the leads have nothing to count yet", async () => {
    actions.uploadAudienceListAction.mockResolvedValue({ data: PREVIEW, error: null });
    actions.countAudienceAction.mockResolvedValue({
      data: leadsCount({ source: "list", matched: 2, withContact: 2, sendable: 2, out: {}, outTotal: 0, blockers: [], variables: [], selection: null, list: { id: "list-1", rows: 2, existing: 2, new: 0 } }),
      error: null,
    });
    renderStep("email", {}, { source: "list" });
    fireEvent.change(screen.getByTestId("audience-list-file"), { target: { files: [new File(["a"], "a.csv")] } });
    await waitFor(() => expect(screen.getAllByText("2").length).toBeGreaterThan(0), SETTLE);

    fireEvent.click(screen.getByRole("button", { name: step.sources.leads }));
    const panel = screen.getByText(step.count.title).closest("section") as HTMLElement;
    expect(within(panel).getByText(step.count.noAudience)).toBeInTheDocument();
    expect(within(panel).queryByText("2")).not.toBeInTheDocument();
    expect(within(panel).queryByText(step.count.noneOut)).not.toBeInTheDocument();
    expect(within(panel).getAllByText("n/d")).toHaveLength(3);
  });
});

describe("CampaignAudienceStep leads behind the numbers", () => {
  const LEADS = {
    items: [
      { leadId: "lead-1", line: 0, name: "Bia Melo", contact: "5511900000002", status: "out", reason: "no_identity", missing: [], metadataMissing: [], variables: ["Bia"] },
      { leadId: "lead-2", line: 0, name: "Caio Lima", contact: "5511900000003", status: "out", reason: "no_identity", missing: ["2"], metadataMissing: [], variables: ["Caio", ""] },
    ],
    page: 1,
    pageSize: 50,
    totalPages: 1,
    totalItems: 2,
  };
  const COUNTED = leadsCount({ blockers: [], sendable: 1100, variables: [] });

  async function openNoIdentity() {
    actions.countAudienceAction.mockResolvedValue({ data: COUNTED, error: null });
    actions.listAudienceLeadsAction.mockResolvedValue({ data: LEADS, error: null });
    renderStep("whatsapp", { templateId: "tpl-1" }, { source: "leads", filter: { groups: [{ conjunction: "and", predicates: [{ field: "city", operator: "in", values: ["sp"] }] }] } as never });
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(ptMessages.leadSends.review.skipped.no_identity) }, SETTLE));
    return screen.findByRole("dialog");
  }

  it("opens the leads left out for a reason with their status, reason and values", async () => {
    const dialog = await openNoIdentity();
    expect(await within(dialog).findByText("Bia Melo")).toBeInTheDocument();
    expect(within(dialog).getByText("5511900000003")).toBeInTheDocument();
    expect(within(dialog).getAllByText(step.leads.status.out).length).toBe(2);
    expect(within(dialog).getByText("Bia")).toBeInTheDocument();
    const [, spec, fields, query] = sheetQuery() ?? [];
    expect(spec.source).toBe("leads");
    expect(fields).toEqual({ templateId: "tpl-1" });
    expect(query).toEqual({ status: "out", reason: "no_identity", search: "", page: 1, limit: 50 });
  });

  it("opens everyone from the leads in the audience", async () => {
    actions.countAudienceAction.mockResolvedValue({ data: COUNTED, error: null });
    actions.listAudienceLeadsAction.mockResolvedValue({ data: LEADS, error: null });
    renderStep("whatsapp", { templateId: "tpl-1" }, { source: "leads", pick: "everyone" });
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(step.count.matched.leads) }, SETTLE));
    await screen.findByRole("dialog");
    await waitFor(() => expect(sheetQuery()?.[3]).toEqual({ search: "", page: 1, limit: 50 }));
  });

  it("edits a lead with the real lead sheet and counts again", async () => {
    const dialog = await openNoIdentity();
    await within(dialog).findByText("Bia Melo");
    const counted = actions.countAudienceAction.mock.calls.length;
    const listed = actions.listAudienceLeadsAction.mock.calls.length;
    fireEvent.click(within(dialog).getAllByRole("button", { name: step.leads.edit })[0]);
    fireEvent.click(await screen.findByRole("button", { name: "salvar edição de lead-1" }));
    await waitFor(() => expect(actions.countAudienceAction.mock.calls.length).toBeGreaterThan(counted), SETTLE);
    await waitFor(() => expect(actions.listAudienceLeadsAction.mock.calls.length).toBeGreaterThan(listed), SETTLE);
  });

  it("sends only to the picked leads and offers the way back to the filter", async () => {
    const dialog = await openNoIdentity();
    await within(dialog).findByText("Bia Melo");
    fireEvent.click(within(dialog).getAllByRole("checkbox", { name: ptMessages.dashboardTable.selectRow })[0]);
    fireEvent.click(within(dialog).getByRole("button", { name: step.leads.pickOnly }));
    await waitFor(() => expect(lastCountSpec()).toEqual({ source: "leads", selection: { mode: "ids", ids: ["lead-1"] } }), SETTLE);
    expect(screen.getByText(/1 lead escolhido/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: step.pick.idsSwitch }));
    await waitFor(() => expect(lastCountSpec()?.selection?.mode).toBe("all_matching"), SETTLE);
  });

  it("takes the picked leads out of a filtered audience and puts them back", async () => {
    const dialog = await openNoIdentity();
    await within(dialog).findByText("Bia Melo");
    fireEvent.click(within(dialog).getAllByRole("checkbox", { name: ptMessages.dashboardTable.selectRow })[1]);
    fireEvent.click(within(dialog).getByRole("button", { name: step.leads.exclude }));
    await waitFor(() => expect(lastCountSpec()?.selection?.excludeIds).toEqual(["lead-2"]), SETTLE);
    expect(screen.getByText("1 lead tirado do público")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: step.pick.restore }));
    await waitFor(() => expect(lastCountSpec()?.selection?.excludeIds).toBeUndefined(), SETTLE);
  });
});

describe("CampaignAudienceStep new lead", () => {
  it("adds the saved lead to a pick by ids and counts again", async () => {
    actions.countAudienceAction.mockResolvedValue({ data: leadsCount({ blockers: [], sendable: 2, variables: [] }), error: null });
    renderStep("email", {}, { pick: "ids", ids: ["lead-a"] });
    await waitFor(() => expect(lastCountSpec()).toEqual({ source: "leads", selection: { mode: "ids", ids: ["lead-a"] } }), SETTLE);

    fireEvent.click(screen.getByRole("button", { name: ptMessages.leadsPage.header.newLead }));
    fireEvent.click(screen.getByRole("button", { name: "salvar lead de teste" }));

    await waitFor(() => expect(lastCountSpec()).toEqual({ source: "leads", selection: { mode: "ids", ids: ["lead-a", "lead-new"] } }), SETTLE);
  });

  it("aborts the count the audience no longer needs once it changes", async () => {
    actions.countAudienceAction
      .mockImplementationOnce(() => new Promise(() => undefined))
      .mockResolvedValue({ data: leadsCount({ blockers: [], sendable: 2, variables: [] }), error: null });
    renderStep("email", {}, { pick: "ids", ids: ["lead-a"] });
    await waitFor(() => expect(actions.countAudienceAction).toHaveBeenCalledTimes(1), SETTLE);
    const first = actions.countAudienceAction.mock.calls[0][3] as AbortSignal;
    expect(first.aborted).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: ptMessages.leadsPage.header.newLead }));
    fireEvent.click(screen.getByRole("button", { name: "salvar lead de teste" }));

    await waitFor(() => expect(lastCountSpec()).toEqual({ source: "leads", selection: { mode: "ids", ids: ["lead-a", "lead-new"] } }), SETTLE);
    await waitFor(() => expect(first.aborted).toBe(true));
  });

  it("counts a filtered audience again after a new lead is saved", async () => {
    actions.countAudienceAction.mockResolvedValue({ data: leadsCount({ blockers: [], sendable: 2, variables: [] }), error: null });
    renderStep("email", {}, { pick: "everyone" });
    await waitFor(() => expect(actions.countAudienceAction).toHaveBeenCalledTimes(1), SETTLE);

    fireEvent.click(screen.getByRole("button", { name: ptMessages.leadsPage.header.newLead }));
    fireEvent.click(screen.getByRole("button", { name: "salvar lead de teste" }));

    await waitFor(() => expect(actions.countAudienceAction).toHaveBeenCalledTimes(2), SETTLE);
    expect(lastCountSpec()).toEqual({ source: "leads", selection: { mode: "everyone" } });
  });
});

describe("CampaignAudienceStep matched leads preview", () => {
  const MATCHED = {
    items: [
      { leadId: "lead-1", line: 0, name: "Ana Souza", contact: "5561999990001", status: "ready", reason: "", missing: [], metadataMissing: [], variables: ["Ana"] },
      { leadId: "lead-2", line: 0, name: "Bruno Reis", contact: "", status: "out", reason: "no_identity", missing: [], metadataMissing: [], variables: [""] },
    ],
    page: 1,
    pageSize: 5,
    totalPages: 161,
    totalItems: 802,
  };
  const COUNTED = leadsCount({ blockers: [], sendable: 700, variables: [] });

  function previewCalls() {
    return actions.listAudienceLeadsAction.mock.calls.filter((call) => call[3]?.limit === 5);
  }

  it("lists the first matched leads under the filters with the count's spec", async () => {
    actions.countAudienceAction.mockResolvedValue({ data: COUNTED, error: null });
    actions.listAudienceLeadsAction.mockResolvedValue({ data: MATCHED, error: null });
    renderStep("whatsapp", { templateId: "tpl-1" }, { source: "leads", pick: "everyone" });
    const preview = (await screen.findByText(step.preview.title, undefined, SETTLE)).closest("section") as HTMLElement;
    expect(await within(preview).findByText("Ana Souza")).toBeInTheDocument();
    expect(within(preview).getByText("5561999990001")).toBeInTheDocument();
    expect(within(preview).getByText(step.leads.status.ready)).toBeInTheDocument();
    expect(within(preview).getByText(step.leads.status.out)).toBeInTheDocument();
    expect(within(preview).getByText(ptMessages.leadSends.review.skipped.no_identity)).toBeInTheDocument();
    expect(within(preview).getByText("Os primeiros 2 de 802 leads com estes filtros.")).toBeInTheDocument();
    const [, spec, fields, query] = previewCalls()[0];
    expect(spec).toEqual(lastCountSpec());
    expect(fields).toEqual({ templateId: "tpl-1" });
    expect(query).toEqual({ search: "", page: 1, limit: 5 });
  });

  it("opens every matched lead from the preview", async () => {
    actions.countAudienceAction.mockResolvedValue({ data: COUNTED, error: null });
    actions.listAudienceLeadsAction.mockResolvedValue({ data: MATCHED, error: null });
    renderStep("whatsapp", { templateId: "tpl-1" }, { source: "leads", pick: "everyone" });
    fireEvent.click(await screen.findByRole("button", { name: step.preview.viewAll }, SETTLE));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await waitFor(() => expect(sheetQuery()?.[3]).toEqual({ search: "", page: 1, limit: 50 }));
  });

  it("says when no lead matches the filters", async () => {
    actions.countAudienceAction.mockResolvedValue({ data: leadsCount({ matched: 0, withContact: 0, sendable: 0, out: {}, outTotal: 0, blockers: [], variables: [] }), error: null });
    renderStep("email", {}, { source: "leads", pick: "everyone" });
    expect(await screen.findByText(step.preview.empty, undefined, SETTLE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: step.preview.viewAll })).toBeNull();
  });

  it("aborts the preview the audience no longer needs once it changes", async () => {
    actions.countAudienceAction.mockResolvedValue({ data: COUNTED, error: null });
    actions.listAudienceLeadsAction.mockImplementationOnce(() => new Promise(() => undefined)).mockResolvedValue({ data: MATCHED, error: null });
    renderStep("email", {}, { pick: "ids", ids: ["lead-a"] });
    await waitFor(() => expect(previewCalls().length).toBe(1), SETTLE);
    const first = previewCalls()[0][4] as AbortSignal;
    expect(first.aborted).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: ptMessages.leadsPage.header.newLead }));
    fireEvent.click(screen.getByRole("button", { name: "salvar lead de teste" }));

    await waitFor(() => expect(previewCalls().length).toBe(2), SETTLE);
    expect(previewCalls()[1][1]).toEqual({ source: "leads", selection: { mode: "ids", ids: ["lead-a", "lead-new"] } });
    await waitFor(() => expect(first.aborted).toBe(true));
  });

  it("shows that the count figures open the leads behind them", async () => {
    actions.countAudienceAction.mockResolvedValue({ data: COUNTED, error: null });
    renderStep("whatsapp", { templateId: "tpl-1" }, { source: "leads", pick: "everyone" });
    const opener = await screen.findByRole("button", { name: new RegExp(step.count.matched.leads) }, SETTLE);
    expect(opener).toHaveAttribute("title", step.count.openList);
  });
});

describe("CampaignAudienceStep template slot focus", () => {
  function Focused() {
    const audience = useCampaignAudience({ channel: "whatsapp", fields: { templateId: "tpl-1" }, initial: { source: "leads", pick: "everyone" } });
    return (
      <CampaignAudienceStep
        audience={audience}
        preview={
          <p>
            <SlotMark slotKey="1" tag="{{1}}">Primeiro nome</SlotMark> <SlotMark slotKey="2" tag="{{2}}">Série</SlotMark>
          </p>
        }
      />
    );
  }

  it("lights the slot of the variable row being edited in the template preview", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
          <Focused />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
    const second = await screen.findByRole("combobox", { name: ptMessages.leadSends.bindings.source.replace("{slot}", "{{2}}") }, SETTLE);
    const mark = (key: string) => document.querySelector(`mark[data-slot-key="${key}"]`);
    expect(mark("2")).not.toHaveAttribute("data-active");
    fireEvent.focus(second);
    expect(mark("2")).toHaveAttribute("data-active", "true");
    expect(mark("1")).not.toHaveAttribute("data-active");
    fireEvent.blur(second);
    expect(mark("2")).not.toHaveAttribute("data-active");
  });
});
