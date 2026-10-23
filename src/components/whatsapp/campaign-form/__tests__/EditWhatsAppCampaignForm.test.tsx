import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/i18n/messages/en.json";
import ptMessages from "@/i18n/messages/pt.json";
import type { AudienceCount, ListPreview } from "@/lib/campaign-audience/types";
import type { WhatsAppCampaign } from "@/lib/whatsapp-campaigns/types";

const { toastMock } = vi.hoisted(() => ({
  toastMock: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: toastMock }));

vi.mock("zod", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("zod");
  return { ...actual, z: actual.z ?? actual };
});

const updateWhatsAppCampaignAction = vi.fn();
const createWhatsAppCampaignAction = vi.fn();
vi.mock("@/app/actions/whatsapp-campaigns", () => ({
  updateWhatsAppCampaignAction: (...args: unknown[]) => updateWhatsAppCampaignAction(...args),
  createWhatsAppCampaignAction: (...args: unknown[]) => createWhatsAppCampaignAction(...args),
}));

const { catalog } = vi.hoisted(() => ({
  catalog: { templates: [] as unknown[], phones: [] as unknown[], byId: {} as Record<string, unknown> },
}));

vi.mock("@/app/actions/whatsapp-templates", () => ({
  getWhatsAppTemplateByIdAction: vi.fn(async (id: string) => ({ template: catalog.byId[id] ?? null })),
  listWhatsAppTemplatesAction: vi.fn(async () => ({ templates: catalog.templates, meta: { totalPages: 1 } })),
  updateWhatsAppTemplateHeaderMediaAction: vi.fn(),
}));

vi.mock("@/app/actions/whatsapp-business-phones", () => ({
  getBusinessPhoneByIdAction: vi.fn(async () => ({ phone: null })),
  listBusinessPhonesAction: vi.fn(async () => ({ phones: catalog.phones, meta: { totalPages: 1 } })),
}));

const getTemplateExitVerdictAction = vi.fn();
vi.mock("@/app/actions/template-exit", () => ({
  getTemplateExitVerdictAction: (...args: unknown[]) => getTemplateExitVerdictAction(...args),
  getTemplateButtonActionsAction: vi.fn(),
  saveTemplateButtonActionsAction: vi.fn(),
  getCampaignButtonRoutesAction: vi.fn(),
  saveCampaignButtonRoutesAction: vi.fn(),
  getAudienceExitsAction: vi.fn(async () => ({ data: { optedOut: 0, blocked: 0, notReceiving: 0 } })),
  getDraftExitVerdictAction: vi.fn(),
}));

vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, can: () => true }) }));

vi.mock("@/app/actions/agents", () => ({
  getAgentOptionsAction: vi.fn(async () => ({ options: { messaging: [], modelPricing: [] } })),
  listAgentsAction: vi.fn(async () => ({ agents: [], meta: { totalPages: 1 } })),
}));

vi.mock("@/app/actions/crm-board", () => ({
  listPipelinesAction: vi.fn(async () => ({ pipelines: [] })),
}));

vi.mock("@/app/actions/workflows", () => ({
  getWorkflowAction: vi.fn(async () => ({ workflow: null })),
  listWorkflowsAction: vi.fn(async () => ({ workflows: [], meta: { totalPages: 1 } })),
}));

const { router } = vi.hoisted(() => ({
  router: { push: () => undefined, refresh: () => undefined, replace: () => undefined },
}));

vi.mock("@/components/channels/deal-automation-setting", () => ({
  DealAutomationSetting: () => null,
  DealAutomationDraft: () => null,
}));

vi.mock("@/lib/deal-automation/client", () => ({ applyDealAutomation: vi.fn(async () => true) }));

vi.mock("@/components/whatsapp/TemplateEditModal", () => ({ default: () => null }));

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
vi.mock("@/components/leads/LeadsToolbar", () => ({ LeadsToolbar: () => <div data-testid="leads-toolbar" /> }));
vi.mock("@/components/leads/LeadSavedViews", () => ({ default: () => null }));
vi.mock("@/hooks/use-lead-field-definitions", () => ({ useLeadFieldDefinitions: () => ({ definitions: [] }) }));

