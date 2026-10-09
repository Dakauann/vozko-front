import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
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

vi.mock("@/app/actions/whatsapp-templates", () => ({
  getWhatsAppTemplateByIdAction: vi.fn(async () => ({ template: null })),
  listWhatsAppTemplatesAction: vi.fn(async () => ({ templates: [], meta: { totalPages: 1 } })),
  updateWhatsAppTemplateHeaderMediaAction: vi.fn(),
}));

vi.mock("@/app/actions/whatsapp-business-phones", () => ({
  getBusinessPhoneByIdAction: vi.fn(async () => ({ phone: null })),
  listBusinessPhonesAction: vi.fn(async () => ({ phones: [], meta: { totalPages: 1 } })),
}));

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

const { noAgentVariables, router } = vi.hoisted(() => ({
  noAgentVariables: { variables: [], loading: false },
  router: { push: () => undefined, refresh: () => undefined, replace: () => undefined },
}));
vi.mock("@/lib/agents/use-agent-required-variables", () => ({
  useAgentRequiredVariables: () => noAgentVariables,
}));

vi.mock("@/components/channels/deal-automation-setting", () => ({
  DealAutomationSetting: () => null,
  DealAutomationDraft: () => null,
}));

vi.mock("@/lib/deal-automation/client", () => ({ applyDealAutomation: vi.fn(async () => true) }));

vi.mock("@/components/whatsapp/TemplateEditModal", () => ({ default: () => null }));

const { auth } = vi.hoisted(() => ({ auth: { user: { role: "user" } } }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => auth }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

import CreateWhatsAppCampaignForm from "../CreateWhatsAppCampaignForm";

function campaign(source?: string): WhatsAppCampaign {
  return {
    id: "camp-1",
    source,
    name: "Disparo da seleção",
    type: "marketing" as WhatsAppCampaign["type"],
    templateId: "tpl-1",
    businessPhoneId: "phone-1",
    enableAgentResponses: false,
    preferAudio: false,
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

function renderForm(initial: WhatsAppCampaign) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <CreateWhatsAppCampaignForm mode="edit" initialCampaign={initial} aiModels={["openai/gpt-4o-mini"]} />
    </NextIntlClientProvider>,
  );
}

const form = ptMessages.whatsappCampaignsPage.form;
const selection = ptMessages.leadSends;

describe("CreateWhatsAppCampaignForm editing a send prepared from leads", () => {
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
    expect(screen.getByText(selection.campaign.contactsLocked)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(form.basicInfo.businessPhone) })).toBeDisabled();
    expect(screen.getByRole("button", { name: new RegExp(form.basicInfo.template) })).toBeDisabled();
    expect(screen.queryByRole("button", { name: form.contacts.uploadCsv })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: form.contacts.addContact })).not.toBeInTheDocument();
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
    expect(payload).toMatchObject({ name: "Disparo da seleção", templateId: "tpl-1", businessPhoneId: "phone-1", phoneNumbers: [] });
    expect(payload.scheduledStart).toBeUndefined();
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(form.toast.error, { description: selection.errors.send_selection_locked }),
    );
  });

  it("keeps a campaign built by hand fully editable", async () => {
    renderForm(campaign(undefined));

    expect(await screen.findByRole("button", { name: form.contacts.uploadCsv })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(form.basicInfo.businessPhone) })).not.toBeDisabled();
    expect(screen.queryByText(selection.campaign.templateLocked)).not.toBeInTheDocument();
    expect(screen.queryByText(selection.campaign.contactsLocked)).not.toBeInTheDocument();
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
