import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/i18n/messages/en.json";
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

function renderForm(initial: WhatsAppCampaign | null, locale: "pt" | "en" = "pt") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale={locale} messages={locale === "pt" ? ptMessages : enMessages}>
        <CreateWhatsAppCampaignForm mode={initial ? "edit" : "create"} initialCampaign={initial} aiModels={["openai/gpt-4o-mini"]} />
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

beforeEach(() => {
  getTemplateExitVerdictAction.mockReset().mockResolvedValue({ data: EXIT_OK });
  catalog.templates = [];
  catalog.phones = [];
  catalog.byId = {};
});

describe("CreateWhatsAppCampaignForm lead exit", () => {
  const exit = ptMessages.templateExit;

  async function chooseTemplate() {
    catalog.phones = [{ id: "phone-1", displayPhoneNumber: "+55 11 4000-0000", verifiedName: "Clínica" }];
    catalog.templates = TEMPLATES;
    renderForm(null);
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(form.basicInfo.businessPhone) }));
    fireEvent.click(await screen.findByRole("option", { name: /Clínica/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: new RegExp(form.basicInfo.template) })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: new RegExp(form.basicInfo.template) }));
    fireEvent.click(await screen.findByRole("option", { name: /promo_outubro/ }));
  }

  it("keeps creation closed until the user acknowledges a template with no exit", async () => {
    getTemplateExitVerdictAction.mockResolvedValue({ data: EXIT_NONE });
    await chooseTemplate();
    expect(await screen.findByText(exit.verdict.none)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: form.actions.create })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: exit.risk.confirm }));
    expect(screen.getByRole("button", { name: form.actions.create })).toBeEnabled();
  });

  it("shows the template exit and leaves creation open", async () => {
    await chooseTemplate();
    expect(await screen.findByText(exit.verdict.ok)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: exit.risk.confirm })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: form.actions.create })).toBeEnabled();
  });

  it("keeps creation closed while the template exit is still being checked", async () => {
    getTemplateExitVerdictAction.mockReturnValue(new Promise(() => undefined));
    await chooseTemplate();
    expect(await screen.findByText(exit.verdict.loading)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: form.actions.create })).toBeDisabled();
  });

  it("keeps creation closed when the template exit could not be checked", async () => {
    getTemplateExitVerdictAction.mockResolvedValue({ error: "down", status: 503 });
    await chooseTemplate();
    expect(await screen.findByText(exit.verdict.failed)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: form.actions.create })).toBeDisabled();
  });

  it("sends the acknowledgement with the new campaign once the user ticks it", async () => {
    getTemplateExitVerdictAction.mockResolvedValue({ data: EXIT_NONE });
    createWhatsAppCampaignAction.mockReset().mockResolvedValue({ campaign: { id: "camp-2" }, error: null });
    await chooseTemplate();
    fireEvent.change(screen.getByLabelText(form.basicInfo.campaignName), { target: { value: "Promo de outubro" } });
    fireEvent.change(screen.getByPlaceholderText("558499999999"), { target: { value: "5511999990000" } });
    fireEvent.click(screen.getByRole("switch", { name: form.validation.confirmTemplateLabel }));
    fireEvent.click(await screen.findByRole("checkbox", { name: exit.risk.confirm }));
    fireEvent.click(screen.getByRole("button", { name: form.actions.create }));

    await waitFor(() => expect(createWhatsAppCampaignAction).toHaveBeenCalledTimes(1));
    expect(createWhatsAppCampaignAction.mock.calls[0][0]).toMatchObject({ templateId: "tpl-1", exitRiskAcknowledged: true });
  });

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

