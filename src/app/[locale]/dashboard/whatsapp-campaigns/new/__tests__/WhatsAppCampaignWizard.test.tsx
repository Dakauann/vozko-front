import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { TourStep } from "@/components/TourGuide";
import { wizardStepOfTour } from "@/data/tour-whatsapp-campaigns";
import type { AudienceCount, ListPreview } from "@/lib/campaign-audience/types";
import { WHATSAPP_WIZARD_STEPS } from "@/lib/whatsapp-campaigns/wizard";

const { toastMock } = vi.hoisted(() => ({
  toastMock: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: toastMock }));

vi.mock("zod", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("zod");
  return { ...actual, z: actual.z ?? actual };
});

const drafts = vi.hoisted(() => ({
  createCampaignDraftAction: vi.fn(),
  updateCampaignDraftAction: vi.fn(),
  getCampaignDraftAction: vi.fn(),
  reviewCampaignDraftAction: vi.fn(),
  launchCampaignDraftAction: vi.fn(),
  deleteCampaignDraftAction: vi.fn(),
  listCampaignDraftsAction: vi.fn(),
}));
vi.mock("@/app/actions/campaign-drafts", () => ({
  ...drafts,
  isDraftActionError: (result: object) => "error" in result,
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

vi.mock("@/app/actions/whatsapp-campaign-smart", () => ({
  getSmartDefaultsAction: vi.fn(async () => ({ defaults: null, error: null })),
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

const { router, search } = vi.hoisted(() => ({
  router: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() },
  search: { value: "" },
}));
vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams(search.value) }));

vi.mock("@/components/channels/deal-automation-setting", () => ({
  DealAutomationSetting: () => null,
  DealAutomationDraft: () => null,
}));

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

vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { role: "user" } }) }));

const { tour } = vi.hoisted(() => ({ tour: { props: null as null | { steps: TourStep[]; storageKey?: string; onStep?: (index: number, step: TourStep) => void } } }));
vi.mock("@/components/TourGuide", () => ({
  default: (props: { steps: TourStep[]; onStep?: (index: number, step: TourStep) => void }) => {
    tour.props = props;
    return null;
  },
}));

import { WhatsAppCampaignWizard } from "../WhatsAppCampaignWizard";

const form = ptMessages.whatsappCampaignsPage.form;
const wizard = ptMessages.whatsappCampaignsPage.wizard;
const shared = ptMessages.campaignWizard;
const send = shared.send;
const exitCopy = ptMessages.templateExit;
const audienceStep = ptMessages.campaignAudience.step;
const SETTLE = { timeout: 4000 };

const EXIT_OK = { state: "ok", buttons: [], exitWords: ["parar"], templateExitRequired: false, campaignAcknowledgementRequired: false };
const EXIT_NONE = { ...EXIT_OK, state: "none", exitWords: [], templateExitRequired: true, campaignAcknowledgementRequired: true };

const TEMPLATE = { id: "tpl-1", name: "promo_outubro", language: "pt_BR", category: "MARKETING", status: "APPROVED", components: [{ type: "BODY", text: "Olá" }] };

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
  skipped: { total: 0, byReason: {}, lines: [] },
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

let saves = 0;
function savedDraft(id: string, body: { name: string; payload: unknown }) {
  saves += 1;
  return { data: { id, channel: "whatsapp", name: body.name, payload: body.payload, createdBy: "u1", createdAt: "2026-10-22T10:00:00Z", updatedAt: `2026-10-22T10:00:${String(saves).padStart(2, "0")}Z` } };
}

const REVIEW_OK = {
  audience: audienceCount({ matched: 3, sendable: 2, outTotal: 1 }),
  quote: { category: "MARKETING", unitPriceMicros: 400000, eligible: 2, costMicros: 800000, balanceMicros: 50000000, currency: "BRL", affordable: true },
  estimate: null,
  check: { findings: [], fingerprint: "", blocks: false, needsConfirmation: false },
};

