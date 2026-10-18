import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

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
  ElevatedCommandSelect: ({ label, disabled }: { label: string; disabled?: boolean }) => (
    <select aria-label={label} disabled={disabled} />
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
import type { GroupDetail, GroupOrigin, GroupRow } from "@/lib/unofficial-whatsapp-groups/types";

beforeEach(() => {
  pipelineActions.listPipelinesAction.mockReset();
  pipelineActions.listPipelinesAction.mockResolvedValue({ pipelines: [] });
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
    render(<CreateUnofficialCampaignForm mode="edit" initialCampaign={campaign("lead_selection")} />);
    expect(screen.getByLabelText("unofficialWhatsappCampaigns.form.number")).toBeDisabled();
    expect(screen.getByLabelText("composer")).toBeDisabled();
    expect(screen.getByRole("note")).toHaveTextContent("leadSends.campaign.contentLocked");
  });

  it("keeps the number and the message editable on a campaign built by hand", () => {
    render(<CreateUnofficialCampaignForm mode="edit" initialCampaign={campaign()} />);
    expect(screen.getByLabelText("unofficialWhatsappCampaigns.form.number")).toBeEnabled();
    expect(screen.getByLabelText("composer")).toBeEnabled();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("offers no schedule on a send prepared from leads, since it only starts from the review", () => {
    render(<CreateUnofficialCampaignForm mode="edit" initialCampaign={campaign("lead_selection", "2026-10-20T12:00:00.000Z")} />);
    expect(screen.queryByText("unofficialWhatsappCampaigns.form.scheduleToggle")).toBeNull();
    expect(screen.queryByLabelText("unofficialWhatsappCampaigns.form.scheduledStart")).toBeNull();
  });

  it("keeps the schedule on a campaign built by hand", () => {
    render(<CreateUnofficialCampaignForm mode="edit" initialCampaign={campaign(undefined, "2026-10-20T12:00:00.000Z")} />);
    expect(screen.getByText("unofficialWhatsappCampaigns.form.scheduleToggle")).toBeInTheDocument();
  });

  it("saves a send prepared from leads without a scheduled start", async () => {
    actions.updateUnofficialCampaignAction.mockResolvedValue({ error: "conflict", code: "send_selection_locked" });
    render(<CreateUnofficialCampaignForm mode="edit" initialCampaign={campaign("lead_selection", "2026-10-20T12:00:00.000Z")} />);
    fireEvent.click(screen.getByText("unofficialWhatsappCampaigns.form.save"));
    await waitFor(() => expect(actions.updateUnofficialCampaignAction).toHaveBeenCalled());
    expect(actions.updateUnofficialCampaignAction.mock.calls[0][1]).toMatchObject({ scheduledStart: null });
  });

  it("shows the coded refusal when the server refuses the edit", async () => {
    actions.updateUnofficialCampaignAction.mockResolvedValue({ error: "conflict", code: "send_selection_locked" });
    render(<CreateUnofficialCampaignForm mode="edit" initialCampaign={campaign("lead_selection")} />);
    fireEvent.click(screen.getByText("unofficialWhatsappCampaigns.form.save"));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("unofficialWhatsappCampaigns.form.saveFailed", {
        description: "leadSends.errors.send_selection_locked",
      }),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps an old message without an exit but holds a new one until it shows the exit", () => {
    render(<CreateUnofficialCampaignForm mode="edit" initialCampaign={campaign()} />);
    expect(screen.getByText("unofficialWhatsappCampaigns.form.save")).toBeEnabled();

    fireEvent.click(screen.getByText("rewrite"));

    expect(screen.getByText("unofficialWhatsappCampaigns.form.save")).toBeDisabled();
  });

  it("explains the refusal of a message that does not show the exit", async () => {
    actions.updateUnofficialCampaignAction.mockResolvedValue({ error: "needs exit", code: "unofficial_campaign_needs_exit" });
    render(<CreateUnofficialCampaignForm mode="edit" initialCampaign={campaign()} />);
    fireEvent.click(screen.getByText("unofficialWhatsappCampaigns.form.save"));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("unofficialWhatsappCampaigns.form.saveFailed", {
        description: "unofficialWhatsappCampaigns.form.exitLine.refused",
      }),
    );
  });

  it("keeps the server message when the refusal has no known code", async () => {
    actions.updateUnofficialCampaignAction.mockResolvedValue({ error: "Falha ao salvar" });
    render(<CreateUnofficialCampaignForm mode="edit" initialCampaign={campaign()} />);
    fireEvent.click(screen.getByText("unofficialWhatsappCampaigns.form.save"));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("unofficialWhatsappCampaigns.form.saveFailed", {
        description: "Falha ao salvar",
      }),
    );
  });
});

