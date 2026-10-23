import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render as renderPlain, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UnofficialWhatsAppCampaign } from "@/lib/unofficial-whatsapp-campaigns/types";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

const actions = vi.hoisted(() => ({
  createUnofficialCampaignAction: vi.fn(),
  updateUnofficialCampaignAction: vi.fn(),
}));
vi.mock("@/app/actions/unofficial-whatsapp-campaigns", () => actions);

const groupActions = vi.hoisted(() => ({
  listWorkspaceGroupsAction: vi.fn(),
  getWorkspaceGroupAction: vi.fn(),
}));
vi.mock("@/app/actions/unofficial-whatsapp-groups", () => groupActions);

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("next-intl", () => ({
  useNow: () => new Date("2026-10-18T12:00:00Z"),
  useLocale: () => "pt",
  useTranslations: (namespace: string) =>
    Object.assign((key: string) => `${namespace}.${key}`, { has: () => true, rich: (key: string) => `${namespace}.${key}` }),
}));

vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, can: () => true }) }));
vi.mock("@/components/leads/LeadsToolbar", () => ({ LeadsToolbar: () => <div data-testid="leads-toolbar" /> }));
vi.mock("@/components/leads/LeadSavedViews", () => ({ default: () => null }));
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
}));
vi.mock("@/app/actions/campaign-audience", () => audienceActions);