function renderWizard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <WhatsAppCampaignWizard aiModels={["openai/gpt-4o-mini"]} modelPricing={[]} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function nextButton(label: string) {
  return screen.getAllByRole("button", { name: label })[0];
}

async function fillConfig() {
  renderWizard();
  fireEvent.change(await screen.findByLabelText(form.basicInfo.campaignName), { target: { value: "Matrículas 2027" } });
  fireEvent.click(screen.getByRole("button", { name: new RegExp(form.basicInfo.businessPhone) }));
  fireEvent.click(await screen.findByRole("option", { name: /Clínica/ }));
  await waitFor(() => expect(drafts.createCampaignDraftAction).toHaveBeenCalled(), SETTLE);
  await waitFor(() => expect(nextButton(wizard.next.message)).toBeEnabled(), SETTLE);
}

async function chooseTemplate() {
  fireEvent.click(nextButton(wizard.next.message));
  await waitFor(() => expect(screen.getByRole("button", { name: new RegExp(form.basicInfo.template) })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: new RegExp(form.basicInfo.template) }));
  fireEvent.click(await screen.findByRole("option", { name: /promo_outubro/ }));
  fireEvent.click(await screen.findByRole("switch", { name: form.validation.confirmTemplateLabel }));
}

async function uploadList() {
  fireEvent.click(nextButton(wizard.next.audience));
  fireEvent.change(await screen.findByTestId("audience-list-file"), { target: { files: [new File(["number;name"], "matriculas.csv")] } });
  expect(await screen.findByText("matriculas.csv")).toBeInTheDocument();
}

async function toReview() {
  await fillConfig();
  await chooseTemplate();
  await uploadList();
  await waitFor(() => expect(screen.queryByText(audienceStep.blocked.counting)).not.toBeInTheDocument(), SETTLE);
  fireEvent.click(nextButton(wizard.next.review));
}

async function toSend() {
  await toReview();
  expect(await screen.findByText(wizard.review.check.ready, undefined, SETTLE)).toBeInTheDocument();
  fireEvent.click(nextButton(wizard.next.send));
  await waitFor(() => expect(screen.getByRole("button", { name: send.now.action })).toBeEnabled(), SETTLE);
}

function lastSaved() {
  const update = drafts.updateCampaignDraftAction.mock.calls.at(-1);
  return (update ? update[2] : drafts.createCampaignDraftAction.mock.calls.at(-1)?.[1]) as { name: string; payload: { request: Record<string, unknown>; state: Record<string, unknown> } };
}

beforeEach(() => {
  saves = 0;
  search.value = "";
  catalog.phones = [{ id: "phone-1", displayPhoneNumber: "+55 11 4000-0000", verifiedName: "Clínica" }];
  catalog.templates = [TEMPLATE];
  catalog.byId = {};
  getTemplateExitVerdictAction.mockReset().mockResolvedValue({ data: EXIT_OK });
  Object.values(drafts).forEach((action) => action.mockReset());
  drafts.createCampaignDraftAction.mockImplementation(async (_channel: string, body: { name: string; payload: unknown }) => savedDraft("d1", body));
  drafts.updateCampaignDraftAction.mockImplementation(async (_channel: string, id: string, body: { name: string; payload: unknown }) => savedDraft(id, body));
  drafts.reviewCampaignDraftAction.mockResolvedValue({ data: REVIEW_OK });
  drafts.launchCampaignDraftAction.mockResolvedValue({ data: { campaign: { id: "camp-9" }, started: true, mode: "now", warnings: [] } });
  router.push.mockReset();
  router.replace.mockReset();
  toastMock.mockReset();
  toastMock.error.mockReset();
  toastMock.success.mockReset();
  Object.values(audienceActions).forEach((action) => action.mockReset());
  audienceActions.listAudienceFieldsAction.mockResolvedValue({ data: [], error: null });
  audienceActions.uploadAudienceListAction.mockResolvedValue({ data: PREVIEW, error: null });
  audienceActions.previewAudienceListAction.mockResolvedValue({ data: PREVIEW, error: null });
  audienceActions.countAudienceAction.mockResolvedValue({ data: audienceCount(), error: null });
  audienceActions.searchAudienceRowsAction.mockResolvedValue({
    data: { items: [{ id: "r1", line: 2, contact: "5511999990000", name: "Ana", variables: [], metadata: {}, missing: [], metadataMissing: [], existing: true }], page: 1, pageSize: 50, totalPages: 1, totalItems: 1 },
    error: null,
  });
});