describe("CreateUnofficialCampaignForm recipients", () => {
  function paste(value: string) {
    fireEvent.change(screen.getByPlaceholderText("unofficialWhatsappCampaigns.form.recipientsPlaceholder"), {
      target: { value },
    });
  }

  function bodyRows() {
    const [, ...rows] = within(screen.getByRole("table")).getAllByRole("row");
    return rows;
  }

  function stat(label: string) {
    return screen.getByText(label).nextElementSibling;
  }

  it("shows no contact table until something is pasted", () => {
    render(<CreateUnofficialCampaignForm />);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("lists the kept contacts one per row under one summary of what was kept and dropped", () => {
    render(<CreateUnofficialCampaignForm />);
    paste("5584999990001,Ana,ouro\n5584999990002;Bia\n5584999990001\n123");

    expect(bodyRows()).toHaveLength(2);
    expect(within(bodyRows()[0]).getByText("5584999990001")).toBeInTheDocument();
    expect(within(bodyRows()[0]).getByText("Ana")).toBeInTheDocument();
    expect(within(bodyRows()[0]).getByText("ouro")).toBeInTheDocument();
    expect(within(bodyRows()[1]).getAllByText("n/d")).toHaveLength(1);
    expect(screen.getByRole("columnheader", { name: "unofficialWhatsappCampaigns.form.recipientsVariable" })).toBeInTheDocument();
    expect(stat("campaignContactList.total")).toHaveTextContent("2");
    expect(stat("unofficialWhatsappCampaigns.form.recipientsDuplicates")).toHaveTextContent("1");
    expect(stat("unofficialWhatsappCampaigns.form.recipientsInvalid")).toHaveTextContent("1");
    expect(screen.queryByText("campaignContactList.missing")).toBeNull();
  });

  it("finds a pasted contact by number or name", () => {
    render(<CreateUnofficialCampaignForm />);
    paste("5584999990001,Ana\n5584999990002,Bia\n5511988880003,Carla");

    fireEvent.change(screen.getByRole("searchbox", { name: "campaignContactList.search" }), { target: { value: "bia" } });
    expect(bodyRows()).toHaveLength(1);
    expect(within(bodyRows()[0]).getByText("5584999990002")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "campaignContactList.search" }), { target: { value: "1198" } });
    expect(bodyRows()).toHaveLength(1);
    expect(within(bodyRows()[0]).getByText("Carla")).toBeInTheDocument();
  });
});

function groupRow(id: string, canPost: boolean, instanceId = "i-1", origin: GroupOrigin = "managed"): GroupRow {
  return {
    group: { id, jid: `${id}@g.us`, subject: `Grupo ${id}`, memberCount: 12, origin },
    numbers: [{ instanceId, label: "Comercial", connected: true, admin: false, canPost }],
    activity: { messages: 0, joins: 0, leaves: 0 },
    hasAnalysis: false,
    runningCampaigns: 0,
  } as GroupRow;
}

function groupCampaign(): UnofficialWhatsAppCampaign {
  return { ...campaign(), audience: "groups" };
}