vi.mock("@/app/actions/agents", () => ({ listAgentsAction: vi.fn(async () => ({ agents: [], meta: { totalPages: 1 } })) }));
vi.mock("@/app/actions/workflows", () => ({ listWorkflowsAction: vi.fn(async () => ({ workflows: [], meta: { totalPages: 1 } })) }));
const pipelineActions = vi.hoisted(() => ({ listPipelinesAction: vi.fn() }));
vi.mock("@/app/actions/crm-board", () => pipelineActions);
vi.mock("@/lib/deal-automation/client", () => ({ applyDealAutomation: vi.fn(async () => true) }));
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
    CampaignMessageComposer: ({
      disabled,
      onChange,
      showExitLine,
    }: {
      disabled?: boolean;
      onChange: (next: { kind: "text"; bodies: string[] }) => void;
      showExitLine?: boolean;
    }) => (
      <fieldset aria-label="composer" disabled={disabled}>
        <button type="button" onClick={() => onChange({ kind: "text", bodies: ["Olá de novo"] })}>
          rewrite
        </button>
        <button type="button" onClick={() => onChange({ kind: "text", bodies: ["Olá {{1}}"] })}>
          personalize
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
  DealAutomationDraft: () => null,
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

import CreateUnofficialCampaignForm from "./CreateUnofficialCampaignForm";

function render(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderPlain(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

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

beforeEach(() => {
  pipelineActions.listPipelinesAction.mockReset();
  pipelineActions.listPipelinesAction.mockResolvedValue({ pipelines: [] });
  Object.values(audienceActions).forEach((action) => action.mockReset());
  audienceActions.listAudienceFieldsAction.mockResolvedValue({ data: [], error: null });
  audienceActions.countAudienceAction.mockResolvedValue({ data: LEADS_COUNT, error: null });
  audienceActions.searchAudienceRowsAction.mockResolvedValue({ data: { items: [], page: 1, pageSize: 50, totalPages: 0, totalItems: 0 }, error: null });
});

function campaign(source?: string, scheduledStart?: string): UnofficialWhatsAppCampaign {
  return {
    id: "c-1",
    name: "Campanha de outubro",
    instanceId: "i-1",
    message: { kind: "text", bodies: ["Oi"] },
    status: "STOPPED",
    source,
    scheduledStart,
  } as UnofficialWhatsAppCampaign;
}

describe("CreateUnofficialCampaignForm in edit mode", () => {
  beforeEach(() => {
    toastMock.mockClear();
    toastMock.error.mockClear();
    actions.updateUnofficialCampaignAction.mockReset();
    push.mockClear();
  });

  it("locks the number and the message of a send prepared from leads and says why", () => {
    render(<CreateUnofficialCampaignForm initialCampaign={campaign("lead_selection")} />);
    expect(screen.getByLabelText("unofficialWhatsappCampaigns.form.number")).toBeDisabled();
    expect(screen.getByLabelText("composer")).toBeDisabled();
    expect(screen.getByRole("note")).toHaveTextContent("leadSends.campaign.contentLocked");
  });

  it("keeps the number and the message editable on a campaign built by hand", () => {
    render(<CreateUnofficialCampaignForm initialCampaign={campaign()} />);
    expect(screen.getByLabelText("unofficialWhatsappCampaigns.form.number")).toBeEnabled();
    expect(screen.getByLabelText("composer")).toBeEnabled();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("offers no schedule on a send prepared from leads, since it only starts from the review", () => {
    render(<CreateUnofficialCampaignForm initialCampaign={campaign("lead_selection", "2026-10-20T12:00:00.000Z")} />);
    expect(screen.queryByText("unofficialWhatsappCampaigns.form.scheduleToggle")).toBeNull();
    expect(screen.queryByLabelText("unofficialWhatsappCampaigns.form.scheduledStart")).toBeNull();
  });

  it("keeps the schedule on a campaign built by hand", () => {
    render(<CreateUnofficialCampaignForm initialCampaign={campaign(undefined, "2026-10-20T12:00:00.000Z")} />);
    expect(screen.getByText("unofficialWhatsappCampaigns.form.scheduleToggle")).toBeInTheDocument();
  });

  it("saves a send prepared from leads without a scheduled start", async () => {
    actions.updateUnofficialCampaignAction.mockResolvedValue({ error: "conflict", code: "send_selection_locked" });
    render(<CreateUnofficialCampaignForm initialCampaign={campaign("lead_selection", "2026-10-20T12:00:00.000Z")} />);
    fireEvent.click(screen.getByText("unofficialWhatsappCampaigns.form.save"));
    await waitFor(() => expect(actions.updateUnofficialCampaignAction).toHaveBeenCalled());
    expect(actions.updateUnofficialCampaignAction.mock.calls[0][1]).toMatchObject({ scheduledStart: null });
  });

  it("shows the coded refusal when the server refuses the edit", async () => {
    actions.updateUnofficialCampaignAction.mockResolvedValue({ error: "conflict", code: "send_selection_locked" });
    render(<CreateUnofficialCampaignForm initialCampaign={campaign("lead_selection")} />);
    fireEvent.click(screen.getByText("unofficialWhatsappCampaigns.form.save"));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("unofficialWhatsappCampaigns.form.saveFailed", {
        description: "leadSends.errors.send_selection_locked",
      }),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps an old message without an exit but holds a new one until it shows the exit", () => {
    render(<CreateUnofficialCampaignForm initialCampaign={campaign()} />);
    expect(screen.getByText("unofficialWhatsappCampaigns.form.save")).toBeEnabled();

    fireEvent.click(screen.getByText("rewrite"));

    expect(screen.getByText("unofficialWhatsappCampaigns.form.save")).toBeDisabled();
  });

  it("explains the refusal of a message that does not show the exit", async () => {
    actions.updateUnofficialCampaignAction.mockResolvedValue({ error: "needs exit", code: "unofficial_campaign_needs_exit" });
    render(<CreateUnofficialCampaignForm initialCampaign={campaign()} />);
    fireEvent.click(screen.getByText("unofficialWhatsappCampaigns.form.save"));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("unofficialWhatsappCampaigns.form.saveFailed", {
        description: "unofficialWhatsappCampaigns.form.exitLine.refused",
      }),
    );
  });

  it("keeps the server message when the refusal has no known code", async () => {
    actions.updateUnofficialCampaignAction.mockResolvedValue({ error: "Falha ao salvar" });
    render(<CreateUnofficialCampaignForm initialCampaign={campaign()} />);
    fireEvent.click(screen.getByText("unofficialWhatsappCampaigns.form.save"));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("unofficialWhatsappCampaigns.form.saveFailed", {
        description: "Falha ao salvar",
      }),
    );
  });
});

function groupCampaign(): UnofficialWhatsAppCampaign {
  return { ...campaign(), audience: "groups" };
}

describe("CreateUnofficialCampaignForm for a groups campaign", () => {
  beforeEach(() => {
    actions.updateUnofficialCampaignAction.mockReset();
  });

  it("asks a groups campaign for no number and does not ask its message for an exit", () => {
    render(<CreateUnofficialCampaignForm initialCampaign={groupCampaign()} />);
    expect(screen.queryByLabelText("unofficialWhatsappCampaigns.form.number")).toBeNull();
    expect(screen.getByText("unofficialWhatsappCampaigns.form.groups.numberLocked")).toBeInTheDocument();
    expect(screen.queryByText("exit-line")).toBeNull();
    expect(screen.queryByRole("group", { name: "unofficialWhatsappCampaigns.form.audience.label" })).toBeNull();

    fireEvent.click(screen.getByText("rewrite"));

    expect(screen.getByText("unofficialWhatsappCampaigns.form.save")).toBeEnabled();
  });

  it("saves a groups campaign without naming a number", async () => {
    actions.updateUnofficialCampaignAction.mockResolvedValue({ campaign: { id: "c-1" } });
    render(<CreateUnofficialCampaignForm initialCampaign={groupCampaign()} />);
    fireEvent.click(screen.getByText("unofficialWhatsappCampaigns.form.save"));
    await waitFor(() => expect(actions.updateUnofficialCampaignAction).toHaveBeenCalled());
    expect(actions.updateUnofficialCampaignAction.mock.calls[0][1]).toMatchObject({ targets: [] });
    expect(actions.updateUnofficialCampaignAction.mock.calls[0][1].instanceId).toBeUndefined();
  });

  it("drops the funnel a groups campaign still carries when it is saved", async () => {
    actions.updateUnofficialCampaignAction.mockResolvedValue({ campaign: { id: "c-1" } });
    render(<CreateUnofficialCampaignForm initialCampaign={{ ...groupCampaign(), pipelineId: "p-1" }} />);
    expect(screen.getByText("unofficialWhatsappCampaigns.form.groups.funnelNotApplied")).toBeInTheDocument();
    fireEvent.click(screen.getByText("unofficialWhatsappCampaigns.form.save"));
    await waitFor(() => expect(actions.updateUnofficialCampaignAction).toHaveBeenCalled());
    expect(actions.updateUnofficialCampaignAction.mock.calls[0][1]).toMatchObject({ pipelineId: null });
  });

  it("keeps the funnel a leads campaign was given", async () => {
    actions.updateUnofficialCampaignAction.mockResolvedValue({ campaign: { id: "c-1" } });
    render(<CreateUnofficialCampaignForm initialCampaign={{ ...campaign(), pipelineId: "p-1" }} />);
    fireEvent.click(screen.getByText("unofficialWhatsappCampaigns.form.save"));
    await waitFor(() => expect(actions.updateUnofficialCampaignAction).toHaveBeenCalled());
    expect(actions.updateUnofficialCampaignAction.mock.calls[0][1]).toMatchObject({ pipelineId: "p-1" });
  });

});
