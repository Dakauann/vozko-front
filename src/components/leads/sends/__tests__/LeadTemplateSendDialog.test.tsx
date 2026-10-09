import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const previewLeadActionAction = vi.fn();
const getLeadActionPreviewAction = vi.fn();
const startLeadActionAction = vi.fn();
const startLeadSendAction = vi.fn();
const cancelLeadSendAction = vi.fn();
const reviewLeadSendAction = vi.fn();
const listWhatsAppTemplatesAction = vi.fn();
const listBusinessPhonesAction = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const departments = vi.hoisted(() => ({ list: [] as { id: string; name: string }[], resolved: true, failed: false, refresh: vi.fn() }));

vi.mock("@/app/actions/lead-actions", () => ({
  previewLeadActionAction: (...args: unknown[]) => previewLeadActionAction(...args),
  getLeadActionPreviewAction: (...args: unknown[]) => getLeadActionPreviewAction(...args),
  startLeadActionAction: (...args: unknown[]) => startLeadActionAction(...args),
}));
vi.mock("@/app/actions/lead-sends", () => ({
  startLeadSendAction: (...args: unknown[]) => startLeadSendAction(...args),
  cancelLeadSendAction: (...args: unknown[]) => cancelLeadSendAction(...args),
  reviewLeadSendAction: (...args: unknown[]) => reviewLeadSendAction(...args),
}));
vi.mock("@/app/actions/whatsapp-templates", () => ({
  listWhatsAppTemplatesAction: (...args: unknown[]) => listWhatsAppTemplatesAction(...args),
}));
vi.mock("@/app/actions/whatsapp-outreach", () => ({ quoteTemplateSendAction: async () => ({ quote: null }) }));
vi.mock("@/app/actions/whatsapp-business-phones", () => ({
  listBusinessPhonesAction: (...args: unknown[]) => listBusinessPhonesAction(...args),
}));
vi.mock("@/hooks/use-exchange-rate", () => ({ useExchangeRate: () => null }));
vi.mock("@/hooks/use-lead-field-definitions", () => ({ useLeadFieldDefinitions: () => ({ definitions: [] }) }));
vi.mock("@/components/leads/use-lead-filter-options", () => ({
  useLeadFilterOptions: () => ({
    campaigns: [],
    stages: [],
    labels: [],
    cities: [],
    districts: [
      { pair: "barueri|jardim silveira", cityKey: "barueri", districtKey: "jardim silveira", district: "Jardim Silveira", city: "Barueri", state: "SP", count: 40 },
    ],
    members: new Map(),
    definitions: [],
    customFields: [],
    readsAddresses: true,
    pending: [],
    failed: [],
    fieldsFailed: false,
    retry: () => undefined,
  }),
}));
vi.mock("@/hooks/use-lead-map", () => ({ useLeadAreas: () => ({ data: [{ id: "area-1", name: "Região Norte" }] }) }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, can: () => true }),
}));
vi.mock("@/contexts/department-context", () => ({
  useDepartment: () => ({
    departments: departments.list,
    currentDepartment: null,
    isResolved: departments.resolved,
    loadFailed: departments.failed,
    refreshDepartments: departments.refresh,
  }),
}));
vi.mock("sonner", () => ({ toast: { success: (...args: unknown[]) => toastSuccess(...args), error: (...args: unknown[]) => toastError(...args) } }));

import type { LeadSelection } from "@/lib/leads/actions";

import { LeadTemplateSendDialog } from "../LeadTemplateSendDialog";

const t = ptMessages.leadSends;

const TEMPLATE = {
  id: "tpl-1",
  name: "matriculas_2027",
  language: "pt_BR",
  category: "MARKETING",
  status: "APPROVED",
  components: [{ type: "BODY", text: "Olá {{1}}, a unidade {{2}} abriu as matrículas." }],
};

const HEADER_TEMPLATE = {
  ...TEMPLATE,
  id: "tpl-2",
  name: "aviso_cabecalho",
  components: [{ type: "HEADER", format: "TEXT", text: "Oi {{1}}" }, { type: "BODY", text: "Olá {{1}}." }],
};

const QUOTE = {
  count: 12,
  parts: 1,
  splitRequired: false,
  maxPerCampaign: 150000,
  unitPriceMicros: 62500,
  costMicros: 750000,
  balanceMicros: 9000000,
  currency: "USD",
  affordable: true,
  fits: 12,
};

const REVIEW = {
  channel: "official",
  parts: [{ campaignId: "c-1", name: "Matrículas", status: "STOPPED", entries: 12, eligible: 10 }],
  entries: 12,
  eligible: 10,
  skipped: { blocked: 2 },
  counted: { window_open: 3 },
  quote: { ...QUOTE, count: 10, costMicros: 625000, fits: 10, capRemaining: 500 },
  started: false,
};

