import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const createWhatsAppTemplateAction = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
const audience = vi.hoisted(() => ({ listTemplateFieldsAction: vi.fn(), saveTemplateSuggestionsAction: vi.fn(), getTemplateSuggestionsAction: vi.fn() }));

vi.mock("@/app/actions/whatsapp-templates", () => ({ createWhatsAppTemplateAction, uploadTemplateHeaderMediaAction: vi.fn() }));
vi.mock("@/app/actions/whatsapp-business-phones", () => ({
  listBusinessPhonesAction: vi.fn(async () => ({
    phones: [{ id: "phone-1", displayPhoneNumber: "+55 11 4000-0000", verifiedName: "Clínica" }],
    meta: { totalPages: 1 },
  })),
}));
vi.mock("@/app/actions/campaign-audience", () => audience);
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/TourGuide", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast }));
const getDraftExitVerdictAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/template-exit", () => ({ getDraftExitVerdictAction }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, can: () => true }) }));

import NewWhatsAppTemplatePage from "../page";

const tpl = ptMessages.whatsappTemplates;
const body = tpl.form.editor.body;
const sources = ptMessages.leadSends.bindings.sources;

function textArea() {
  return screen.getByPlaceholderText(/^Digite o texto da sua mensagem/);
}

async function pickField(name: string) {
  fireEvent.click(screen.getByRole("button", { name: body.addVariable }));
  fireEvent.click(await screen.findByRole("button", { name }));
}

async function startTemplate() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <NewWhatsAppTemplatePage />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText(tpl.form.labels.name), { target: { value: "matriculas" } });
  fireEvent.click(screen.getByRole("button", { name: new RegExp(tpl.form.labels.businessPhone.replace(/[()]/g, ".")) }));
  fireEvent.click(await screen.findByRole("option", { name: /Clínica/ }));
  await waitFor(() => expect(document.activeElement).not.toBe(document.body));
  fireEvent.click(screen.getByRole("button", { name: new RegExp(tpl.builder.palette.body.label) }));
  fireEvent.change(textArea(), { target: { value: "Olá " } });
}

function create() {
  fireEvent.click(screen.getAllByRole("button", { name: tpl.form.buttons.create })[0]);
}

beforeEach(() => {
  getDraftExitVerdictAction.mockReset().mockResolvedValue({
    data: { verdict: { state: "ok", buttons: [], exitWords: ["parar"], templateExitRequired: false, campaignAcknowledgementRequired: false }, allowedKinds: [] },
  });
  createWhatsAppTemplateAction.mockReset().mockResolvedValue({ template: { id: "tpl-9", status: "PENDING" }, error: null });
  audience.listTemplateFieldsAction.mockReset().mockResolvedValue({
    data: [
      { source: "lead.first_name", kind: "lead", column: "primeiro_nome" },
      { source: "lead.district", kind: "lead", column: "bairro" },
    ],
    error: null,
  });
  audience.saveTemplateSuggestionsAction.mockReset().mockResolvedValue({ data: { templateId: "tpl-9", suggestions: [] }, error: null });
  router.push.mockReset();
  toast.error.mockReset();
});

describe("Creating a template with suggested lead fields", () => {
  it("saves the suggestions once the template exists and never sends them to Meta", async () => {
    await startTemplate();
    await pickField(sources.firstName);
    fireEvent.change(textArea(), { target: { value: "Olá {{1}}, tudo bem?" } });
    create();

    await waitFor(() => expect(audience.saveTemplateSuggestionsAction).toHaveBeenCalledWith("tpl-9", [{ slot: 1, source: "lead.first_name" }]));
    const payload = createWhatsAppTemplateAction.mock.calls[0][0];
    expect(JSON.stringify(payload)).not.toContain("lead.first_name");
    expect(payload.components).toContainEqual({ type: "BODY", text: "Olá {{1}}, tudo bem?", example: { body_text: [["Maria"]] } });
    expect(createWhatsAppTemplateAction.mock.invocationCallOrder[0]).toBeLessThan(audience.saveTemplateSuggestionsAction.mock.invocationCallOrder[0]);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/whatsapp-templates"));
  });

  it("sends only the slots still in the text", async () => {
    await startTemplate();
    await pickField(sources.firstName);
    await pickField(sources.district);
    fireEvent.change(textArea(), { target: { value: "Unidade {{2}}, até logo." } });
    create();

    await waitFor(() => expect(audience.saveTemplateSuggestionsAction).toHaveBeenCalledWith("tpl-9", [{ slot: 2, source: "lead.district" }]));
  });

  it("does not call the suggestions when no variable has a field", async () => {
    await startTemplate();
    fireEvent.change(textArea(), { target: { value: "Olá, tudo bem?" } });
    create();
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(audience.saveTemplateSuggestionsAction).not.toHaveBeenCalled();
  });

  it("keeps the created template when the suggestions fail", async () => {
    audience.saveTemplateSuggestionsAction.mockResolvedValue({ data: null, error: { message: "x", code: "template_suggestion_slot_invalid", status: 422 } });
    await startTemplate();
    await pickField(sources.firstName);
    fireEvent.change(textArea(), { target: { value: "Olá {{1}}, tudo bem?" } });
    create();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/whatsapp-templates"));
    expect(toast.error).toHaveBeenCalledWith(body.suggestionsSaveFailed, { description: ptMessages.campaignAudience.errors.template_suggestion_slot_invalid });
  });
});