describe("CreateUnofficialCampaignForm destination", () => {
  beforeEach(() => {
    toastMock.error.mockClear();
    actions.createUnofficialCampaignAction.mockReset();
    actions.updateUnofficialCampaignAction.mockReset();
    groupActions.listWorkspaceGroupsAction.mockReset();
    groupActions.getWorkspaceGroupAction.mockReset();
    groupActions.listWorkspaceGroupsAction.mockResolvedValue({
      items: [groupRow("a", true), groupRow("b", false)],
      meta: { page: 1, pageSize: 50, totalPages: 1, totalItems: 2 },
    });
    push.mockClear();
  });

  function audience(label: string) {
    return within(screen.getByRole("group", { name: "unofficialWhatsappCampaigns.form.audience.label" })).getByRole("button", { name: label });
  }

  function fillName() {
    fireEvent.change(screen.getByLabelText("unofficialWhatsappCampaigns.form.name"), { target: { value: "Ofertas da semana" } });
  }

  it("sends to leads by default, with the spreadsheet and the exit line as today", () => {
    render(<CreateUnofficialCampaignForm />);
    expect(audience("unofficialWhatsappCampaigns.form.audience.leads")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByPlaceholderText("unofficialWhatsappCampaigns.form.recipientsPlaceholder")).toBeInTheDocument();
    expect(screen.getByText("exit-line")).toBeInTheDocument();
    expect(groupActions.listWorkspaceGroupsAction).not.toHaveBeenCalled();
  });

  it("asks for the number before listing groups", () => {
    render(<CreateUnofficialCampaignForm />);
    fireEvent.click(audience("unofficialWhatsappCampaigns.form.audience.groups"));
    expect(screen.queryByPlaceholderText("unofficialWhatsappCampaigns.form.recipientsPlaceholder")).toBeNull();
    expect(screen.getByText("unofficialWhatsappCampaigns.form.groups.pickNumberFirst")).toBeInTheDocument();
    expect(groupActions.listWorkspaceGroupsAction).not.toHaveBeenCalled();
  });

  it("lists only the groups the number can post in, explains the read-only ones and notes the ban risk in one line", async () => {
    render(<CreateUnofficialCampaignForm groupPrefill={{ instanceId: "i-1", groupIds: [] }} />);
    expect(audience("unofficialWhatsappCampaigns.form.audience.groups")).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByRole("checkbox", { name: "Grupo a" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Grupo b" })).toBeNull();
    expect(groupActions.listWorkspaceGroupsAction).toHaveBeenCalledWith(expect.objectContaining({ instanceId: "i-1" }));
    expect(screen.getByText("unofficialWhatsappCampaigns.form.groups.readOnlyHidden")).toBeInTheDocument();
    expect(screen.getByText("unofficialWhatsappCampaigns.form.groups.banRisk")).toBeInTheDocument();
    expect(screen.queryByText("unofficialWhatsappCampaigns.form.groups.banRiskTitle")).toBeNull();
    expect(screen.queryByText("unofficialGroups.kit.notices.external.title")).toBeNull();
    expect(screen.queryByPlaceholderText("unofficialWhatsappCampaigns.form.recipientsPlaceholder")).toBeNull();
    expect(screen.queryByText("unofficialWhatsappCampaigns.form.downloadExample")).toBeNull();
    expect(screen.queryByText("exit-line")).toBeNull();
  });

  it("creates the campaign for the picked groups by jid and subject, with no exit command in the message", async () => {
    actions.createUnofficialCampaignAction.mockResolvedValue({ campaign: { id: "c-9" } });
    render(<CreateUnofficialCampaignForm groupPrefill={{ instanceId: "i-1", groupIds: [] }} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Grupo a" }));
    fillName();
    fireEvent.click(screen.getByText("rewrite"));

    expect(screen.getByText("unofficialWhatsappCampaigns.form.create")).toBeEnabled();
    fireEvent.click(screen.getByText("unofficialWhatsappCampaigns.form.create"));

    await waitFor(() => expect(actions.createUnofficialCampaignAction).toHaveBeenCalled());
    expect(actions.createUnofficialCampaignAction.mock.calls[0][0]).toMatchObject({
      audience: "groups",
      instanceId: "i-1",
      targets: [{ groupJid: "a@g.us", name: "Grupo a" }],
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/unofficial-whatsapp-campaigns/c-9"));
  });

  it("refuses a groups campaign without any group picked", async () => {
    render(<CreateUnofficialCampaignForm groupPrefill={{ instanceId: "i-1", groupIds: [] }} />);
    await screen.findByRole("checkbox", { name: "Grupo a" });
    fillName();
    fireEvent.click(screen.getByText("rewrite"));
    fireEvent.click(screen.getByText("unofficialWhatsappCampaigns.form.create"));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("unofficialWhatsappCampaigns.form.saveFailed", {
        description: "unofficialWhatsappCampaigns.form.groups.noGroups",
      }),
    );
    expect(actions.createUnofficialCampaignAction).not.toHaveBeenCalled();
  });

  it("refuses variables in a message for groups, since a group has no values to fill them", async () => {
    render(<CreateUnofficialCampaignForm groupPrefill={{ instanceId: "i-1", groupIds: [] }} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Grupo a" }));
    fillName();
    fireEvent.click(screen.getByText("personalize"));
    fireEvent.click(screen.getByText("unofficialWhatsappCampaigns.form.create"));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("unofficialWhatsappCampaigns.form.saveFailed", {
        description: "unofficialWhatsappCampaigns.form.groups.noVariables",
      }),
    );
    expect(actions.createUnofficialCampaignAction).not.toHaveBeenCalled();
  });

  it("preselects the groups a link names and says which ones the number cannot post in", async () => {
    groupActions.getWorkspaceGroupAction.mockImplementation(async (id: string) => ({
      data: { ...groupRow(id, id === "a") } as GroupDetail,
    }));
    render(<CreateUnofficialCampaignForm groupPrefill={{ instanceId: "i-1", groupIds: ["a", "b"] }} />);

    const picked = await screen.findByRole("list", { name: "unofficialWhatsappCampaigns.form.groups.picked" });
    expect(within(picked).getByText("Grupo a")).toBeInTheDocument();
    expect(within(picked).queryByText("Grupo b")).toBeNull();
    expect(screen.getByText("unofficialWhatsappCampaigns.form.groups.prefillSkipped")).toBeInTheDocument();
    expect(groupActions.getWorkspaceGroupAction).toHaveBeenCalledWith("a");
    expect(groupActions.getWorkspaceGroupAction).toHaveBeenCalledWith("b");
  });

  it("drops a picked group when its chip is removed", async () => {
    render(<CreateUnofficialCampaignForm groupPrefill={{ instanceId: "i-1", groupIds: [] }} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Grupo a" }));
    const picked = screen.getByRole("list", { name: "unofficialWhatsappCampaigns.form.groups.picked" });
    fireEvent.click(within(picked).getByRole("button", { name: "unofficialWhatsappCampaigns.form.groups.remove" }));
    expect(screen.queryByRole("list", { name: "unofficialWhatsappCampaigns.form.groups.picked" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Grupo a" })).not.toBeChecked();
  });

  it("keeps the number of a groups campaign fixed and does not ask its message for an exit", () => {
    render(<CreateUnofficialCampaignForm mode="edit" initialCampaign={groupCampaign()} />);
    expect(screen.getByLabelText("unofficialWhatsappCampaigns.form.number")).toBeDisabled();
    expect(screen.getByText("unofficialWhatsappCampaigns.form.groups.numberLocked")).toBeInTheDocument();
    expect(screen.queryByText("exit-line")).toBeNull();
    expect(screen.queryByRole("group", { name: "unofficialWhatsappCampaigns.form.audience.label" })).toBeNull();

    fireEvent.click(screen.getByText("rewrite"));

    expect(screen.getByText("unofficialWhatsappCampaigns.form.save")).toBeEnabled();
  });

  it("saves a groups campaign on its own number", async () => {
    actions.updateUnofficialCampaignAction.mockResolvedValue({ campaign: { id: "c-1" } });
    render(<CreateUnofficialCampaignForm mode="edit" initialCampaign={groupCampaign()} />);
    fireEvent.click(screen.getByText("unofficialWhatsappCampaigns.form.save"));
    await waitFor(() => expect(actions.updateUnofficialCampaignAction).toHaveBeenCalled());
    expect(actions.updateUnofficialCampaignAction.mock.calls[0][1]).toMatchObject({ instanceId: "i-1", targets: [] });
  });

  it("offers the funnel to a leads campaign", async () => {
    pipelineActions.listPipelinesAction.mockResolvedValue({ pipelines: [{ id: "p-1", name: "Vendas" }] });
    render(<CreateUnofficialCampaignForm />);
    expect(await screen.findByLabelText("unofficialWhatsappCampaigns.form.pipeline")).toBeInTheDocument();
    expect(screen.queryByText("unofficialWhatsappCampaigns.form.groups.funnelNotApplied")).toBeNull();
  });

  it("hides the funnel for groups and says why in one line", async () => {
    pipelineActions.listPipelinesAction.mockResolvedValue({ pipelines: [{ id: "p-1", name: "Vendas" }] });
    render(<CreateUnofficialCampaignForm groupPrefill={{ instanceId: "i-1", groupIds: [] }} />);
    await screen.findByRole("checkbox", { name: "Grupo a" });
    await waitFor(() => expect(pipelineActions.listPipelinesAction).toHaveBeenCalled());
    expect(screen.queryByLabelText("unofficialWhatsappCampaigns.form.pipeline")).toBeNull();
    expect(screen.getByText("unofficialWhatsappCampaigns.form.groups.funnelNotApplied")).toBeInTheDocument();
  });

  it("hides the funnel again when the destination switches from leads to groups", async () => {
    pipelineActions.listPipelinesAction.mockResolvedValue({ pipelines: [{ id: "p-1", name: "Vendas" }] });
    render(<CreateUnofficialCampaignForm />);
    await screen.findByLabelText("unofficialWhatsappCampaigns.form.pipeline");
    fireEvent.click(audience("unofficialWhatsappCampaigns.form.audience.groups"));
    expect(screen.queryByLabelText("unofficialWhatsappCampaigns.form.pipeline")).toBeNull();
    expect(screen.getByText("unofficialWhatsappCampaigns.form.groups.funnelNotApplied")).toBeInTheDocument();
  });

  it("creates a groups campaign with no funnel", async () => {
    actions.createUnofficialCampaignAction.mockResolvedValue({ campaign: { id: "c-9" } });
    render(<CreateUnofficialCampaignForm groupPrefill={{ instanceId: "i-1", groupIds: [] }} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Grupo a" }));
    fillName();
    fireEvent.click(screen.getByText("rewrite"));
    fireEvent.click(screen.getByText("unofficialWhatsappCampaigns.form.create"));
    await waitFor(() => expect(actions.createUnofficialCampaignAction).toHaveBeenCalled());
    expect(actions.createUnofficialCampaignAction.mock.calls[0][0]).toMatchObject({ audience: "groups", pipelineId: null });
  });

  it("drops the funnel a groups campaign still carries when it is saved", async () => {
    actions.updateUnofficialCampaignAction.mockResolvedValue({ campaign: { id: "c-1" } });
    render(<CreateUnofficialCampaignForm mode="edit" initialCampaign={{ ...groupCampaign(), pipelineId: "p-1" }} />);
    expect(screen.getByText("unofficialWhatsappCampaigns.form.groups.funnelNotApplied")).toBeInTheDocument();
    fireEvent.click(screen.getByText("unofficialWhatsappCampaigns.form.save"));
    await waitFor(() => expect(actions.updateUnofficialCampaignAction).toHaveBeenCalled());
    expect(actions.updateUnofficialCampaignAction.mock.calls[0][1]).toMatchObject({ pipelineId: null });
  });

  it("keeps the funnel a leads campaign was given", async () => {
    actions.updateUnofficialCampaignAction.mockResolvedValue({ campaign: { id: "c-1" } });
    render(<CreateUnofficialCampaignForm mode="edit" initialCampaign={{ ...campaign(), pipelineId: "p-1" }} />);
    fireEvent.click(screen.getByText("unofficialWhatsappCampaigns.form.save"));
    await waitFor(() => expect(actions.updateUnofficialCampaignAction).toHaveBeenCalled());
    expect(actions.updateUnofficialCampaignAction.mock.calls[0][1]).toMatchObject({ pipelineId: "p-1" });
  });

  it("warns about the ban risk of external groups only once one is picked", async () => {
    groupActions.listWorkspaceGroupsAction.mockResolvedValue({
      items: [groupRow("a", true), groupRow("x", true, "i-1", "external")],
      meta: { page: 1, pageSize: 50, totalPages: 1, totalItems: 2 },
    });
    render(<CreateUnofficialCampaignForm groupPrefill={{ instanceId: "i-1", groupIds: [] }} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Grupo a" }));
    expect(screen.queryByText("unofficialGroups.kit.notices.external.title")).toBeNull();
    const rowOf = (name: string) => screen.getByRole("checkbox", { name }).closest("label") as HTMLElement;
    expect(within(rowOf("Grupo x")).getByText("unofficialGroups.kit.origin.external")).toBeInTheDocument();
    expect(within(rowOf("Grupo a")).getByText("unofficialGroups.kit.origin.managed")).toBeInTheDocument();
    const picked = () => screen.getByRole("list", { name: "unofficialWhatsappCampaigns.form.groups.picked" });
    expect(within(picked()).queryByText("unofficialGroups.kit.origin.external")).toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: "Grupo x" }));
    expect(screen.getByText("unofficialGroups.kit.notices.external.title")).toBeInTheDocument();
    expect(within(picked()).getByText("unofficialGroups.kit.origin.external")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Grupo x" }));
    expect(screen.queryByText("unofficialGroups.kit.notices.external.title")).toBeNull();
  });

  it("warns about the ban risk when a link preselects an external group", async () => {
    groupActions.getWorkspaceGroupAction.mockImplementation(async (id: string) => ({
      data: { ...groupRow(id, true, "i-1", "external") } as GroupDetail,
    }));
    render(<CreateUnofficialCampaignForm groupPrefill={{ instanceId: "i-1", groupIds: ["x"] }} />);
    expect(await screen.findByText("unofficialGroups.kit.notices.external.title")).toBeInTheDocument();
  });
});