function renderDialog(onClose = vi.fn(), selection: LeadSelection = { mode: "ids", ids: ["l-1", "l-2"] }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <LeadTemplateSendDialog selection={selection} size={12} onClose={onClose} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return onClose;
}

async function chooseTemplate(name: string) {
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(within(dialog).getByRole("button", { name: new RegExp(`^${t.template.label}`) })).toBeEnabled());
  fireEvent.click(within(dialog).getByRole("button", { name: new RegExp(`^${t.template.label}`) }));
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(name) }));
}

async function reachReview() {
  renderDialog();
  await chooseTemplate(TEMPLATE.name);
  fireEvent.click(screen.getByRole("button", { name: t.actions.next }));
  fireEvent.change(screen.getByRole("textbox", { name: t.bindings.literalValue.replace("{slot}", "{{2}}") }), { target: { value: "Norte" } });
  await waitFor(() => expect(screen.getByRole("button", { name: t.actions.review })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: t.actions.review }));
  await screen.findByText(t.review.stopped);
}

describe("LeadTemplateSendDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    departments.list = [];
    departments.resolved = true;
    departments.failed = false;
    listBusinessPhonesAction.mockResolvedValue({ phones: [{ id: "bp-1", displayPhoneNumber: "+55 11 4199-0001", verifiedName: "Prisma" }] });
    listWhatsAppTemplatesAction.mockResolvedValue({ templates: [TEMPLATE, HEADER_TEMPLATE] });
    previewLeadActionAction.mockImplementation(async (request: { action: string }) => ({
      data: {
        id: "p-1",
        action: request.action,
        status: "done",
        result: { matched: 12, expectedCount: 12, fingerprint: "fp-12", selected: 12, eligible: 12, skipped: {} },
        send: QUOTE,
      },
      error: null,
    }));
    startLeadActionAction.mockResolvedValue({ data: { action: "send_template", send: REVIEW }, error: null });
    startLeadSendAction.mockResolvedValue({ data: { ...REVIEW, started: true, parts: [{ ...REVIEW.parts[0], status: "RUNNING" }] }, error: null });
    cancelLeadSendAction.mockResolvedValue({ data: { cancelled: true }, error: null });
  });

  it("binds the variables to lead fields and prepares a stopped send with the dialog's key", async () => {
    await reachReview();

    const [request, key] = startLeadActionAction.mock.calls[0];
    expect(request.action).toBe("send_template");
    expect(request.params.send).toMatchObject({
      businessPhoneId: "bp-1",
      templateId: "tpl-1",
      bindings: [{ source: "lead.first_name" }, { source: "literal", value: "Norte" }],
    });
    expect(request.params.send.name).toContain(TEMPLATE.name);
    expect(request.selection).toEqual({ mode: "ids", ids: ["l-1", "l-2"] });
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(8);

    expect(screen.getByText(t.review.receive).parentElement?.parentElement).toHaveTextContent("10");
    expect(screen.getByText(t.review.skipped.blocked)).toBeInTheDocument();
    expect(screen.queryByText(/exige consentimento/)).toBeNull();
    expect(screen.getByText(t.review.capRemaining.replace("{count, number}", "500"))).toBeInTheDocument();
  });

  it("names the template category and the specific reasons a lead is skipped", async () => {
    startLeadActionAction.mockResolvedValue({
      data: {
        action: "send_template",
        send: {
          ...REVIEW,
          entries: 20,
          skipped: { blocked: 2, cooldown: 4, missing_variable: 4 },
          missingVariables: [{ slot: 2, source: "lead.district", count: 4 }],
          cooldownDays: 3,
          quote: { ...REVIEW.quote, category: "MARKETING" },
        },
      },
      error: null,
    });
    await reachReview();
    expect(screen.getByText("Receberam disparo nos últimos 3 dias")).toBeInTheDocument();
    expect(screen.getByText("Sem bairro para a variável {{2}}")).toBeInTheDocument();
    expect(screen.queryByText(t.review.skipped.missing_variable)).toBeNull();
    expect(screen.getByText(/modelo matriculas_2027 \(Marketing\)/)).toBeInTheDocument();
  });

  it("keeps the lead total over the per-variable rows that can overlap", async () => {
    startLeadActionAction.mockResolvedValue({
      data: {
        action: "send_template",
        send: {
          ...REVIEW,
          skipped: { missing_variable: 5, cooldown: 1 },
          missingVariables: [
            { slot: 1, source: "lead.first_name", count: 4 },
            { slot: 2, source: "lead.district", count: 3 },
          ],
        },
      },
      error: null,
    });
    await reachReview();
    expect(screen.getByText(t.review.skipped.missing_variable)).toBeInTheDocument();
    expect(screen.getByText("Sem primeiro nome para a variável {{1}}")).toBeInTheDocument();
    expect(screen.getByText("Sem bairro para a variável {{2}}")).toBeInTheDocument();
    expect(screen.getByText(t.review.missingOverlap)).toBeInTheDocument();
    expect(screen.getByText(t.review.skipped.cooldown)).toBeInTheDocument();
  });

  it("states the filters and areas the selection came from", async () => {
    renderDialog(vi.fn(), {
      mode: "all_matching",
      filter: {
        groups: [
          {
            conjunction: "and",
            predicates: [
              { field: "district", operator: "in", values: ["barueri|jardim silveira"] },
              { field: "area", operator: "in", values: ["area-1"] },
              { field: "query", operator: "contains", values: ["maria"] },
            ],
          },
        ],
      },
    });
    expect(await screen.findByText("Seleção: Bairro: Jardim Silveira (Barueri) · Área: Região Norte · Busca: “maria”")).toBeInTheDocument();
  });

  it("states no filter for leads picked one by one", async () => {
    renderDialog();
    await screen.findByRole("dialog");
    expect(screen.queryByText(/^Seleção:/)).toBeNull();
  });

  it("starts the prepared send and leaves it running when the dialog closes", async () => {
    await reachReview();
    fireEvent.click(screen.getByRole("button", { name: /^Enviar para 10 leads/ }));
    await waitFor(() => expect(startLeadSendAction).toHaveBeenCalledWith({ channel: "official", campaignIds: ["c-1"] }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(cancelLeadSendAction).not.toHaveBeenCalled();
  });

  it("deletes the prepared send when the person cancels", async () => {
    await reachReview();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(cancelLeadSendAction).toHaveBeenCalledWith({ channel: "official", campaignIds: ["c-1"] }));
  });

  it("keeps the same key when the review is asked again after going back", async () => {
    await reachReview();
    fireEvent.click(screen.getByRole("button", { name: t.actions.back }));
    fireEvent.click(await screen.findByRole("button", { name: t.actions.review }));
    await screen.findByText(t.review.stopped);
    expect(startLeadActionAction).toHaveBeenCalledTimes(1);
  });

  it("refuses a template with a variable in the header before anything is asked", async () => {
    renderDialog();
    await chooseTemplate(HEADER_TEMPLATE.name);
    expect(await screen.findByText(t.errors.send_header_variable_unsupported)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.actions.next })).toBeDisabled();
    expect(previewLeadActionAction).not.toHaveBeenCalled();
  });

  it("asks for the department in a workspace that has departments", async () => {
    departments.list = [
      { id: "d-1", name: "Matrículas" },
      { id: "d-2", name: "Financeiro" },
    ];
    renderDialog();
    await chooseTemplate(TEMPLATE.name);
    expect(screen.getByText(t.department.required)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.actions.next })).toBeDisabled();
  });

  it("waits for the departments before letting the person go on", async () => {
    departments.resolved = false;
    renderDialog();
    await chooseTemplate(TEMPLATE.name);
    expect(screen.getByText(t.department.loading)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.actions.next })).toBeDisabled();
  });

  it("shows that the departments did not load and lets the person try again", async () => {
    departments.failed = true;
    renderDialog();
    await chooseTemplate(TEMPLATE.name);
    expect(screen.getByRole("alert")).toHaveTextContent(t.department.failed);
    expect(screen.getByRole("button", { name: t.actions.next })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: ptMessages.leadsPage.bulk.dialog.retry }));
    expect(departments.refresh).toHaveBeenCalled();
  });

  it("reloads the departments and goes back to the first step when the server asks for one", async () => {
    startLeadActionAction.mockResolvedValue({ data: null, error: { status: 400, code: "send_department_required" } });
    renderDialog();
    await chooseTemplate(TEMPLATE.name);
    fireEvent.click(screen.getByRole("button", { name: t.actions.next }));
    fireEvent.change(screen.getByRole("textbox", { name: t.bindings.literalValue.replace("{slot}", "{{2}}") }), { target: { value: "Norte" } });
    await waitFor(() => expect(screen.getByRole("button", { name: t.actions.review })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: t.actions.review }));
    await waitFor(() => expect(departments.refresh).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: t.actions.next })).toBeInTheDocument();
    expect(screen.getByText(t.errors.send_department_required)).toBeInTheDocument();
  });
});
