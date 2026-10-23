import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { WhatsAppTemplate } from "@/lib/whatsapp-templates/types";

const editWhatsAppTemplateContentAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/whatsapp-templates", () => ({
  editWhatsAppTemplateContentAction,
  uploadTemplateHeaderMediaAction: vi.fn(),
}));
const exitActions = vi.hoisted(() => ({ getDraftExitVerdictAction: vi.fn(), getTemplateButtonActionsAction: vi.fn() }));
vi.mock("@/app/actions/template-exit", () => exitActions);
const audienceActions = vi.hoisted(() => ({ getTemplateSuggestionsAction: vi.fn(), saveTemplateSuggestionsAction: vi.fn(), listTemplateFieldsAction: vi.fn() }));
vi.mock("@/app/actions/campaign-audience", () => audienceActions);
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, can: () => true }) }));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { TemplateContentEditSheet } from "../TemplateContentEditSheet";

const tpl = ptMessages.whatsappTemplates;
const edit = tpl.contentEdit;
const exit = ptMessages.templateExit;

const BODY = "Olá {{1}}, temos novidades para você.";

function template(overrides: Partial<WhatsAppTemplate> = {}): WhatsAppTemplate {
  return {
    id: "tpl-1",
    externalId: "meta-1",
    name: "promo_outubro",
    language: "pt_BR",
    category: "MARKETING",
    status: "APPROVED",
    components: [
      { type: "HEADER", format: "IMAGE", example: { header_handle: ["https://meta/h"] } },
      { type: "BODY", text: BODY, example: { body_text: [["Maria"]] } },
      { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Parar" }] },
    ],
    headerMediaUrl: "https://files.test/banner.jpg",
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T10:00:00Z",
    ...overrides,
  };
}

const VERDICT_OK = { state: "ok", buttons: [], exitWords: [], templateExitRequired: true, campaignAcknowledgementRequired: true };
const VERDICT_NONE = { ...VERDICT_OK, state: "none" };

const storedActions = {
  templateId: "tpl-1",
  template: { name: "promo_outubro", language: "pt_BR" },
  version: 3,
  buttons: [],
  actions: [{ buttonIndex: 0, buttonText: "Parar", kind: "opt_out", params: {}, confirmation: "", stale: false, version: 3 }],
  exitConfirmation: "",
  allowedKinds: ["opt_out"],
};

const onSaved = vi.fn();
const onOpenChange = vi.fn();

function renderSheet(subject: WhatsAppTemplate = template()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
        <TemplateContentEditSheet template={subject} open onOpenChange={onOpenChange} onSaved={onSaved} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function saveButton() {
  return screen.findByRole("button", { name: edit.save });
}

async function verdictSettled() {
  await waitFor(() => expect(exitActions.getDraftExitVerdictAction).toHaveBeenCalled(), { timeout: 3000 });
}

beforeEach(() => {
  editWhatsAppTemplateContentAction.mockReset();
  exitActions.getDraftExitVerdictAction.mockReset().mockResolvedValue({ data: { verdict: VERDICT_OK, allowedKinds: ["opt_out"] } });
  exitActions.getTemplateButtonActionsAction.mockReset().mockResolvedValue({ data: storedActions });
  audienceActions.getTemplateSuggestionsAction.mockReset().mockResolvedValue({ data: { templateId: "tpl-1", suggestions: [] }, error: null });
  audienceActions.saveTemplateSuggestionsAction.mockReset().mockResolvedValue({ data: { templateId: "tpl-1", suggestions: [] }, error: null });
  audienceActions.listTemplateFieldsAction.mockReset().mockResolvedValue({ data: [], error: null });
  onSaved.mockReset();
  onOpenChange.mockReset();
  toast.mockReset();
});

describe("TemplateContentEditSheet suggested fields", () => {
  it("loads the saved suggestion into the body and saves it again after the edit", async () => {
    audienceActions.getTemplateSuggestionsAction.mockResolvedValue({ data: { templateId: "tpl-1", suggestions: [{ slot: 1, source: "lead.first_name" }] }, error: null });
    editWhatsAppTemplateContentAction.mockResolvedValueOnce({ template: template(), error: null });
    renderSheet();
    fireEvent.click(await screen.findByRole("button", { name: tpl.componentType.BODY, expanded: false }));
    expect(await screen.findByText(ptMessages.leadSends.bindings.sources.firstName)).toBeInTheDocument();
    fireEvent.click(await saveButton());
    await waitFor(() => expect(audienceActions.saveTemplateSuggestionsAction).toHaveBeenCalledWith("tpl-1", [{ slot: 1, source: "lead.first_name" }]));
    expect(JSON.stringify(editWhatsAppTemplateContentAction.mock.calls[0][1])).not.toContain("lead.first_name");
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("clears the suggestions when the body has none left", async () => {
    editWhatsAppTemplateContentAction.mockResolvedValueOnce({ template: template(), error: null });
    renderSheet();
    fireEvent.click(await saveButton());
    await waitFor(() => expect(audienceActions.saveTemplateSuggestionsAction).toHaveBeenCalledWith("tpl-1", []));
  });

  it("keeps the saved template and says when the suggestions could not be saved", async () => {
    audienceActions.saveTemplateSuggestionsAction.mockResolvedValue({ data: null, error: { message: "x", code: "template_suggestion_duplicate", status: 400 } });
    editWhatsAppTemplateContentAction.mockResolvedValueOnce({ template: template(), error: null });
    renderSheet();
    fireEvent.click(await saveButton());
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith(tpl.form.editor.body.suggestionsSaveFailed, { description: ptMessages.campaignAudience.errors.template_suggestion_duplicate });
  });

  it("does not open the editor when the suggestions cannot be read", async () => {
    audienceActions.getTemplateSuggestionsAction.mockResolvedValue({ data: null, error: { message: "x", code: "template_not_found", status: 404 } });
    renderSheet();
    expect(await screen.findByText(ptMessages.campaignAudience.errors.template_not_found)).toBeInTheDocument();
    expect(screen.queryByText(edit.fixedHint)).not.toBeInTheDocument();
  });
});

describe("TemplateContentEditSheet", () => {
  it("prefills the builder, keeps name and language read-only and locks the category of an approved template", async () => {
    renderSheet();
    await screen.findByText(edit.fixedHint);
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("promo_outubro")).toBeInTheDocument();
    expect(within(sheet).getByText("pt_BR")).toBeInTheDocument();
    expect(within(sheet).getByText(edit.fixedHint)).toBeInTheDocument();
    expect(within(sheet).getByText(edit.categoryLocked)).toBeInTheDocument();
    expect(within(sheet).queryByRole("combobox", { name: tpl.form.labels.category })).not.toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: tpl.componentType.BODY, expanded: false })).toBeInTheDocument();
    expect(within(sheet).getAllByText(/Olá Maria, temos novidades/).length).toBeGreaterThan(0);
  });

  it("lets a rejected template change its category", async () => {
    renderSheet(template({ status: "REJECTED" }));
    expect(await screen.findByRole("combobox", { name: tpl.form.labels.category })).toBeInTheDocument();
    expect(screen.queryByText(edit.categoryLocked)).not.toBeInTheDocument();
    expect(screen.queryByText(edit.notice.window)).not.toBeInTheDocument();
  });

  it("says before saving that the template goes back to review, the approved edit window and the campaign pause", async () => {
    renderSheet();
    expect(await screen.findByText(edit.notice.review)).toBeInTheDocument();
    expect(screen.getByText(edit.notice.window)).toBeInTheDocument();
    expect(screen.getByText(edit.notice.campaigns)).toBeInTheDocument();
  });

  it("sends the full content with the saved exit setup and keeps the current header media unless it was replaced", async () => {
    editWhatsAppTemplateContentAction.mockResolvedValueOnce({ template: { ...template(), status: "PENDING" }, error: null });
    renderSheet();
    await verdictSettled();
    fireEvent.click(await saveButton());

    await waitFor(() => expect(editWhatsAppTemplateContentAction).toHaveBeenCalledTimes(1));
    const [id, payload] = editWhatsAppTemplateContentAction.mock.calls[0];
    expect(id).toBe("tpl-1");
    expect(payload).not.toHaveProperty("headerMediaUrl");
    expect(payload).not.toHaveProperty("category");
    expect(payload).not.toHaveProperty("exitConfirmation");
    expect(payload.buttonActions).toEqual([{ buttonIndex: 0, buttonText: "Parar", kind: "opt_out", params: {}, confirmation: "" }]);
    expect(payload.components).toEqual([
      { type: "HEADER", format: "IMAGE", example: { header_handle: ["https://files.test/banner.jpg"] } },
      { type: "BODY", text: BODY, example: { body_text: [["Maria"]] } },
      { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Parar" }] },
    ]);
  });

  it("sends the new header media once the user replaced it", async () => {
    editWhatsAppTemplateContentAction.mockResolvedValueOnce({ template: template(), error: null });
    renderSheet();
    fireEvent.click(await screen.findByRole("button", { name: tpl.componentType.HEADER, expanded: false }));
    fireEvent.change(screen.getByDisplayValue("https://files.test/banner.jpg"), { target: { value: "https://files.test/new.jpg" } });
    fireEvent.click(await saveButton());

    await waitFor(() => expect(editWhatsAppTemplateContentAction).toHaveBeenCalledTimes(1));
    expect(editWhatsAppTemplateContentAction.mock.calls[0][1]).toMatchObject({ headerMediaUrl: "https://files.test/new.jpg" });
  });

  it("judges the exit with the saved actions on the draft", async () => {
    renderSheet();
    await waitFor(
      () =>
        expect(exitActions.getDraftExitVerdictAction).toHaveBeenCalledWith(
          expect.objectContaining({
            buttons: [{ type: "QUICK_REPLY", text: "Parar" }],
            buttonActions: [{ buttonIndex: 0, buttonText: "Parar", kind: "opt_out", params: {}, confirmation: "" }],
          }),
        ),
      { timeout: 3000 },
    );
  });

  it("hands back Meta's read-back and closes", async () => {
    const saved = { ...template(), status: "PENDING" as const };
    editWhatsAppTemplateContentAction.mockResolvedValueOnce({ template: saved, error: null });
    renderSheet();
    fireEvent.click(await saveButton());
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(toast).toHaveBeenCalledWith(edit.saved, { description: edit.savedDesc });
  });

  it("says when Meta allows the next edit", async () => {
    editWhatsAppTemplateContentAction.mockResolvedValueOnce({
      template: null,
      error: "window",
      errorCode: "template_edit_window",
      expected: { nextEditAt: "2026-10-18T09:30:00Z" },
    });
    renderSheet();
    fireEvent.click(await saveButton());
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(edit.saveError)).toBeInTheDocument();
    expect(within(alert).getByText(new RegExp(`^${edit.windowUntil.replace("{when}", ".*18.*")}$`))).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("localizes the other refusals", async () => {
    editWhatsAppTemplateContentAction.mockResolvedValueOnce({ template: null, error: "busy", errorCode: "template_in_use" });
    renderSheet();
    fireEvent.click(await saveButton());
    expect(await screen.findByText(tpl.errors.template_in_use)).toBeInTheDocument();
  });

  it("asks for a shown exit before sending a marketing draft the server says has none", async () => {
    exitActions.getDraftExitVerdictAction.mockResolvedValue({ data: { verdict: VERDICT_NONE, allowedKinds: ["opt_out"] } });
    renderSheet();
    expect(await screen.findByText(exit.verdict.editNeedsExit, {}, { timeout: 3000 })).toBeInTheDocument();
    fireEvent.click(await saveButton());

    await screen.findByRole("dialog", { name: exit.editDialog.title });
    expect(editWhatsAppTemplateContentAction).not.toHaveBeenCalled();
  });

  it("saves a new exit button with its action", async () => {
    exitActions.getDraftExitVerdictAction.mockResolvedValue({ data: { verdict: VERDICT_NONE, allowedKinds: ["opt_out"] } });
    editWhatsAppTemplateContentAction.mockResolvedValueOnce({ template: template(), error: null });
    renderSheet(template({ components: [{ type: "BODY", text: "Temos novidades para você." }], headerMediaUrl: null }));
    expect(await screen.findByText(exit.verdict.editNeedsExit, {}, { timeout: 3000 })).toBeInTheDocument();
    fireEvent.click(await saveButton());

    const dialog = await screen.findByRole("dialog", { name: exit.editDialog.title });
    fireEvent.click(within(dialog).getByRole("radio", { name: new RegExp(exit.choice.button) }));
    fireEvent.change(within(dialog).getByLabelText(exit.choice.buttonText), { target: { value: "Não quero" } });
    fireEvent.click(within(dialog).getByRole("combobox", { name: exit.action.label }));
    fireEvent.click(await screen.findByRole("option", { name: exit.kinds.opt_out }));
    fireEvent.click(within(dialog).getByRole("button", { name: exit.editDialog.applyAndSave }));

    await waitFor(() => expect(editWhatsAppTemplateContentAction).toHaveBeenCalledTimes(1));
    const payload = editWhatsAppTemplateContentAction.mock.calls[0][1];
    expect(payload.components).toContainEqual({ type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Não quero" }] });
    expect(payload.buttonActions).toEqual([{ buttonIndex: 0, buttonText: "Não quero", kind: "opt_out", params: {}, confirmation: "" }]);
  });

  it("opens the buttons and shows a tracking refusal on the link it names", async () => {
    editWhatsAppTemplateContentAction.mockResolvedValueOnce({
      template: null,
      error: "blocked",
      errorCode: "template_tracked_button_destination",
      expected: { buttonIndex: "1" },
    });
    renderSheet(
      template({
        components: [
          { type: "BODY", text: BODY, example: { body_text: [["Maria"]] } },
          { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Parar" }, { type: "URL", text: "Loja", url: "http://10.0.0.1/loja" }] },
        ],
        headerMediaUrl: null,
      }),
    );
    fireEvent.click(await saveButton());
    const link = await screen.findByDisplayValue("http://10.0.0.1/loja");
    expect(link).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(tpl.errors.template_tracked_button_destination)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("shows a refused button action the way create does", async () => {
    editWhatsAppTemplateContentAction.mockResolvedValueOnce({ template: null, error: "stale", errorCode: "button_action_stale" });
    renderSheet();
    fireEvent.click(await saveButton());
    expect(await screen.findByText(exit.errors.button_action_stale)).toBeInTheDocument();
  });

  it("opens no builder until the saved exit setup is read, and offers to read it again", async () => {
    exitActions.getTemplateButtonActionsAction.mockResolvedValueOnce({ error: "boom", status: 500 }).mockResolvedValueOnce({ data: storedActions });
    renderSheet();
    expect(await screen.findByText(exit.panel.loadFailed)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: edit.save })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: exit.verdict.retry }));
    expect(await saveButton()).toBeInTheDocument();
  });

  it("surfaces the server's exit refusal the same way and saves with the word", async () => {
    editWhatsAppTemplateContentAction
      .mockResolvedValueOnce({ template: null, error: "no exit", errorCode: "marketing_template_needs_exit" })
      .mockResolvedValueOnce({ template: template(), error: null });
    renderSheet();
    fireEvent.click(await saveButton());

    const dialog = await screen.findByRole("dialog", { name: exit.editDialog.title });
    fireEvent.click(within(dialog).getByRole("radio", { name: new RegExp(exit.choice.word) }));
    fireEvent.change(within(dialog).getByLabelText(exit.choice.wordLabel), { target: { value: "parar" } });
    fireEvent.click(within(dialog).getByRole("button", { name: exit.editDialog.applyAndSave }));

    await waitFor(() => expect(editWhatsAppTemplateContentAction).toHaveBeenCalledTimes(2));
    expect(editWhatsAppTemplateContentAction.mock.calls[1][1].components).toContainEqual({
      type: "FOOTER",
      text: exit.choice.footerSentence.replace("{command}", "/parar"),
    });
  });

  it("refuses an invalid draft before calling Meta", async () => {
    renderSheet(template({ components: [{ type: "BODY", text: "{{1}} começa com variável" }] }));
    fireEvent.click(await saveButton());
    expect(await screen.findAllByText(tpl.form.validation.noVariableAtStart)).not.toHaveLength(0);
    expect(editWhatsAppTemplateContentAction).not.toHaveBeenCalled();
  });
});
