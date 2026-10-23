import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render as renderPlain, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

const draftActions = vi.hoisted(() => ({
  createCampaignDraftAction: vi.fn(),
  updateCampaignDraftAction: vi.fn(),
  getCampaignDraftAction: vi.fn(),
  reviewCampaignDraftAction: vi.fn(),
  launchCampaignDraftAction: vi.fn(),
  deleteCampaignDraftAction: vi.fn(),
  listCampaignDraftsAction: vi.fn(),
}));
vi.mock("@/app/actions/campaign-drafts", () => ({ ...draftActions, isDraftActionError: (result: object) => "error" in result }));

const groupActions = vi.hoisted(() => ({ listWorkspaceGroupsAction: vi.fn(), getWorkspaceGroupAction: vi.fn() }));
vi.mock("@/app/actions/unofficial-whatsapp-groups", () => groupActions);

const navigation = vi.hoisted(() => ({ search: "", push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

vi.mock("next-intl", () => ({
  useNow: () => new Date("2026-10-18T12:00:00Z"),
  useLocale: () => "pt",
  useFormatter: () => ({ dateTime: () => "18/10 12:00", number: (value: number) => String(value) }),
  useTranslations: (namespace: string) =>
    Object.assign((key: string) => `${namespace}.${key}`, { has: () => true, rich: (key: string) => `${namespace}.${key}` }),
}));

vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, can: () => true }) }));
vi.mock("@/components/leads/LeadsToolbar", () => ({ LeadsToolbar: () => <div data-testid="leads-toolbar" /> }));
vi.mock("@/components/leads/LeadSavedViews", () => ({ default: () => null }));
vi.mock("@/components/maps/LeadMap", () => ({ LeadMap: () => null }));
vi.mock("@/hooks/use-lead-map", () => ({ useLeadAreas: () => ({ data: [] }) }));
vi.mock("@/hooks/use-lead-field-definitions", () => ({ useLeadFieldDefinitions: () => ({ definitions: [] }) }));

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
  mapAudienceAction: vi.fn(),
}));
vi.mock("@/app/actions/campaign-audience", () => audienceActions);

vi.mock("@/app/actions/agents", () => ({ listAgentsAction: vi.fn(async () => ({ agents: [], meta: { totalPages: 1 } })) }));
vi.mock("@/app/actions/workflows", () => ({ listWorkflowsAction: vi.fn(async () => ({ workflows: [], meta: { totalPages: 1 } })) }));
vi.mock("@/app/actions/crm-board", () => ({ listPipelinesAction: vi.fn(async () => ({ pipelines: [] })) }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "u-1", role: "user" } }) }));

const selectState = { options: [], items: [], onSearch: () => undefined, onScrollEnd: () => undefined, onOpenChange: () => undefined, isLoading: false };
vi.mock("@/hooks/use-paginated-select", () => ({ usePaginatedSelect: () => selectState }));
vi.mock("@/components/unofficial-whatsapp/instance-select", () => ({
  useUnofficialInstanceSelect: () => selectState,
  InstanceIssueLine: () => null,
}));
vi.mock("@/components/elevated-design/elevated-command-select", () => ({
  ElevatedCommandSelect: ({ label, disabled, value, onValueChange }: { label: string; disabled?: boolean; value?: string; onValueChange?: (value: string) => void }) => (
    <input aria-label={label} disabled={disabled} value={value ?? ""} onChange={(event) => onValueChange?.(event.target.value)} />
  ),
}));
vi.mock("@/components/unofficial-whatsapp/campaign-message-composer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/unofficial-whatsapp/campaign-message-composer")>();
  return {
    ...actual,
    CampaignMessageComposer: ({ onChange, showExitLine }: { onChange: (next: { kind: "text"; bodies: string[] }) => void; showExitLine?: boolean }) => (
      <fieldset aria-label="composer">
        <button type="button" onClick={() => onChange({ kind: "text", bodies: ["Olá de novo"] })}>
          rewrite
        </button>
        <button type="button" onClick={() => onChange({ kind: "text", bodies: ["Olá {{1}}, responda /sair"] })}>
          personalize with exit
        </button>
        {showExitLine === false ? null : <p>exit-line</p>}
      </fieldset>
    ),
  };
});
vi.mock("@/components/campaigns/CampaignMediaPicker", () => ({ CampaignMediaPicker: () => null, MEDIA_ACCEPT: {} }));
vi.mock("@/components/unofficial-whatsapp/campaign-pacing-panel", () => ({
  CampaignPacingPanel: () => null,
  DEFAULT_SEND_DELAY_MS: { min: 3000, max: 12000 },
}));
vi.mock("@/components/channels/deal-automation-setting", () => ({
  DealAutomationSetting: () => null,
  DealAutomationDraft: ({ onChange }: { onChange: (value: string) => void }) => (
    <button type="button" onClick={() => onChange("pipe-9")}>
      pick deals
    </button>
  ),
}));
vi.mock("@/components/elevated-design/ai-model-selector", () => ({ AIModelSelector: () => null }));
vi.mock("@/components/elevated-design/grain-background", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/elevated-design/button", () => ({
  default: ({ title, type, onClick, disabled }: { title: string; type?: "button" | "submit"; onClick?: () => void; disabled?: boolean }) => (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled}>
      {title}
    </button>
  ),
}));

