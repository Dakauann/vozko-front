import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { Campaign, Review } from "@/lib/email-campaigns/types";

const navigation = vi.hoisted(() => ({ search: "", push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.search),
  usePathname: () => "/dashboard/email/campaigns/new",
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws1" }, can: () => true }),
}));

const actions = vi.hoisted(() => ({
  fetchEmailCampaign: vi.fn(),
  fetchEmailCampaignReview: vi.fn(),
  fetchEmailSenders: vi.fn(),
  fetchEmailStarters: vi.fn(),
  fetchEmailDesigns: vi.fn(),
  renderEmailAction: vi.fn(),
  updateEmailCampaignAction: vi.fn(),
  createEmailCampaignAction: vi.fn(),
  launchEmailCampaignAction: vi.fn(),
  readyEmailCampaignAction: vi.fn(),
  unscheduleEmailCampaignAction: vi.fn(),
  pauseEmailCampaignAction: vi.fn(),
  resumeEmailCampaignAction: vi.fn(),
  stopEmailCampaignAction: vi.fn(),
  createEmailDesignAction: vi.fn(),
  testSendEmailCampaignAction: vi.fn(),
}));
vi.mock("@/app/actions/email-campaigns", () => ({
  ...actions,
  isEmailActionError: (result: object) => "error" in result,
}));

const audienceActions = vi.hoisted(() => ({
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
}));
vi.mock("@/app/actions/campaign-audience", () => audienceActions);

vi.mock("@/hooks/use-lead-field-definitions", () => ({ useLeadFieldDefinitions: () => ({ definitions: [] }) }));
vi.mock("@/components/leads/LeadsToolbar", () => ({
  LeadsToolbar: ({ filter }: { filter: unknown }) => <div data-testid="leads-toolbar">{JSON.stringify(filter)}</div>,
}));
vi.mock("@/components/leads/LeadSavedViews", () => ({ default: () => null }));
vi.mock("@/components/explainers/ExplainerHint", () => ({ ExplainerHint: () => null }));
vi.mock("@/components/email-editor", () => ({
  EmailEditor: () => <div data-testid="email-editor" />,
  StarterGallery: () => <div data-testid="starter-gallery" />,
  EmailThumbnail: () => <div data-testid="email-thumbnail" />,
}));
vi.mock("@/components/email-editor/merge-tag-menu", () => ({ MergeTagMenu: () => null }));

vi.mock("@/components/leads/sheet/LeadSheet", () => ({
  LeadSheet: ({ open, onSaved }: { open: boolean; onSaved: (lead: { id: string }) => void }) =>
    open ? (
      <button type="button" onClick={() => onSaved({ id: "lead-new" })}>
        salvar lead de teste
      </button>
    ) : null,
}));

import { EmailCampaignWizard } from "../wizard/EmailCampaignWizard";
import type { AudienceCount, ListPreview } from "@/lib/campaign-audience/types";

const SETTLE = { timeout: 4000 };

function emailCount(overrides: Partial<AudienceCount> = {}): AudienceCount {
  return {
    channel: "email",
    source: "leads",
    matched: 1200,
    withContact: 1100,
    sendable: 990,
    out: { no_email: 100, unsubscribed: 60, suppressed: 50 },
    outTotal: 210,
    requiredVariables: 0,
    variables: [],
    blockers: [],
    selection: { selected: 1200, confirmCount: 1200, fingerprint: "fp" },
    list: null,
    metadataMissing: [],
    ...overrides,
  };
}

const LIST_PREVIEW: ListPreview = {
  id: "list-1",
  channel: "email",
  contact: "email",
  fileName: "pais.csv",
  lines: 3,
  rows: 2,
  existing: 1,
  new: 1,
  header: true,
  columns: { contact: "email", name: "nome", variables: [], metadata: [] },
  variableColumns: 0,
  skipped: { total: 1, byReason: { invalid_email: 1 }, lines: [{ line: 3, reason: "invalid_email", raw: "x;Ana" }] },
  metadataMissing: [],
  expiresAt: null,
};