describe("CreateWhatsAppCampaignForm copy", () => {
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

describe("CreateWhatsAppCampaignForm contact list", () => {
  const list = ptMessages.campaignContactList;

  function campaignWith(phoneNumbers: { number: string; name?: string; variables?: string[] }[]): WhatsAppCampaign {
    return {
      ...campaign(undefined),
      phoneNumbers: phoneNumbers.map((entry, index) => ({ id: `e${index}`, variables: [], metadata: {}, ...entry })),
    } as WhatsAppCampaign;
  }

  function numberInputs() {
    return screen.getAllByPlaceholderText("558499999999");
  }

  function bodyRows() {
    const [, ...rows] = within(screen.getByRole("table")).getAllByRole("row");
    return rows;
  }

  it("shows one row per contact and counts them once in the summary bar", async () => {
    renderForm(campaignWith([{ number: "5511999990000", name: "Ana" }, { number: "5511999990001", name: "Bruno" }]));

    await waitFor(() => expect(numberInputs()).toHaveLength(2));
    expect(bodyRows()).toHaveLength(2);
    expect(screen.getByText(list.total).nextElementSibling).toHaveTextContent("2");
    expect(screen.getByRole("columnheader", { name: list.number })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: list.name })).toBeInTheDocument();
  });

  it("adds a contact and removes it again", async () => {
    renderForm(campaignWith([{ number: "5511999990000", name: "Ana" }]));
    await waitFor(() => expect(numberInputs()).toHaveLength(1));
    expect(screen.queryByRole("button", { name: form.contacts.removeContact })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: form.contacts.addContact }));
    await waitFor(() => expect(numberInputs()).toHaveLength(2));

    fireEvent.click(screen.getAllByRole("button", { name: form.contacts.removeContact })[1]);
    await waitFor(() => expect(numberInputs()).toHaveLength(1));
    expect(numberInputs()[0]).toHaveValue("5511999990000");
  });

  it("keeps the metadata field adder folded until asked, then adds the field as a column", async () => {
    renderForm(campaignWith([{ number: "5511999990000", name: "Ana" }]));
    await waitFor(() => expect(numberInputs()).toHaveLength(1));
    expect(screen.queryByLabelText(form.contacts.newMetadataField)).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: form.contacts.metadataFields });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.change(screen.getByLabelText(form.contacts.newMetadataField), { target: { value: "plano" } });
    fireEvent.click(screen.getByRole("button", { name: form.contacts.addField }));

    expect(await screen.findByRole("columnheader", { name: "plano" })).toBeInTheDocument();
    expect(screen.getByLabelText(form.contacts.newMetadataField)).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: form.contacts.removeMetadataField.replace("{label}", "plano") }));
    await waitFor(() => expect(screen.queryByRole("columnheader", { name: "plano" })).not.toBeInTheDocument());
  });

  it("finds contacts by number or name", async () => {
    renderForm(
      campaignWith([
        { number: "5511999990000", name: "Ana" },
        { number: "5511999990001", name: "Bruno" },
        { number: "5584988880002", name: "Carla" },
      ]),
    );
    await waitFor(() => expect(numberInputs()).toHaveLength(3));

    fireEvent.change(screen.getByRole("searchbox", { name: list.search }), { target: { value: "bruno" } });
    await waitFor(() => expect(numberInputs()).toHaveLength(1));
    expect(numberInputs()[0]).toHaveValue("5511999990001");

    fireEvent.change(screen.getByRole("searchbox", { name: list.search }), { target: { value: "84988" } });
    await waitFor(() => expect(numberInputs()[0]).toHaveValue("5584988880002"));
    expect(numberInputs()).toHaveLength(1);
  });

  it("marks the contacts missing a template variable and narrows the list to them", async () => {
    catalog.byId = {
      "tpl-1": { id: "tpl-1", name: "promo_outubro", language: "pt_BR", category: "MARKETING", status: "APPROVED", components: [{ type: "BODY", text: "Olá {{1}}" }] },
    };
    renderForm(
      campaignWith([
        { number: "5511999990000", name: "Ana", variables: ["Ana"] },
        { number: "5511999990001", name: "Bruno", variables: [] },
      ]),
    );

    expect(await screen.findByRole("columnheader", { name: "{{1}}" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(list.missing).nextElementSibling).toHaveTextContent("1"));
    expect(screen.getAllByRole("img", { name: list.missingValue })).toHaveLength(1);
    expect(screen.getByText(form.validation.missingVariablesTitle)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: list.onlyMissing }));
    await waitFor(() => expect(numberInputs()).toHaveLength(1));
    expect(numberInputs()[0]).toHaveValue("5511999990001");

    fireEvent.click(screen.getByRole("button", { name: list.clearFilters }));
    await waitFor(() => expect(numberInputs()).toHaveLength(2));
  });
});