import { UnofficialCampaignWizard } from "./UnofficialCampaignWizard";
import type { GroupRow } from "@/lib/unofficial-whatsapp-groups/types";
import { emptyCrmFilter, type CrmFilter } from "@/lib/crm/board";
import { areaIdsOf, withDrawnArea } from "@/lib/leads/map-view";

function render(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderPlain(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const SETTLE = { timeout: 8000 };

vi.setConfig({ testTimeout: 30000 });

const LEADS_COUNT = {
  channel: "unofficial",
  source: "leads",
  matched: 120,
  withContact: 110,
  sendable: 100,
  out: { no_identity: 10 },
  outTotal: 10,
  requiredVariables: 1,
  variables: [{ key: "1", name: "1", header: false, source: "lead.first_name", missing: 0, policy: "", suggested: false, choiceRequired: false }],
  blockers: [],
  selection: { selected: 120, confirmCount: 120, fingerprint: "fp-1" },
  list: null,
  metadataMissing: [],
};

const HEALTHY_REVIEW = {
  audience: LEADS_COUNT,
  quote: null,
  estimate: { estimate: { seconds: 600, pending: 100, senders: 1, unsendable: 0 }, groups: [] },
  check: { findings: [], fingerprint: "", blocks: false, needsConfirmation: false },
};

function savedDraft(body: { name: string; payload: unknown }) {
  return { data: { id: "d-1", channel: "unofficial_whatsapp", name: body.name, payload: body.payload, createdBy: "u-1", createdAt: "2026-10-22T10:00:00Z", updatedAt: "2026-10-22T10:00:00Z" } };
}

beforeEach(() => {
  navigation.search = "";
  navigation.push.mockClear();
  navigation.replace.mockClear();
  toastMock.mockClear();
  toastMock.error.mockClear();
  toastMock.success.mockClear();
  Object.values(draftActions).forEach((action) => action.mockReset());
  draftActions.createCampaignDraftAction.mockImplementation(async (_channel: string, body: { name: string; payload: unknown }) => savedDraft(body));
  draftActions.updateCampaignDraftAction.mockImplementation(async (_channel: string, _id: string, body: { name: string; payload: unknown }) => savedDraft(body));
  draftActions.reviewCampaignDraftAction.mockResolvedValue({ data: HEALTHY_REVIEW });
  draftActions.listCampaignDraftsAction.mockResolvedValue({ data: { items: [] } });
  Object.values(audienceActions).forEach((action) => action.mockReset());
  audienceActions.listAudienceFieldsAction.mockResolvedValue({ data: [], error: null });
  audienceActions.countAudienceAction.mockResolvedValue({ data: LEADS_COUNT, error: null });
  audienceActions.searchAudienceRowsAction.mockResolvedValue({ data: { items: [], page: 1, pageSize: 50, totalPages: 0, totalItems: 0 }, error: null });
  groupActions.listWorkspaceGroupsAction.mockReset();
  groupActions.getWorkspaceGroupAction.mockReset();
});

function wizard(groupPrefill: { groupIds: string[] } | null = null) {
  return render(<UnofficialCampaignWizard aiModels={[]} modelPricing={[]} groupPrefill={groupPrefill} />);
}

function next(step: string) {
  const buttons = screen.getAllByText(`unofficialWhatsappCampaigns.wizard.next.${step}`);
  fireEvent.click(buttons[buttons.length - 1]);
}

function lastRequest() {
  const calls = [...draftActions.createCampaignDraftAction.mock.calls.map((call) => call[1]), ...draftActions.updateCampaignDraftAction.mock.calls.map((call) => call[2])];
  return calls[calls.length - 1] as { name: string; payload: { request: Record<string, unknown>; state: Record<string, unknown> } };
}

async function fillConfig() {
  fireEvent.change(screen.getByLabelText("unofficialWhatsappCampaigns.form.name"), { target: { value: "Rematrícula" } });
  fireEvent.change(screen.getByLabelText("unofficialWhatsappCampaigns.form.number"), { target: { value: "i-1" } });
  await waitFor(() => expect(draftActions.createCampaignDraftAction).toHaveBeenCalled(), SETTLE);
}

async function toMessage() {
  await fillConfig();
  next("message");
  await screen.findByLabelText("composer");
}

async function toAudience() {
  await toMessage();
  fireEvent.click(screen.getByText("personalize with exit"));
  next("audience");
  fireEvent.click(await screen.findByRole("button", { name: "campaignAudience.step.pick.everyone" }));
}

async function toReview() {
  await toAudience();
  await waitFor(() => expect(audienceActions.countAudienceAction).toHaveBeenCalled(), SETTLE);
  await waitFor(() => {
    if (screen.queryAllByText("unofficialWhatsappCampaigns.wizard.next.review").length > 0) next("review");
    expect(screen.getByText("unofficialWhatsappCampaigns.wizard.review.checkTitle")).toBeInTheDocument();
  }, SETTLE);
}

async function toSend() {
  await toReview();
  next("send");
  await screen.findByRole("radiogroup", { name: "campaignWizard.send.mode" });
}

describe("UnofficialCampaignWizard configuration", () => {
  it("starts on the setup step with the fields of today and no schedule switch", () => {
    wizard();
    expect(screen.getByRole("navigation", { name: "campaignWizard.steps.label" })).toBeInTheDocument();
    expect(screen.getByLabelText("unofficialWhatsappCampaigns.form.name")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "unofficialWhatsappCampaigns.form.audience.label" })).toBeInTheDocument();
    expect(screen.getByLabelText("unofficialWhatsappCampaigns.form.number")).toBeInTheDocument();
    expect(screen.getByText("unofficialWhatsappCampaigns.form.enableAnalysis")).toBeInTheDocument();
    expect(screen.queryByText("unofficialWhatsappCampaigns.form.scheduleToggle")).toBeNull();
    expect(screen.queryByLabelText("composer")).toBeNull();
  });

  it("saves a backend draft as soon as the campaign has a name, with the create body and the deal funnel", async () => {
    wizard();
    fireEvent.click(screen.getByText("pick deals"));
    await fillConfig();
    await waitFor(() => expect(lastRequest().payload.request).toMatchObject({ instanceId: "i-1", dealPipelineId: "pipe-9" }), SETTLE);
    const saved = lastRequest();
    expect(saved.name).toBe("Rematrícula");
    expect(saved.payload.request.scheduledStart).toBeUndefined();
    expect(navigation.replace).toHaveBeenCalledWith(expect.stringContaining("draft=d-1"), { scroll: false });
  });

  it("holds the setup step until a number is chosen for leads", async () => {
    wizard();
    fireEvent.change(screen.getByLabelText("unofficialWhatsappCampaigns.form.name"), { target: { value: "Rematrícula" } });
    await waitFor(() => expect(draftActions.createCampaignDraftAction).toHaveBeenCalled(), SETTLE);
    next("message");
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("unofficialWhatsappCampaigns.wizard.gate.title", { description: "unofficialWhatsappCampaigns.form.numberRequired" }),
    );
    expect(screen.queryByLabelText("composer")).toBeNull();
  });
});