describe("WhatsAppCampaignWizard steps and draft", () => {
  it("opens on Configuração with the steps closed until the draft has a name", async () => {
    renderWizard();
    expect(await screen.findByLabelText(form.basicInfo.campaignName)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: ptMessages.campaignWizard.steps.label })).toBeInTheDocument();
    expect(nextButton(wizard.next.message)).toBeDisabled();
    expect(screen.getByText(ptMessages.campaignWizard.save.needsName)).toBeInTheDocument();
    expect(screen.queryByText(form.basicInfo.scheduleToggle)).not.toBeInTheDocument();
    expect(drafts.createCampaignDraftAction).not.toHaveBeenCalled();
  });

  it("saves the draft on the server once named and updates the same draft after", async () => {
    await fillConfig();
    const [channel, created] = drafts.createCampaignDraftAction.mock.calls[0];
    expect(channel).toBe("whatsapp");
    expect(created.name).toBe("Matrículas 2027");
    expect(router.replace).toHaveBeenCalledWith("/dashboard/whatsapp-campaigns/new?draft=d1&step=config", { scroll: false });

    fireEvent.change(screen.getByLabelText(form.basicInfo.campaignName), { target: { value: "Matrículas 2028" } });
    await waitFor(() => expect(drafts.updateCampaignDraftAction).toHaveBeenCalled(), SETTLE);
    const [, id, updated] = drafts.updateCampaignDraftAction.mock.calls.at(-1)!;
    expect(id).toBe("d1");
    expect(updated.name).toBe("Matrículas 2028");
    expect(updated.payload.request).toMatchObject({ name: "Matrículas 2028", businessPhoneId: "phone-1", enableAnalysis: false });
    expect(updated.payload.request).not.toHaveProperty("aiModel");
    expect(updated.payload.state.values.aiModel).toBe("openai/gpt-4o-mini");
  });

  it("keeps the template, the preview, the confirmation and the exit on Mensagem", async () => {
    getTemplateExitVerdictAction.mockResolvedValue({ data: EXIT_NONE });
    await fillConfig();
    await chooseTemplate();
    expect(screen.getByText(form.preview.title)).toBeInTheDocument();
    expect(await screen.findByText(exitCopy.verdict.none)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("checkbox", { name: exitCopy.risk.confirm }));
    await waitFor(() => expect(lastSaved().payload.request).toMatchObject({ templateId: "tpl-1", exitRiskAcknowledged: true }), SETTLE);
    expect(lastSaved().payload.state).toMatchObject({ templateInfoConfirmed: true, exit: { templateId: "tpl-1", acknowledged: true } });
  });

  it("shows phone and template quality and send risks in the wizard", async () => {
    catalog.phones = [{ id: "phone-1", displayPhoneNumber: "+55 11 4000-0000", verifiedName: "Clínica", status: "CONNECTED", qualityRating: "RED" }];
    catalog.templates = [{ ...TEMPLATE, quality: "YELLOW" }];
    renderWizard();
    fireEvent.change(await screen.findByLabelText(form.basicInfo.campaignName), { target: { value: "Matrículas 2027" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(form.basicInfo.businessPhone) }));
    const phone = await screen.findByRole("option", { name: /Clínica/ });
    expect(within(phone).getByText(ptMessages.whatsappBusinessPhones.status.CONNECTED)).toBeInTheDocument();
    expect(within(phone).getByText(ptMessages.whatsappBusinessPhones.qualityRating.RED)).toBeInTheDocument();
    fireEvent.click(phone);
    expect(await screen.findByText(ptMessages.campaignSendRisk.phone.fault.title)).toBeInTheDocument();
    await waitFor(() => expect(nextButton(wizard.next.message)).toBeEnabled(), SETTLE);
    fireEvent.click(nextButton(wizard.next.message));
    await waitFor(() => expect(screen.getByRole("button", { name: new RegExp(form.basicInfo.template) })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: new RegExp(form.basicInfo.template) }));
    const template = await screen.findByRole("option", { name: /promo_outubro/ });
    expect(within(template).getByText(ptMessages.whatsappTemplates.status.approved)).toBeInTheDocument();
    expect(within(template).getByText(ptMessages.templateHealth.quality.YELLOW)).toBeInTheDocument();
    fireEvent.click(template);
    expect(await screen.findByText(ptMessages.campaignSendRisk.template.warning.title)).toBeInTheDocument();
  });

  it("sends the list as recipients from Público", async () => {
    await fillConfig();
    await chooseTemplate();
    await uploadList();
    await waitFor(() => expect(lastSaved().payload.request.recipients).toEqual({ source: "list", listId: "list-1" }), SETTLE);
    expect(lastSaved().payload.request).not.toHaveProperty("phoneNumbers");
    expect(lastSaved().payload.request).not.toHaveProperty("scheduledStart");
  });

  it("reopens a saved draft on its step with what was filled in", async () => {
    search.value = "draft=d7&step=audience";
    drafts.getCampaignDraftAction.mockResolvedValue({
      data: {
        id: "d7",
        channel: "whatsapp",
        name: "Volta às aulas",
        createdBy: "u1",
        createdAt: "2026-10-22T10:00:00Z",
        updatedAt: "2026-10-22T10:00:00Z",
        payload: {
          request: { name: "Volta às aulas", templateId: "tpl-1", businessPhoneId: "phone-1", recipients: { source: "list", listId: "list-1" } },
          state: {
            values: { name: "Volta às aulas", templateId: "tpl-1", businessPhoneId: "phone-1", agentId: null, workflowId: null, enableAgentResponses: false, showTemplateInCrm: true, enableAnalysis: false, enableAutoStaging: false, enableAutoMemory: false, aiModel: "openai/gpt-4o-mini" },
            responseMode: "agent",
            pipelineId: "",
            dealPipelineId: "",
            templateInfoConfirmed: true,
            audience: { source: "list", listId: "list-1", pick: "filter", filter: { stages: [], tags: [] }, search: "", ids: [], excludeIds: [], variables: {} },
            exit: { templateId: "tpl-1", choices: {}, acknowledged: false },
            smartPolicy: null,
          },
        },
      },
    });
    renderWizard();
    expect(await screen.findByText("matriculas.csv", undefined, SETTLE)).toBeInTheDocument();
    expect(drafts.getCampaignDraftAction).toHaveBeenCalledWith("whatsapp", "d7", expect.anything());
    fireEvent.click(screen.getByRole("button", { name: new RegExp(wizard.steps.config) }));
    expect(await screen.findByDisplayValue("Volta às aulas")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: form.basicInfo.showTemplateInCrm })).toHaveAttribute("aria-checked", "true");
  });
});

