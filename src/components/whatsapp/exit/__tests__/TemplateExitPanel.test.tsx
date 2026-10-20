import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import rawPtMessages from "@/i18n/messages/pt.json";
import { brandedMessages } from "@/test/branded-messages";
import type { ExitVerdict, TemplateButtonActions } from "@/lib/whatsapp-templates/exit";

const ptMessages = brandedMessages(rawPtMessages);

const actions = vi.hoisted(() => ({
  getTemplateButtonActionsAction: vi.fn(),
  saveTemplateButtonActionsAction: vi.fn(),
  getTemplateExitVerdictAction: vi.fn(),
}));
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/template-exit", () => actions);
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, can: () => true }) }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }));

import { TemplateExitPanel } from "../TemplateExitPanel";

const t = ptMessages.templateExit;

const STORED: TemplateButtonActions = {
  templateId: "tpl-1",
  template: { name: "promo", language: "pt_BR" },
  version: 4,
  buttons: [
    { index: 0, text: "Ver horários", action: null, stale: false },
    { index: 1, text: "Não quero", action: null, stale: false },
  ],
  actions: [],
  exitConfirmation: "",
  allowedKinds: ["opt_out", "hand_off", "start_workflow"],
};

const NONE: ExitVerdict = {
  state: "none",
  buttons: STORED.buttons,
  exitWords: [],
  templateExitRequired: true,
  campaignAcknowledgementRequired: true,
};

const SHOWN_WORD: ExitVerdict = { ...NONE, state: "ok", exitWords: ["sair"], templateExitRequired: false, campaignAcknowledgementRequired: false };

function renderPanel(canEdit = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <TemplateExitPanel templateId="tpl-1" canEdit={canEdit} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  actions.getTemplateButtonActionsAction.mockReset().mockResolvedValue({ data: STORED });
  actions.getTemplateExitVerdictAction.mockReset().mockResolvedValue({ data: NONE });
  actions.saveTemplateButtonActionsAction.mockReset();
  toastSuccess.mockReset();
});