describe("UnofficialCampaignWizard message and audience", () => {
  it("writes the message with the preview and holds it until the exit command shows", async () => {
    wizard();
    await toMessage();
    expect(screen.getByText("unofficialWhatsappCampaigns.form.previewTitle")).toBeInTheDocument();
    fireEvent.click(screen.getByText("rewrite"));
    next("audience");
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("unofficialWhatsappCampaigns.wizard.gate.title", { description: "unofficialWhatsappCampaigns.form.exitLine.refused" }),
    );
    fireEvent.click(screen.getByText("personalize with exit"));
    next("audience");
    expect(await screen.findByRole("group", { name: "campaignAudience.step.sourceLabel" })).toBeInTheDocument();
  });

  it("uses the shared audience step and keeps the review closed while the audience is not ready", async () => {
    audienceActions.countAudienceAction.mockResolvedValue({ data: { ...LEADS_COUNT, sendable: null, blockers: ["variable_choice_required"] }, error: null });
    wizard();
    await toAudience();
    await waitFor(() => expect(audienceActions.countAudienceAction).toHaveBeenCalled(), SETTLE);
    await waitFor(() => {
      if (screen.queryAllByText("unofficialWhatsappCampaigns.wizard.next.review").length > 0) next("review");
      expect(toastMock.error).toHaveBeenCalledWith("unofficialWhatsappCampaigns.wizard.gate.title", expect.objectContaining({ description: expect.stringContaining("campaignAudience.step.blocked") }));
    }, SETTLE);
    expect(draftActions.reviewCampaignDraftAction).not.toHaveBeenCalled();
  });
});