describe("WhatsAppCampaignWizard Revisão", () => {
  it("shows the server count and launch check without an estimated-cost notice", async () => {
    await toReview();
    expect(await screen.findByText(wizard.review.check.ready, undefined, SETTLE)).toBeInTheDocument();
    expect(drafts.reviewCampaignDraftAction).toHaveBeenCalledWith("whatsapp", "d1", expect.anything());
    const audience = screen.getByText(wizard.review.audience.sendable).closest("div") as HTMLElement;
    expect(within(audience).getByText("2")).toBeInTheDocument();
    expect(screen.queryByText(wizard.review.cost.title)).not.toBeInTheDocument();
  });

  it("asks to confirm the risks and sends their fingerprint with the launch", async () => {
    drafts.reviewCampaignDraftAction.mockResolvedValue({
      data: { ...REVIEW_OK, check: { findings: [{ code: "template_yellow", level: "confirm" }], fingerprint: "fp-risk", blocks: false, needsConfirmation: true } },
    });
    await toReview();
    const confirm = await screen.findByRole("checkbox", { name: ptMessages.launchCheck.confirm }, SETTLE);
    fireEvent.click(nextButton(wizard.next.send));
    expect(screen.getByRole("button", { name: send.now.action })).toBeDisabled();
    fireEvent.click(screen.getAllByRole("button", { name: new RegExp(wizard.steps.review) })[0]);
    fireEvent.click(await screen.findByRole("checkbox", { name: ptMessages.launchCheck.confirm }));
    expect(confirm).toBeDefined();
    fireEvent.click(nextButton(wizard.next.send));
    await waitFor(() => expect(screen.getByRole("button", { name: send.now.action })).toBeEnabled(), SETTLE);
    fireEvent.click(screen.getByRole("button", { name: send.now.action }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: send.confirm.nowAction }));
    await waitFor(() => expect(drafts.launchCampaignDraftAction).toHaveBeenCalledWith("whatsapp", "d1", { mode: "now", confirmedFingerprint: "fp-risk" }));
  });

  it("lists what is still missing and keeps sending closed", async () => {
    getTemplateExitVerdictAction.mockResolvedValue({ data: EXIT_NONE });
    await toReview();
    expect(await screen.findByText(wizard.review.pending.exit, undefined, SETTLE)).toBeInTheDocument();
    fireEvent.click(nextButton(wizard.next.send));
    expect(screen.getByRole("button", { name: send.now.action })).toBeDisabled();
  });
});