describe("TemplateExitPanel", () => {
  it("warns when the server says this template needs an exit, and says its sends ask for the acknowledgement", async () => {
    renderPanel();
    expect(await screen.findByText(t.verdict.marketingNone)).toBeInTheDocument();
    expect(screen.getByText(t.verdict.sendsNeedAck)).toBeInTheDocument();
  });

  it("never says a template needs no exit when the server gates its sends", async () => {
    actions.getTemplateExitVerdictAction.mockResolvedValue({ data: { ...NONE, templateExitRequired: false } });
    renderPanel();
    expect(await screen.findByText(t.verdict.sendsNeedAck)).toBeInTheDocument();
    expect(screen.queryByText(t.verdict.marketingNone)).not.toBeInTheDocument();
  });

  it("stays quiet when the server says no acknowledgement is needed", async () => {
    actions.getTemplateExitVerdictAction.mockResolvedValue({ data: { ...NONE, templateExitRequired: false, campaignAcknowledgementRequired: false } });
    renderPanel();
    expect(await screen.findByText(t.verdict.none)).toBeInTheDocument();
    expect(screen.queryByText(t.verdict.marketingNone)).not.toBeInTheDocument();
    expect(screen.queryByText(t.verdict.sendsNeedAck)).not.toBeInTheDocument();
  });

  it("says when the exit could not be checked and checks again on retry", async () => {
    actions.getTemplateExitVerdictAction.mockResolvedValueOnce({ error: "down", status: 503 }).mockResolvedValue({ data: NONE });
    renderPanel();
    expect(await screen.findByText(t.verdict.failed)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.verdict.retry }));
    expect(await screen.findByText(t.verdict.marketingNone)).toBeInTheDocument();
    expect(screen.queryByText(t.verdict.failed)).not.toBeInTheDocument();
  });

  it("offers only the action kinds the server allows this viewer", async () => {
    renderPanel();
    fireEvent.click((await screen.findAllByRole("combobox", { name: t.action.label }))[0]);
    const names = (await screen.findAllByRole("option")).map((option) => option.textContent);
    expect(names).toEqual([t.kinds.none, t.kinds.opt_out, t.kinds.hand_off, t.kinds.start_workflow]);
  });

  it("offers no exit word of its own: the verdict comes only from what the lead sees", async () => {
    renderPanel();
    expect(await screen.findByText(t.verdict.noneDescription)).toBeInTheDocument();
    expect(await screen.findByText("Não quero")).toBeInTheDocument();
    expect(screen.queryByLabelText(t.choice.wordLabel)).not.toBeInTheDocument();
    expect(screen.queryByText(t.verdict.shownWords.replace("{words}", "/sair"))).not.toBeInTheDocument();
    expect(screen.queryByLabelText(t.confirmation.label)).not.toBeInTheDocument();
  });

  it("shows the words the template text shows and its exit confirmation", async () => {
    actions.getTemplateButtonActionsAction.mockResolvedValue({ data: { ...STORED, exitConfirmation: "Pronto." } });
    actions.getTemplateExitVerdictAction.mockResolvedValue({ data: SHOWN_WORD });
    renderPanel();
    expect(await screen.findByText(t.verdict.shownWords.replace("{words}", "/sair"))).toBeInTheDocument();
    expect(await screen.findByLabelText(t.confirmation.label)).toHaveValue("Pronto.");
  });

  it("saves the actions and the exit confirmation from the version it showed, without resubmitting to Meta", async () => {
    actions.saveTemplateButtonActionsAction.mockResolvedValue({ status: "saved", actions: { ...STORED, version: 5 } });
    renderPanel();
    expect(await screen.findByText("Não quero")).toBeInTheDocument();
    expect(screen.getByText(t.panel.description)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("combobox", { name: t.action.label })[1]);
    fireEvent.click(await screen.findByRole("option", { name: t.kinds.opt_out }));
    fireEvent.change(screen.getByLabelText(t.confirmation.label), { target: { value: "Pronto." } });
    fireEvent.click(screen.getByRole("button", { name: t.panel.save }));

    await waitFor(() =>
      expect(actions.saveTemplateButtonActionsAction).toHaveBeenCalledWith("tpl-1", 4, {
        actions: [{ buttonIndex: 1, buttonText: "Não quero", kind: "opt_out", params: {}, confirmation: "" }],
        exitConfirmation: "Pronto.",
      }),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(t.panel.saved));
  });

  it("keeps a stale action on its saved text until the person confirms it for the current text", async () => {
    const staleOptOut = { buttonIndex: 1, buttonText: "SAIR", kind: "opt_out" as const, params: {}, confirmation: "", stale: true, version: 4 };
    const staleStored = { ...STORED, buttons: [STORED.buttons[0], { index: 1, text: "Parar", action: null, stale: true }], actions: [staleOptOut] };
    actions.getTemplateButtonActionsAction.mockResolvedValue({ data: staleStored });
    actions.saveTemplateButtonActionsAction.mockResolvedValue({ status: "saved", actions: { ...staleStored, version: 5 } });
    renderPanel();

    expect(await screen.findByText(t.action.savedFor.replace("{text}", "SAIR"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.panel.save }));
    await waitFor(() =>
      expect(actions.saveTemplateButtonActionsAction).toHaveBeenLastCalledWith("tpl-1", 4, expect.objectContaining({
        actions: [{ buttonIndex: 1, buttonText: "SAIR", kind: "opt_out", params: {}, confirmation: "" }],
      })),
    );

    fireEvent.click(await screen.findByRole("button", { name: t.action.reconfirm }));
    expect(screen.getByText(t.action.reconfirmed.replace("{text}", "Parar"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.panel.save }));
    await waitFor(() =>
      expect(actions.saveTemplateButtonActionsAction).toHaveBeenLastCalledWith("tpl-1", 5, expect.objectContaining({
        actions: [{ buttonIndex: 1, buttonText: "Parar", kind: "opt_out", params: {}, confirmation: "" }],
      })),
    );
  });

  it("explains that a button changed while the screen was open", async () => {
    actions.saveTemplateButtonActionsAction.mockResolvedValue({ status: "failed", error: { error: "stale", code: "button_action_stale", status: 422 } });
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: t.panel.save }));
    expect(await screen.findByText(t.errors.button_action_stale)).toBeInTheDocument();
  });

  it("explains an exit confirmation the server refuses for its length", async () => {
    actions.saveTemplateButtonActionsAction.mockResolvedValue({ status: "failed", error: { error: "no", code: "exit_confirmation_too_long", status: 400 } });
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: t.panel.save }));
    expect(await screen.findByText(t.errors.exit_confirmation_too_long)).toBeInTheDocument();
  });

  it("explains a coded refusal", async () => {
    actions.saveTemplateButtonActionsAction.mockResolvedValue({ status: "failed", error: { error: "no", code: "button_action_forbidden", status: 403 } });
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: t.panel.save }));
    expect(await screen.findByText(t.errors.button_action_forbidden)).toBeInTheDocument();
  });

  it("shows the newer version when someone saved first and saves from it", async () => {
    actions.saveTemplateButtonActionsAction
      .mockResolvedValueOnce({ status: "conflict", current: { ...STORED, version: 6 } })
      .mockResolvedValue({ status: "saved", actions: { ...STORED, version: 7 } });
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: t.panel.save }));
    expect(await screen.findByText(t.panel.conflict)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.panel.save }));
    await waitFor(() => expect(actions.saveTemplateButtonActionsAction).toHaveBeenLastCalledWith("tpl-1", 6, expect.any(Object)));
  });

  it("lets a viewer without template rights only read", async () => {
    renderPanel(false);
    expect(await screen.findByText(t.panel.readOnly)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.panel.save })).not.toBeInTheDocument();
  });
});