describe("UnofficialCampaignWizard review and send", () => {
  it("reviews the saved draft on the server with the confirmed recipients", async () => {
    wizard();
    await toReview();
    await waitFor(() => expect(draftActions.reviewCampaignDraftAction).toHaveBeenCalledWith("unofficial_whatsapp", "d-1", expect.anything()), SETTLE);
    expect(await screen.findByText("unofficialWhatsappCampaigns.wizard.review.ready")).toBeInTheDocument();
    expect(lastRequest().payload.request.recipients).toEqual({ source: "leads", selection: { mode: "everyone", expectedCount: 120, fingerprint: "fp-1" } });
  });

  it("shows the server start check findings in the review", async () => {
    draftActions.reviewCampaignDraftAction.mockResolvedValue({
      data: { ...HEALTHY_REVIEW, check: { findings: [{ code: "number_restricted", level: "block" }], fingerprint: "", blocks: true, needsConfirmation: false } },
    });
    wizard();
    await toReview();
    expect(await screen.findByText("launchCheck.codes.number_restricted.title")).toBeInTheDocument();
  });

  it("sends now through the confirm dialog and opens the campaign", async () => {
    draftActions.launchCampaignDraftAction.mockResolvedValue({ data: { campaign: { id: "c-7" }, started: true, mode: "now", warnings: [] } });
    wizard();
    await toSend();
    fireEvent.click(screen.getByText("campaignWizard.send.now.action"));
    fireEvent.click(await screen.findByText("campaignWizard.send.confirm.nowAction"));
    await waitFor(() => expect(draftActions.launchCampaignDraftAction).toHaveBeenCalledWith("unofficial_whatsapp", "d-1", { mode: "now" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/dashboard/unofficial-whatsapp-campaigns/c-7"));
    expect(toastMock.success).toHaveBeenCalledWith("campaignWizard.toast.started");
  });

  it("schedules with the chosen time", async () => {
    draftActions.launchCampaignDraftAction.mockResolvedValue({ data: { campaign: { id: "c-8" }, started: false, mode: "schedule", warnings: [] } });
    wizard();
    await toSend();
    fireEvent.click(screen.getByRole("radio", { name: /campaignWizard.send.schedule.title/ }));
    fireEvent.click(screen.getByText("campaignWizard.send.schedule.action"));
    fireEvent.click(await screen.findByText("campaignWizard.send.confirm.scheduleAction"));
    await waitFor(() => expect(draftActions.launchCampaignDraftAction).toHaveBeenCalledWith("unofficial_whatsapp", "d-1", { mode: "schedule", scheduledStart: expect.any(String) }));
    expect(toastMock.success).toHaveBeenCalledWith("campaignWizard.toast.scheduled");
  });

  it("leaves the campaign ready without a confirm dialog", async () => {
    draftActions.launchCampaignDraftAction.mockResolvedValue({ data: { campaign: { id: "c-9" }, started: false, mode: "ready", warnings: [] } });
    wizard();
    await toSend();
    fireEvent.click(screen.getByRole("radio", { name: /campaignWizard.send.ready.title/ }));
    fireEvent.click(screen.getByText("campaignWizard.send.ready.action"));
    await waitFor(() => expect(draftActions.launchCampaignDraftAction).toHaveBeenCalledWith("unofficial_whatsapp", "d-1", { mode: "ready" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/dashboard/unofficial-whatsapp-campaigns/c-9"));
  });

  it("keeps the campaign unstarted and lists the issues when the start check blocks", async () => {
    draftActions.launchCampaignDraftAction.mockResolvedValue({
      error: "blocked",
      code: "campaign_launch_blocked",
      status: 409,
      details: { blocks: ["number_restricted"], confirms: [], fingerprint: "", findings: [] },
    });
    wizard();
    await toSend();
    fireEvent.click(screen.getByText("campaignWizard.send.now.action"));
    fireEvent.click(await screen.findByText("campaignWizard.send.confirm.nowAction"));
    expect(await screen.findByText("campaignWizard.send.refused")).toBeInTheDocument();
    expect(screen.getByText("launchCheck.codes.number_restricted.title")).toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
    expect(screen.getByRole("radiogroup", { name: "campaignWizard.send.mode" })).toBeInTheDocument();
  });

  it("says the campaign was created but not started when the start refuses after creating", async () => {
    draftActions.launchCampaignDraftAction.mockResolvedValue({ data: { campaign: { id: "c-10" }, started: false, mode: "now", warnings: [], startRefusal: "number_restricted" } });
    wizard();
    await toSend();
    fireEvent.click(screen.getByText("campaignWizard.send.now.action"));
    fireEvent.click(await screen.findByText("campaignWizard.send.confirm.nowAction"));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("campaignWizard.toast.notStarted", { description: "launchCheck.codes.number_restricted.title" }),
    );
    expect(navigation.push).toHaveBeenCalledWith("/dashboard/unofficial-whatsapp-campaigns/c-10");
  });
});

function groupRow(id: string): GroupRow {
  return {
    group: { id, jid: `${id}@g.us`, subject: `Grupo ${id}`, memberCount: 12, origin: "managed" },
    numbers: [{ instanceId: "i-1", label: "Comercial", connected: true, admin: false, canPost: true }],
    activity: { messages: 0, joins: 0, leaves: 0 },
    hasAnalysis: false,
    runningCampaigns: 0,
  } as GroupRow;
}

describe("UnofficialCampaignWizard for groups", () => {
  it("picks groups in the audience step and saves them as targets with no number or funnel", async () => {
    groupActions.listWorkspaceGroupsAction.mockResolvedValue({ items: [groupRow("a")], meta: { page: 1, pageSize: 50, totalPages: 1, totalItems: 1 } });
    wizard({ groupIds: [] });
    expect(screen.queryByLabelText("unofficialWhatsappCampaigns.form.number")).toBeNull();
    fireEvent.change(screen.getByLabelText("unofficialWhatsappCampaigns.form.name"), { target: { value: "Ofertas" } });
    await waitFor(() => expect(draftActions.createCampaignDraftAction).toHaveBeenCalled(), SETTLE);
    next("message");
    await screen.findByLabelText("composer");
    expect(screen.queryByText("exit-line")).toBeNull();
    fireEvent.click(screen.getByText("rewrite"));
    next("audience");
    fireEvent.click(await screen.findByRole("checkbox", { name: "Grupo a" }));
    await waitFor(() => expect(lastRequest().payload.request).toMatchObject({ audience: "groups", targets: [{ groupJid: "a@g.us", name: "Grupo a" }], pipelineId: null }), SETTLE);
    expect(lastRequest().payload.request.instanceId).toBeUndefined();
    expect(within(screen.getByRole("list", { name: "unofficialWhatsappCampaigns.form.groups.picked" })).getByText("Grupo a")).toBeInTheDocument();
  });

  it("holds the audience step until a group is picked", async () => {
    groupActions.listWorkspaceGroupsAction.mockResolvedValue({ items: [groupRow("a")], meta: { page: 1, pageSize: 50, totalPages: 1, totalItems: 1 } });
    wizard({ groupIds: [] });
    fireEvent.change(screen.getByLabelText("unofficialWhatsappCampaigns.form.name"), { target: { value: "Ofertas" } });
    await waitFor(() => expect(draftActions.createCampaignDraftAction).toHaveBeenCalled(), SETTLE);
    next("message");
    await screen.findByLabelText("composer");
    fireEvent.click(screen.getByText("rewrite"));
    next("audience");
    await screen.findByRole("checkbox", { name: "Grupo a" });
    next("review");
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("unofficialWhatsappCampaigns.wizard.gate.title", { description: "unofficialWhatsappCampaigns.form.groups.noGroups" }),
    );
  });
});

describe("UnofficialCampaignWizard reopening a draft", () => {
  it("restores the saved draft on the step it was left", async () => {
    navigation.search = "draft=d-5";
    draftActions.getCampaignDraftAction.mockResolvedValue({
      data: {
        id: "d-5",
        channel: "unofficial_whatsapp",
        name: "Volta às aulas",
        payload: {
          request: { name: "Volta às aulas", instanceId: "i-1", message: { kind: "text", bodies: ["Oi /sair"] }, enableAnalysis: true, sendDelayMinMs: 9000, sendDelayMaxMs: 15000, dailyCap: 0 },
          state: { step: "message", responseMode: "agent", pickedGroups: [], seed: { on: false, sentPercent: 40, failedPercent: 10 } },
        },
        createdBy: "u-1",
        createdAt: "2026-10-22T10:00:00Z",
        updatedAt: "2026-10-22T10:00:00Z",
      },
    });
    wizard();
    expect(await screen.findByLabelText("composer")).toBeInTheDocument();
    expect(draftActions.getCampaignDraftAction).toHaveBeenCalledWith("unofficial_whatsapp", "d-5", expect.anything());
    fireEvent.click(screen.getAllByRole("button", { name: /unofficialWhatsappCampaigns.wizard.steps.config/ })[0]);
    expect(screen.getByLabelText("unofficialWhatsappCampaigns.form.name")).toHaveValue("Volta às aulas");
    expect(draftActions.createCampaignDraftAction).not.toHaveBeenCalled();
  });
});

function groupsDraft(audience: "groups" | "leads") {
  return {
    data: {
      id: "d-6",
      channel: "unofficial_whatsapp",
      name: "Ofertas",
      payload: {
        request:
          audience === "groups"
            ? { name: "Ofertas", audience: "groups", message: { kind: "text", bodies: ["Oi"] }, targets: [{ groupJid: "a@g.us", name: "Grupo a" }], sendDelayMinMs: 9000, sendDelayMaxMs: 15000, dailyCap: 0 }
            : { name: "Ofertas", instanceId: "i-1", message: { kind: "text", bodies: ["Oi /sair"] }, sendDelayMinMs: 9000, sendDelayMaxMs: 15000, dailyCap: 0 },
        state: {
          step: "audience",
          responseMode: "agent",
          pickedGroups: audience === "groups" ? [{ id: "a", jid: "a@g.us", subject: "Grupo a", origin: "managed", runningCampaigns: 0 }] : [],
          seed: { on: false, sentPercent: 40, failedPercent: 10 },
        },
      },
      createdBy: "u-1",
      createdAt: "2026-10-22T10:00:00Z",
      updatedAt: "2026-10-22T10:00:00Z",
    },
  };
}

describe("UnofficialCampaignWizard reopening a draft from a group link", () => {
  it("adds the linked groups to a reopened groups draft", async () => {
    navigation.search = "draft=d-6";
    draftActions.getCampaignDraftAction.mockResolvedValue(groupsDraft("groups"));
    groupActions.getWorkspaceGroupAction.mockResolvedValue({ data: groupRow("b") });
    groupActions.listWorkspaceGroupsAction.mockResolvedValue({ items: [groupRow("a"), groupRow("b")], meta: { page: 1, pageSize: 50, totalPages: 1, totalItems: 2 } });
    wizard({ groupIds: ["b"] });
    await waitFor(() => expect(groupActions.getWorkspaceGroupAction).toHaveBeenCalledWith("b"), SETTLE);
    await waitFor(
      () =>
        expect(lastRequest()?.payload.request.targets).toEqual([
          { groupJid: "a@g.us", name: "Grupo a" },
          { groupJid: "b@g.us", name: "Grupo b" },
        ]),
      SETTLE,
    );
    expect(screen.queryByText("unofficialWhatsappCampaigns.wizard.prefillIgnored")).toBeNull();
  });

  it("keeps the audience of a reopened leads draft and says the linked groups were not added", async () => {
    navigation.search = "draft=d-6";
    draftActions.getCampaignDraftAction.mockResolvedValue(groupsDraft("leads"));
    wizard({ groupIds: ["b"] });
    expect(await screen.findByText("unofficialWhatsappCampaigns.wizard.prefillIgnored")).toBeInTheDocument();
    expect(groupActions.getWorkspaceGroupAction).not.toHaveBeenCalled();
  });
});

describe("UnofficialCampaignWizard map round trip", () => {
  it("applies the areas chosen on the map to the same draft and step and saves them", async () => {
    navigation.search = "draft=d-8&step=audience&areas=area-2";
    draftActions.getCampaignDraftAction.mockResolvedValue({
      data: {
        id: "d-8",
        channel: "unofficial_whatsapp",
        name: "Bairros",
        payload: {
          request: { name: "Bairros", instanceId: "i-1", message: { kind: "text", bodies: ["Oi /sair"] }, sendDelayMinMs: 9000, sendDelayMaxMs: 15000, dailyCap: 0 },
          state: {
            step: "audience",
            responseMode: "agent",
            pickedGroups: [],
            audienceDraft: { source: "leads", listId: null, pick: "filter", filter: withDrawnArea(emptyCrmFilter, "area-1"), search: "", ids: [], excludeIds: [], variables: {} },
            seed: { on: false, sentPercent: 40, failedPercent: 10 },
          },
        },
        createdBy: "u-1",
        createdAt: "2026-10-22T10:00:00Z",
        updatedAt: "2026-10-22T10:00:00Z",
      },
    });
    audienceActions.mapAudienceAction.mockResolvedValue({ data: { layer: { kind: "points", points: [] }, located: 0, positions: 0, sampled: false, bounds: null }, error: null });
    wizard();
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/dashboard/unofficial-whatsapp-campaigns/new?draft=d-8&step=audience", { scroll: false }), SETTLE);
    await waitFor(() => expect(draftActions.updateCampaignDraftAction).toHaveBeenCalled(), SETTLE);
    const [, id, body] = draftActions.updateCampaignDraftAction.mock.calls.at(-1) as [string, string, { payload: { state: { audienceDraft: { filter: CrmFilter } } } }];
    expect(id).toBe("d-8");
    expect(areaIdsOf(body.payload.state.audienceDraft.filter)).toEqual(["area-2"]);
    await waitFor(() => expect(audienceActions.mapAudienceAction).toHaveBeenCalled(), SETTLE);
    expect(areaIdsOf(audienceActions.mapAudienceAction.mock.calls.at(-1)?.[1].selection.filter)).toEqual(["area-2"]);

    fireEvent.click(await screen.findByText("campaignAudience.step.map.edit", undefined, SETTLE));
    await waitFor(() => expect(navigation.push).toHaveBeenCalled());
    const opened = new URL(navigation.push.mock.calls.at(-1)?.[0] as string, "https://app.test");
    expect(opened.pathname).toBe("/dashboard/leads");
    expect(opened.searchParams.get("audienceChannel")).toBe("unofficial");
    expect(opened.searchParams.get("audienceDraft")).toBe("d-8");
  });
});