describe("WhatsAppCampaignWizard Envio", () => {
  it("sends now in one request and opens the campaign", async () => {
    await toSend();
    fireEvent.click(screen.getByRole("button", { name: send.now.action }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(wizard.confirm.nowTitle)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: send.confirm.nowAction }));
    await waitFor(() => expect(drafts.launchCampaignDraftAction).toHaveBeenCalledWith("whatsapp", "d1", { mode: "now" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/whatsapp-campaigns/camp-9"));
    expect(toastMock.success).toHaveBeenCalledWith(shared.toast.started);
  });

  it("schedules with the chosen time", async () => {
    drafts.launchCampaignDraftAction.mockResolvedValue({ data: { campaign: { id: "camp-9" }, started: false, mode: "schedule", warnings: [] } });
    await toSend();
    fireEvent.click(screen.getByRole("radio", { name: /Agendar/ }));
    fireEvent.change(screen.getByLabelText(send.schedule.when), { target: { value: "2030-01-15T09:30" } });
    fireEvent.click(screen.getByRole("button", { name: send.schedule.action }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: send.confirm.scheduleAction }));
    await waitFor(() => expect(drafts.launchCampaignDraftAction).toHaveBeenCalledWith("whatsapp", "d1", { mode: "schedule", scheduledStart: "2030-01-15T12:30:00.000Z" }));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith(shared.toast.scheduled));
  });

  it("leaves it ready without the dialog and opens the campaign", async () => {
    drafts.launchCampaignDraftAction.mockResolvedValue({ data: { campaign: { id: "camp-9" }, started: false, mode: "ready", warnings: [] } });
    await toSend();
    fireEvent.click(screen.getByRole("radio", { name: /Deixar pronta/ }));
    fireEvent.click(screen.getByRole("button", { name: send.ready.action }));
    await waitFor(() => expect(drafts.launchCampaignDraftAction).toHaveBeenCalledWith("whatsapp", "d1", { mode: "ready" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/whatsapp-campaigns/camp-9"));
    expect(toastMock.success).toHaveBeenCalledWith(shared.toast.readied);
  });

  it("opens a ready campaign without waiting for or refetching its consumed draft", async () => {
    drafts.launchCampaignDraftAction.mockResolvedValue({ data: { campaign: { id: "camp-9" }, started: false, mode: "ready", warnings: [] } });
    await toSend();
    fireEvent.click(screen.getByRole("radio", { name: /Deixar pronta/ }));
    const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries").mockImplementation(() => new Promise<void>(() => {}));
    try {
      fireEvent.click(screen.getByRole("button", { name: send.ready.action }));
      await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/whatsapp-campaigns/camp-9"));
      expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ refetchType: "none" }));
      expect(toastMock.error).not.toHaveBeenCalled();
    } finally {
      invalidate.mockRestore();
    }
  });

  it("keeps the campaign unstarted and shows the issues when the launch check blocks", async () => {
    drafts.launchCampaignDraftAction.mockResolvedValue({
      error: "blocked",
      code: "campaign_launch_blocked",
      status: 409,
      details: { blocks: ["template_not_ready"], confirms: [], fingerprint: "", findings: [{ code: "template_not_ready", level: "block" }] },
    });
    await toSend();
    fireEvent.click(screen.getByRole("button", { name: send.now.action }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: send.confirm.nowAction }));
    expect(await screen.findByText(send.refused)).toBeInTheDocument();
    expect(screen.getByText(ptMessages.launchCheck.codes.template_not_ready.title)).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledWith(shared.toast.failed, { description: shared.errors.campaign_launch_blocked });
  });

  it("says when the campaign was created ready but did not start", async () => {
    drafts.launchCampaignDraftAction.mockResolvedValue({ data: { campaign: { id: "camp-9" }, started: false, mode: "now", warnings: ["deal_automation_not_applied"], startRefusal: "campaign_settings_not_applied" } });
    await toSend();
    fireEvent.click(screen.getByRole("button", { name: send.now.action }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: send.confirm.nowAction }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(shared.toast.notStarted, { description: shared.errors.campaign_settings_not_applied }));
    expect(toastMock.error).toHaveBeenCalledWith(shared.toast.warning, { description: shared.warnings.deal_automation_not_applied });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/whatsapp-campaigns/camp-9"));
  });
});

describe("WhatsAppCampaignWizard tour", () => {
  it("walks the wizard steps in order and every anchor resolves on its step", async () => {
    renderWizard();
    await screen.findByLabelText(form.basicInfo.campaignName);
    const props = tour.props;
    if (!props?.onStep) throw new Error("the wizard does not drive the tour");
    const order = props.steps.map((step) => WHATSAPP_WIZARD_STEPS.indexOf(wizardStepOfTour(step) ?? "config"));
    expect(props.steps.every((step) => wizardStepOfTour(step) !== null)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(new Set(order).size).toBe(WHATSAPP_WIZARD_STEPS.length);
    for (const step of props.steps) {
      act(() => props.onStep?.(-1, step));
      await waitFor(() => expect(document.querySelector(step.target as string)).not.toBeNull());
    }
  });

  it("has copy for every tour step", () => {
    renderWizard();
    const copy = ptMessages.tourWhatsappCampaigns as unknown as Record<string, unknown>;
    const read = (key: string) => key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], copy);
    for (const step of tour.props?.steps ?? []) {
      for (const key of [step.badge, step.title, step.subtitle, ...(step.features ?? []).map((feature) => feature.text)]) {
        expect(typeof read(String(key ?? ""))).toBe("string");
      }
    }
  });
});