const CAMPAIGN: Campaign = {
  id: "c1",
  name: "Black Friday",
  status: "draft",
  subject: "Oferta para você",
  document: { version: 1, settings: {}, blocks: [{ id: "footer", kind: "footer", footer: { company_name: "Loja", address: "Rua 1" } }] },
  selection: { mode: "everyone" },
  actions: ["edit", "delete", "schedule", "launch"],
  billing: {
    batch_size: 1000,
    current_batch: 0,
    charged_units: 0,
    charged_micros: 0,
    sent_units: 0,
    refunded_units: 0,
    refunded_micros: 0,
    final_micros: 0,
    settled_at: null,
    refund_pending_micros: 0,
    exchange_rate: 5,
    charged_brl: 0,
    refunded_brl: 0,
    final_brl: 0,
    refund_pending_brl: 0,
  },
  time_zone: "America/Sao_Paulo",
  created_at: "2026-10-21T10:00:00Z",
  updated_at: "2026-10-21T10:00:00Z",
};

const REVIEW: Review = {
  audience: {
    matched: 1200,
    with_email: 1100,
    never_mailed: 0,
    sendable: 990,
    skipped: { no_email: 100, unsubscribed: 60, suppressed: 50 },
  },
  send: { units: 990, unit_micros: 600, unit_cost_micros: 165, total_micros: 594_000, unit_brl: 0.003, total_brl: 2.97 },
  first_batch: { units: 990, unit_micros: 600, unit_cost_micros: 165, total_micros: 594_000, unit_brl: 0.003, total_brl: 2.97 },
  batch_size: 1000,
  balance_micros: 100_000_000,
  missing_micros: 0,
  exchange_rate: 5,
  balance_brl: 500,
  missing_brl: 0,
  after_first_batch_micros: 99_406_000,
  after_first_batch_brl: 497.03,
  test_batch: 0,
  time_zone: "America/Sao_Paulo",
  check: { blocking: [{ code: "sender_missing" }], hints: [{ code: "preheader_missing" }] },
};

const READY: Review = { ...REVIEW, check: { blocking: [], hints: [] } };

function renderWizard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <EmailCampaignWizard />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  for (const mock of Object.values(actions)) mock.mockReset();
  navigation.push.mockReset();
  navigation.replace.mockReset();
  actions.fetchEmailCampaign.mockResolvedValue(CAMPAIGN);
  actions.fetchEmailCampaignReview.mockResolvedValue(REVIEW);
  actions.fetchEmailSenders.mockResolvedValue([{ id: "s1", domain_id: "d1", address: "ola@loja.com", local_part: "ola", display_name: "Loja", reply_forward_to: "", is_default: true }]);
  actions.fetchEmailStarters.mockResolvedValue({ items: [] });
  actions.fetchEmailDesigns.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 60 });
  actions.renderEmailAction.mockResolvedValue({ data: { subject: "Oferta para você", html: "<p>oi</p>", text: "oi", hints: [] } });
  actions.updateEmailCampaignAction.mockImplementation(async (id: string, request: object) => ({ data: { ...CAMPAIGN, ...request, id } }));
  for (const mock of Object.values(audienceActions)) mock.mockReset();
  audienceActions.countAudienceAction.mockResolvedValue({ data: emailCount(), error: null });
  audienceActions.listAudienceFieldsAction.mockResolvedValue({ data: [], error: null });
  audienceActions.searchAudienceRowsAction.mockResolvedValue({ data: { items: [], page: 1, pageSize: 50, totalPages: 0, totalItems: 0 }, error: null });
  audienceActions.previewAudienceListAction.mockResolvedValue({ data: LIST_PREVIEW, error: null });
});

function lastSavedRequest() {
  const calls = actions.updateEmailCampaignAction.mock.calls;
  return calls[calls.length - 1]?.[1];
}

