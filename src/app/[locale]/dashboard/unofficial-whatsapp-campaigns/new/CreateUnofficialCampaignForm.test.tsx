import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UnofficialWhatsAppCampaign } from "@/lib/unofficial-whatsapp-campaigns/types";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

const actions = vi.hoisted(() => ({
  createUnofficialCampaignAction: vi.fn(),
  updateUnofficialCampaignAction: vi.fn(),
}));
vi.mock("@/app/actions/unofficial-whatsapp-campaigns", () => actions);

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock("@/app/actions/agents", () => ({ listAgentsAction: vi.fn(async () => ({ agents: [], meta: { totalPages: 1 } })) }));
vi.mock("@/app/actions/workflows", () => ({ listWorkflowsAction: vi.fn(async () => ({ workflows: [], meta: { totalPages: 1 } })) }));
vi.mock("@/app/actions/crm-board", () => ({ listPipelinesAction: vi.fn(async () => ({ pipelines: [] })) }));
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
    CampaignMessageComposer: ({ disabled }: { disabled?: boolean }) => (
      <fieldset aria-label="composer" disabled={disabled} />
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