const { auth } = vi.hoisted(() => ({ auth: { user: { role: "user" } } }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => auth }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { listAgentsAction } from "@/app/actions/agents";

import EditWhatsAppCampaignForm from "../EditWhatsAppCampaignForm";

function campaign(source?: string): WhatsAppCampaign {
  return {
    id: "camp-1",
    source,
    name: "Disparo da seleção",
    type: "marketing" as WhatsAppCampaign["type"],
    templateId: "tpl-1",
    businessPhoneId: "phone-1",
    enableAgentResponses: false,
    showTemplateInCrm: false,
    enableAnalysis: false,
    enableAutoStaging: false,
    enableAutoMemory: false,
    status: "STOPPED",
    archived: false,
    scheduledStart: "2026-12-01T12:00:00Z",
    phoneNumbers: [
      { id: "e1", number: "5511999990000", name: "Ana", variables: [], metadata: {} },
    ],
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  } as WhatsAppCampaign;
}

function renderForm(initial: WhatsAppCampaign, locale: "pt" | "en" = "pt") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale={locale} messages={locale === "pt" ? ptMessages : enMessages}>
        <EditWhatsAppCampaignForm initialCampaign={initial} aiModels={["openai/gpt-4o-mini"]} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const form = ptMessages.whatsappCampaignsPage.form;
const enForm = enMessages.whatsappCampaignsPage.form;
const selection = ptMessages.leadSends;

const EXIT_OK = {
  state: "ok",
  buttons: [],
  exitWords: ["parar"],
  templateExitRequired: false,
  campaignAcknowledgementRequired: false,
};

const EXIT_NONE = { ...EXIT_OK, state: "none", exitWords: [], templateExitRequired: true, campaignAcknowledgementRequired: true };

const TEMPLATES = [
  { id: "tpl-1", name: "promo_outubro", language: "pt_BR", category: "MARKETING", status: "APPROVED", components: [{ type: "BODY", text: "Olá" }] },
  { id: "tpl-2", name: "aviso_novembro", language: "pt_BR", category: "UTILITY", status: "APPROVED", components: [{ type: "BODY", text: "Oi" }] },
];

const audienceStep = ptMessages.campaignAudience.step;

const PREVIEW: ListPreview = {
  id: "list-1",
  channel: "whatsapp",
  contact: "phone",
  fileName: "matriculas.csv",
  lines: 2,
  rows: 1,
  existing: 1,
  new: 0,
  header: true,
  columns: { contact: "number", name: "name", variables: [], metadata: [] },
  variableColumns: 0,
  skipped: { total: 1, byReason: { invalid_number: 1 }, lines: [{ line: 3, reason: "invalid_number", raw: "119;Bruna" }] },
  metadataMissing: [],
  expiresAt: null,
};

function audienceCount(overrides: Partial<AudienceCount> = {}): AudienceCount {
  return {
    channel: "whatsapp",
    source: "list",
    matched: 1,
    withContact: 1,
    sendable: 1,
    out: {},
    outTotal: 0,
    requiredVariables: 0,
    variables: [],
    blockers: [],
    selection: null,
    list: { id: "list-1", rows: 1, existing: 1, new: 0 },
    metadataMissing: [],
    ...overrides,
  };
}

beforeEach(() => {
  getTemplateExitVerdictAction.mockReset().mockResolvedValue({ data: EXIT_OK });
  catalog.templates = [];
  catalog.phones = [];
  catalog.byId = {};
  toastMock.error.mockReset();
  Object.values(audienceActions).forEach((action) => action.mockReset());
  vi.mocked(listAgentsAction).mockResolvedValue({ agents: [], meta: { totalPages: 1 } } as never);
  audienceActions.listAudienceFieldsAction.mockResolvedValue({ data: [], error: null });
  audienceActions.uploadAudienceListAction.mockResolvedValue({ data: PREVIEW, error: null });
  audienceActions.previewAudienceListAction.mockResolvedValue({ data: PREVIEW, error: null });
  audienceActions.countAudienceAction.mockResolvedValue({ data: audienceCount(), error: null });
  audienceActions.searchAudienceRowsAction.mockResolvedValue({
    data: { items: [{ id: "r1", line: 2, contact: "5511999990000", name: "Ana", variables: [], metadata: {}, missing: [], metadataMissing: [], existing: true }], page: 1, pageSize: 50, totalPages: 1, totalItems: 1 },
    error: null,
  });
});

describe("EditWhatsAppCampaignForm lead exit", () => {
  const exit = ptMessages.templateExit;

  it("asks again and sends the acknowledgement when an edit changes the template", async () => {
    getTemplateExitVerdictAction.mockImplementation(async (templateId: string) => ({ data: templateId === "tpl-2" ? EXIT_NONE : EXIT_OK }));
    updateWhatsAppCampaignAction.mockReset().mockResolvedValue({ campaign: { id: "camp-1" }, error: null });
    catalog.phones = [{ id: "phone-1", displayPhoneNumber: "+55 11 4000-0000", verifiedName: "Clínica" }];
    catalog.templates = TEMPLATES;
    renderForm(campaign(undefined));
    await waitFor(() => expect(screen.getByRole("button", { name: new RegExp(form.basicInfo.template) })).toBeEnabled());
    expect(screen.queryByRole("checkbox", { name: exit.risk.confirm })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: new RegExp(form.basicInfo.template) }));
    fireEvent.click(await screen.findByRole("option", { name: /aviso_novembro/ }));
    const acknowledge = await screen.findByRole("checkbox", { name: exit.risk.confirm });
    expect(screen.getByRole("button", { name: form.actions.update })).toBeDisabled();
    fireEvent.click(acknowledge);
    fireEvent.click(screen.getByRole("button", { name: form.actions.update }));

    await waitFor(() => expect(updateWhatsAppCampaignAction).toHaveBeenCalledTimes(1));
    expect(updateWhatsAppCampaignAction.mock.calls[0][1]).toMatchObject({ templateId: "tpl-2", exitRiskAcknowledged: true });
  });
});