describe("EmailCampaignWizard", () => {
  it("opens a saved draft on the content step and walks the steps from the step bar", async () => {
    navigation.search = "campaign=c1";
    renderWizard();

    expect(await screen.findByTestId("email-editor")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome da campanha")).toHaveValue("Black Friday");

    const steps = screen.getByRole("navigation", { name: "Etapas da campanha" });
    fireEvent.click(within(steps).getByRole("button", { name: /Público/ }));
    expect(await screen.findByTestId("email-editor").catch(() => null)).toBeNull();
    expect(screen.getByRole("group", { name: "Quem recebe" })).toBeInTheDocument();
    expect(navigation.replace).toHaveBeenCalledWith("/dashboard/email/campaigns/new?campaign=c1&step=audience", { scroll: false });

    fireEvent.click(within(steps).getByRole("button", { name: /Revisão/ }));
    expect(await screen.findByText("Quem vai receber")).toBeInTheDocument();
  });

  it("starts on the leads and counts the audience draft free with the subject and the document", async () => {
    navigation.search = "campaign=c1&step=audience";
    renderWizard();

    expect(await screen.findByRole("button", { name: ptMessages.campaignAudience.step.sources.leads })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(audienceActions.countAudienceAction).toHaveBeenCalled(), SETTLE);
    expect(audienceActions.countAudienceAction).toHaveBeenCalledWith("email", { source: "leads", selection: { mode: "everyone" } }, { subject: CAMPAIGN.subject, document: CAMPAIGN.document }, expect.any(AbortSignal));
    expect(screen.getByText("Leads no público")).toBeInTheDocument();
    expect(screen.getByText("Com e-mail")).toBeInTheDocument();
    expect(await screen.findByText("990")).toBeInTheDocument();
    expect(screen.getByText("descadastrados")).toBeInTheDocument();
    expect(screen.getByText(ptMessages.emailCampaigns.audience.consent)).toBeInTheDocument();
  });

  it("saves the uploaded list instead of the lead selection", async () => {
    navigation.search = "campaign=c1&step=audience";
    audienceActions.uploadAudienceListAction.mockResolvedValue({ data: LIST_PREVIEW, error: null });
    renderWizard();

    fireEvent.click(await screen.findByRole("button", { name: ptMessages.campaignAudience.step.sources.list }));
    fireEvent.change(screen.getByTestId("audience-list-file"), { target: { files: [new File(["email;nome"], "pais.csv")] } });

    expect(await screen.findByText("pais.csv")).toBeInTheDocument();
    await waitFor(() => expect(lastSavedRequest()).toMatchObject({ list_id: "list-1" }), SETTLE);
    expect(lastSavedRequest().selection).toBeUndefined();
  });

  it("keeps the lead filter while the list is tried and saves only the source in use", async () => {
    const bairro = { groups: [{ conjunction: "and" as const, predicates: [{ field: "district", operator: "in", values: ["ceilandia"] }] }] };
    actions.fetchEmailCampaign.mockResolvedValue({ ...CAMPAIGN, selection: { mode: "all_matching", filter: bairro } });
    navigation.search = "campaign=c1&step=audience";
    audienceActions.uploadAudienceListAction.mockResolvedValue({ data: LIST_PREVIEW, error: null });
    renderWizard();
    expect(await screen.findByTestId("leads-toolbar")).toHaveTextContent("ceilandia");

    fireEvent.click(screen.getByRole("button", { name: ptMessages.campaignAudience.step.sources.list }));
    fireEvent.change(screen.getByTestId("audience-list-file"), { target: { files: [new File(["email;nome"], "pais.csv")] } });
    await waitFor(() => expect(lastSavedRequest()).toMatchObject({ list_id: "list-1" }), SETTLE);

    fireEvent.click(screen.getByRole("button", { name: ptMessages.campaignAudience.step.sources.leads }));
    expect(screen.getByTestId("leads-toolbar")).toHaveTextContent("ceilandia");
    await waitFor(() => expect(lastSavedRequest()?.selection).toEqual({ mode: "all_matching", filter: bairro }), SETTLE);
    expect(lastSavedRequest().list_id).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: ptMessages.campaignAudience.step.sources.list }));
    expect(await screen.findByText("pais.csv")).toBeInTheDocument();
  });

  it("saves the default text chosen for a merge tag", async () => {
    navigation.search = "campaign=c1&step=audience";
    audienceActions.countAudienceAction.mockResolvedValue({
      data: emailCount({ variables: [{ key: "first_name", name: "first_name", header: false, missing: 41, policy: "", suggested: false, choiceRequired: false }] }),
      error: null,
    });
    renderWizard();

    fireEvent.click(await screen.findByRole("button", { name: ptMessages.campaignAudience.step.variables.useText }, SETTLE));
    fireEvent.change(screen.getByLabelText("Texto padrão de {{first_name}}"), { target: { value: "cliente" } });

    await waitFor(() => expect(lastSavedRequest()).toMatchObject({ merge_policies: [{ key: "first_name", missing: "text", text: "cliente" }] }), SETTLE);
    expect(lastSavedRequest().selection).toEqual({ mode: "everyone" });
  });

  it("shows the merge tags and the leads left out for them in the review", async () => {
    navigation.search = "campaign=c1&step=review";
    actions.fetchEmailCampaignReview.mockResolvedValue({
      ...REVIEW,
      audience: {
        ...REVIEW.audience,
        skipped: { ...REVIEW.audience.skipped, missing_variable: 12 },
        variables: [
          { key: "first_name", missing: 41, policy: "text", text: "cliente" },
          { key: "company", missing: 12, policy: "exclude" },
        ],
        list: { id: "list-1", rows: 1204, existing: 1176, new: 28 },
      },
    });
    renderWizard();

    expect(await screen.findByText("sem valor para uma variável")).toBeInTheDocument();
    const panel = screen.getByText(ptMessages.emailEditor.mergeTags.title).closest("section") as HTMLElement;
    expect(within(panel).getByText("{{first_name}}")).toBeInTheDocument();
    expect(within(panel).getByText(/cliente/)).toBeInTheDocument();
    expect(within(panel).getByText(ptMessages.emailCampaigns.review.mergeTags.exclude)).toBeInTheDocument();
    expect(screen.getByText(/1.176 já são leads e 28 leads novos/)).toBeInTheDocument();
  });

  it("presents the backend review: funnel, cost and blocking issues", async () => {
    navigation.search = "campaign=c1&step=review";
    renderWizard();

    expect(await screen.findByText("Selecionados")).toBeInTheDocument();
    expect(screen.getByText("1.200")).toBeInTheDocument();
    expect(screen.getByText("990")).toBeInTheDocument();
    expect(screen.getByText("descadastrados")).toBeInTheDocument();
    expect(screen.getByText("Falta um remetente")).toBeInTheDocument();
    expect(screen.getByText(/Adicione um texto de pré-visualização/)).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s2,97/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Primeiro lote/).length).toBeGreaterThan(0);
    expect(screen.getByText("Saldo depois do primeiro lote")).toBeInTheDocument();
    expect(screen.getByText(/cobrada em lotes de 1.000 e-mails, cada lote antes de sair/)).toBeInTheDocument();
    expect(screen.queryByText("Autorizados")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Validar/ })).not.toBeInTheDocument();
  });

  it("never shows a cost below one centavo as zero and keeps the balance after it apart", async () => {
    const tiny = { units: 1, unit_micros: 700, unit_cost_micros: 165, total_micros: 700, unit_brl: 0.0035, total_brl: 0.0035 };
    actions.fetchEmailCampaignReview.mockResolvedValue({ ...READY, send: tiny, first_batch: tiny, balance_brl: 500, after_first_batch_brl: 499.9965 });
    navigation.search = "campaign=c1&step=review";
    renderWizard();

    expect((await screen.findAllByText(/R\$\s0,0035/)).length).toBeGreaterThan(1);
    expect(screen.queryByText(/R\$\s0,00$/)).not.toBeInTheDocument();
    expect(screen.getByText(/R\$\s500,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s499,9965/)).toBeInTheDocument();
  });

  it("reads the review again after a lead is saved from the audience step", async () => {
    navigation.search = "campaign=c1&step=audience";
    renderWizard();
    await waitFor(() => expect(actions.fetchEmailCampaignReview).toHaveBeenCalled(), SETTLE);
    await waitFor(() => expect(audienceActions.countAudienceAction).toHaveBeenCalled(), SETTLE);
    const reviewed = actions.fetchEmailCampaignReview.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: ptMessages.leadsPage.header.newLead }));
    fireEvent.click(screen.getByRole("button", { name: "salvar lead de teste" }));

    await waitFor(() => expect(actions.fetchEmailCampaignReview.mock.calls.length).toBeGreaterThan(reviewed), SETTLE);
  });

  it("reads the review again when the person comes back to the window", async () => {
    navigation.search = "campaign=c1&step=review";
    renderWizard();
    await screen.findByText("Saldo depois do primeiro lote");
    const reviewed = actions.fetchEmailCampaignReview.mock.calls.length;

    focusManager.setFocused(false);
    focusManager.setFocused(true);

    await waitFor(() => expect(actions.fetchEmailCampaignReview.mock.calls.length).toBeGreaterThan(reviewed), SETTLE);
    focusManager.setFocused(undefined);
  });

  it("states the charge and the refund before sending now", async () => {
    navigation.search = "campaign=c1&step=send";
    actions.fetchEmailCampaignReview.mockResolvedValue(READY);
    actions.launchEmailCampaignAction.mockResolvedValue({ data: { ...CAMPAIGN, status: "running" } });
    renderWizard();

    const launch = await screen.findByRole("button", { name: "Disparar campanha" });
    await waitFor(() => expect(launch).toBeEnabled());
    expect(screen.getByText("990 prontos para envio")).toBeInTheDocument();
    fireEvent.click(launch);
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Agora cobramos só o primeiro lote: R\$\s2,97/)).toBeInTheDocument();
    expect(within(dialog).getByText(/cobrada em lotes de 1.000 e-mails, cada lote antes de sair/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Disparar" }));

    await waitFor(() => expect(actions.launchEmailCampaignAction).toHaveBeenCalledWith("c1", undefined));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/dashboard/email/campaigns/c1"));
  });

  it("sums up a single email at the estimate the backend gives, never as zero", async () => {
    const single = { units: 1, unit_micros: 583, unit_cost_micros: 165, total_micros: 583, unit_brl: 0.003498, total_brl: 0.003498 };
    navigation.search = "campaign=c1&step=send";
    actions.fetchEmailCampaignReview.mockResolvedValue({ ...READY, audience: { ...READY.audience, sendable: 1 }, send: single, first_batch: single });
    renderWizard();

    expect(await screen.findByText(/^R\$\s0,0035 \(1 × R\$\s0,0035\)$/)).toBeInTheDocument();
    expect(screen.queryByText(/R\$\s0,00 \(/)).not.toBeInTheDocument();
  });

  it("schedules in the campaign time zone the backend gives", async () => {
    navigation.search = "campaign=c1&step=send";
    actions.fetchEmailCampaignReview.mockResolvedValue(READY);
    actions.launchEmailCampaignAction.mockResolvedValue({ data: { ...CAMPAIGN, status: "scheduled" } });
    renderWizard();

    fireEvent.click(await screen.findByRole("radio", { name: /Agendar/ }));
    expect(screen.getByText("Horário em America/Sao_Paulo.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Data e hora do envio"), { target: { value: "2030-11-20T09:30" } });
    const schedule = screen.getByRole("button", { name: "Agendar campanha" });
    await waitFor(() => expect(schedule).toBeEnabled());
    fireEvent.click(schedule);
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Agendar/ }));

    await waitFor(() => expect(actions.launchEmailCampaignAction).toHaveBeenCalledWith("c1", "2030-11-20T12:30:00.000Z"));
  });

  it("leaves the campaign ready to start later without charging", async () => {
    navigation.search = "campaign=c1&step=send";
    actions.fetchEmailCampaign.mockResolvedValue({ ...CAMPAIGN, actions: ["edit", "delete", "ready", "schedule", "launch"] });
    actions.fetchEmailCampaignReview.mockResolvedValue(READY);
    actions.readyEmailCampaignAction.mockResolvedValue({ data: { ...CAMPAIGN, status: "ready" } });
    renderWizard();

    fireEvent.click(await screen.findByRole("radio", { name: /Deixar pronta/ }));
    expect(screen.getByText("A campanha fica pronta e você inicia quando quiser.")).toBeInTheDocument();
    const leave = screen.getByRole("button", { name: "Deixar pronta" });
    await waitFor(() => expect(leave).toBeEnabled());
    fireEvent.click(leave);

    await waitFor(() => expect(actions.readyEmailCampaignAction).toHaveBeenCalledWith("c1"));
    expect(actions.launchEmailCampaignAction).not.toHaveBeenCalled();
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/dashboard/email/campaigns/c1"));
  });

  it("keeps the launch off when the backend does not list it", async () => {
    navigation.search = "campaign=c1&step=send";
    actions.fetchEmailCampaign.mockResolvedValue({ ...CAMPAIGN, actions: ["edit"] });
    actions.fetchEmailCampaignReview.mockResolvedValue(READY);
    renderWizard();

    expect(await screen.findByRole("button", { name: "Disparar campanha" })).toBeDisabled();
  });

  it("keeps the send button off while the review has blocking issues", async () => {
    navigation.search = "campaign=c1&step=send";
    renderWizard();

    expect(await screen.findByText("Ainda não dá para disparar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disparar campanha" })).toBeDisabled();
  });
});
