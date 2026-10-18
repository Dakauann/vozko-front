import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const createWhatsAppTemplateAction = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));

vi.mock("@/app/actions/whatsapp-templates", () => ({
  createWhatsAppTemplateAction,
  uploadTemplateHeaderMediaAction: vi.fn(),
}));
vi.mock("@/app/actions/whatsapp-business-phones", () => ({
  listBusinessPhonesAction: vi.fn(async () => ({
    phones: [{ id: "phone-1", displayPhoneNumber: "+55 11 4000-0000", verifiedName: "Clínica" }],
    meta: { totalPages: 1 },
  })),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/TourGuide", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
const getDraftExitVerdictAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/template-exit", () => ({ getDraftExitVerdictAction }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, can: () => true }) }));

import NewWhatsAppTemplatePage from "../page";

const tpl = ptMessages.whatsappTemplates;
const exit = ptMessages.templateExit;

async function fillTemplate() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <NewWhatsAppTemplatePage />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText(tpl.form.labels.name), { target: { value: "promo_outubro" } });
  fireEvent.click(screen.getByRole("button", { name: new RegExp(tpl.form.labels.businessPhone.replace(/[()]/g, ".")) }));
  fireEvent.click(await screen.findByRole("option", { name: /Clínica/ }));
  fireEvent.click(screen.getByRole("button", { name: new RegExp(tpl.builder.palette.body.label) }));
  fireEvent.change(screen.getByPlaceholderText(/^Digite o texto da sua mensagem/), { target: { value: "Olá, temos novidades." } });
}

function createButton() {
  return screen.getAllByRole("button", { name: tpl.form.buttons.create })[0];
}

beforeEach(() => {
  getDraftExitVerdictAction.mockReset().mockResolvedValue({
    data: {
      verdict: { state: "none", buttons: [], exitWords: [], templateExitRequired: true, campaignAcknowledgementRequired: true },
      allowedKinds: ["opt_out", "consent_grant", "hand_off"],
    },
  });
  createWhatsAppTemplateAction.mockReset();
  router.push.mockReset();
});

describe("Creating a marketing template the server says shows no exit", () => {
  it("offers only to add an exit, never to create without one", async () => {
    createWhatsAppTemplateAction.mockResolvedValueOnce({ template: null, error: "no exit", errorCode: "marketing_template_needs_exit" });
    await fillTemplate();
    fireEvent.click(createButton());

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(exit.createDialog.title)).toBeInTheDocument();
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(dialog).getAllByRole("radio")).toHaveLength(2);
    expect(createWhatsAppTemplateAction.mock.calls[0][0]).not.toHaveProperty("exitRiskAcknowledged");

    fireEvent.click(within(dialog).getByRole("button", { name: exit.createDialog.back }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(createWhatsAppTemplateAction).toHaveBeenCalledTimes(1);
  });

  it("writes the footer with the command and sends the footer text as the only source of the word", async () => {
    createWhatsAppTemplateAction
      .mockResolvedValueOnce({ template: null, error: "no exit", errorCode: "marketing_template_needs_exit" })
      .mockResolvedValueOnce({ template: { id: "tpl-1", status: "PENDING" }, error: null });
    await fillTemplate();
    fireEvent.click(createButton());

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: new RegExp(exit.choice.word) }));
    fireEvent.change(within(dialog).getByLabelText(exit.choice.wordLabel), { target: { value: "parar" } });
    fireEvent.change(within(dialog).getByLabelText(exit.confirmation.label), { target: { value: "Pronto." } });
    fireEvent.click(within(dialog).getByRole("button", { name: exit.createDialog.applyAndCreate }));

    await waitFor(() => expect(createWhatsAppTemplateAction).toHaveBeenCalledTimes(2));
    const payload = createWhatsAppTemplateAction.mock.calls[1][0];
    expect(payload).not.toHaveProperty("exitRiskAcknowledged");
    expect(payload).not.toHaveProperty("exitWords");
    expect(payload).toMatchObject({ exitConfirmation: "Pronto." });
    expect(payload.components).toContainEqual({ type: "FOOTER", text: exit.choice.footerSentence.replace("{command}", "/parar") });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/whatsapp-templates"));
  });

  it("warns on the canvas from the server's draft verdict, judged on the texts the lead sees", async () => {
    await fillTemplate();
    expect(await screen.findByText(exit.verdict.marketingNone, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(getDraftExitVerdictAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: "MARKETING", body: "Olá, temos novidades.", footer: "", buttons: [] }),
    );
    expect(getDraftExitVerdictAction.mock.lastCall?.[0]).not.toHaveProperty("exitWords");
  });
});

describe("The kinds the builder offers", () => {
  async function exitKindsOffered() {
    fireEvent.click(screen.getByRole("button", { name: new RegExp(tpl.builder.palette.lead_exit.label) }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: new RegExp(exit.choice.button) }));
    fireEvent.click(within(dialog).getByRole("combobox", { name: exit.action.label }));
    return screen.queryAllByRole("option").map((option) => option.textContent);
  }

  it("come from the server's draft verdict", async () => {
    getDraftExitVerdictAction.mockResolvedValue({
      data: {
        verdict: { state: "none", buttons: [], exitWords: [], templateExitRequired: true, campaignAcknowledgementRequired: true },
        allowedKinds: ["hand_off", "opt_out"],
      },
    });
    await fillTemplate();
    await waitFor(() => expect(getDraftExitVerdictAction).toHaveBeenCalled(), { timeout: 3000 });
    await waitFor(async () => expect(await exitKindsOffered()).toEqual([exit.kinds.opt_out]), { timeout: 3000 });
  });

  it("leave out every exit kind when the draft verdict failed", async () => {
    getDraftExitVerdictAction.mockResolvedValue({ error: "boom", status: 500 });
    await fillTemplate();
    await waitFor(() => expect(getDraftExitVerdictAction).toHaveBeenCalled(), { timeout: 3000 });
    expect(await exitKindsOffered()).toEqual([]);
  });
});

describe("The lead exit piece", () => {
  it("puts the footer that shows the command on the canvas", async () => {
    await fillTemplate();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(tpl.builder.palette.lead_exit.label) }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: new RegExp(exit.choice.word) }));
    fireEvent.change(within(dialog).getByLabelText(exit.choice.wordLabel), { target: { value: "parar" } });
    fireEvent.click(within(dialog).getByRole("button", { name: exit.choice.apply }));
    expect(await screen.findAllByText(exit.choice.footerSentence.replace("{command}", "/parar"))).not.toHaveLength(0);
    expect(screen.getByText(exit.piece.used)).toBeInTheDocument();
  });
});