describe("EditWhatsAppCampaignForm editing a send prepared from leads", () => {
  beforeEach(() => {
    updateWhatsAppCampaignAction.mockReset();
    createWhatsAppCampaignAction.mockReset();
    toastMock.mockReset();
    toastMock.error.mockReset();
    toastMock.success.mockReset();
  });

  it("does not offer the number, the template, the contacts or the schedule, and says why", async () => {
    renderForm(campaign("lead_selection"));

    expect(await screen.findByText(selection.campaign.templateLocked)).toBeInTheDocument();
    expect(screen.getByText(form.contacts.managedBySelection)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(form.basicInfo.businessPhone) })).toBeDisabled();
    expect(screen.getByRole("button", { name: new RegExp(form.basicInfo.template) })).toBeDisabled();
    expect(screen.queryByRole("button", { name: audienceStep.list.upload })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: audienceStep.list.addContact })).not.toBeInTheDocument();
    expect(screen.queryByText(form.basicInfo.scheduleToggle)).not.toBeInTheDocument();
  });

  it("saves the editable fields without sending contacts or a schedule, and explains a locked refusal", async () => {
    updateWhatsAppCampaignAction.mockResolvedValue({
      campaign: null,
      error: "campaign: a send prepared from a lead selection cannot be changed",
      errorCode: "send_selection_locked",
    });
    renderForm(campaign("lead_selection"));

    fireEvent.click(await screen.findByRole("button", { name: form.actions.update }));

    await waitFor(() => expect(updateWhatsAppCampaignAction).toHaveBeenCalledTimes(1));
    const [id, payload] = updateWhatsAppCampaignAction.mock.calls[0];
    expect(id).toBe("camp-1");
    expect(payload).toMatchObject({ name: "Disparo da seleção", templateId: "tpl-1", businessPhoneId: "phone-1" });
    expect(payload).not.toHaveProperty("phoneNumbers");
    expect(payload.scheduledStart).toBeUndefined();
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(form.toast.error, { description: selection.errors.send_selection_locked }),
    );
  });

  it("keeps the settings of a campaign built by hand editable and sends its contacts to the campaign page", async () => {
    renderForm(campaign(undefined));

    expect(await screen.findByText(form.contacts.managedOnDetail)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(form.basicInfo.businessPhone) })).not.toBeDisabled();
    expect(screen.queryByText(selection.campaign.templateLocked)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: audienceStep.list.upload })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: form.contacts.openDetail })).toHaveAttribute("href", "/dashboard/whatsapp-campaigns/camp-1");
  });

  it("saves only the settings, never the contacts it no longer loads", async () => {
    updateWhatsAppCampaignAction.mockResolvedValue({ campaign: { id: "camp-1" }, error: null });
    renderForm(campaign(undefined));

    fireEvent.click(await screen.findByRole("button", { name: form.actions.update }));

    await waitFor(() => expect(updateWhatsAppCampaignAction).toHaveBeenCalledTimes(1));
    const [, payload] = updateWhatsAppCampaignAction.mock.calls[0];
    expect(payload).not.toHaveProperty("phoneNumbers");
    expect(payload.scheduledStart).toBe("2026-12-01T12:00:00Z");
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("translates a coded refusal from the backend", async () => {
    updateWhatsAppCampaignAction.mockResolvedValue({ campaign: null, error: "missing", errorCode: "campaign_workflow_vars_missing" });
    renderForm(campaign(undefined));

    fireEvent.click(await screen.findByRole("button", { name: form.actions.update }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(form.toast.error, {
        description: ptMessages.whatsappCampaignsPage.errors.campaign_workflow_vars_missing,
      }),
    );
  });

  it("shows the server text when the refusal is not one it knows", async () => {
    updateWhatsAppCampaignAction.mockResolvedValue({ campaign: null, error: "Template not approved", errorCode: "SOMETHING_ELSE" });
    renderForm(campaign("lead_selection"));

    fireEvent.click(await screen.findByRole("button", { name: form.actions.update }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(form.toast.error, { description: "Template not approved" }),
    );
  });
});

describe("EditWhatsAppCampaignForm copy", () => {
  it("labels the funnel picker and the template preview from the messages", async () => {
    renderForm(campaign(undefined));

    expect(await screen.findByText(form.preview.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: form.preview.swapContact })).toBeInTheDocument();
    expect(screen.getByText(form.preview.selectTemplate)).toBeInTheDocument();
    expect(screen.getByText(form.basicInfo.pipelineDescription)).toBeInTheDocument();
  });

  it("shows the English copy and no Portuguese leftovers in the English locale", async () => {
    renderForm(campaign(undefined), "en");

    expect(await screen.findByText(enForm.preview.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: enForm.preview.swapContact })).toBeInTheDocument();
    expect(screen.getByText(enForm.preview.selectTemplate)).toBeInTheDocument();
    expect(screen.getByText(enForm.basicInfo.pipelineDescription)).toBeInTheDocument();
    expect(screen.queryByText(form.preview.title)).not.toBeInTheDocument();
    expect(screen.queryByText(form.basicInfo.pipelineDescription)).not.toBeInTheDocument();
  });
});

