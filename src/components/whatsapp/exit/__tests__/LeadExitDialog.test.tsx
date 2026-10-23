import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

vi.mock("../use-action-param-options", () => ({
  TEAM_PREFIX: "team:",
  MEMBER_PREFIX: "user:",
  useHandOffOptions: () => ({ options: [], loading: false, failed: false }),
  useWorkflowOptions: () => ({ options: [], loading: false, failed: false }),
  useCallListOptions: () => ({ options: [], loading: false, failed: false }),
  useDealPipelineOptions: () => ({ options: [], loading: false, failed: false }),
  useDealStageOptions: () => ({ options: [], loading: false, failed: false }),
  useLeadSelectFields: () => ({ fields: [], loading: false, failed: false }),
}));

import { BUTTON_ACTION_KINDS } from "@/lib/whatsapp-templates/exit";

import { LeadExitDialog } from "../LeadExitDialog";

const t = ptMessages.templateExit;
const onApply = vi.fn();

function renderDialog(room = { button: true }, footerText = "", allowedKinds: readonly string[] = BUTTON_ACTION_KINDS) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <LeadExitDialog open room={room} footerText={footerText} allowedKinds={allowedKinds} onOpenChange={() => undefined} onApply={onApply} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => onApply.mockReset());

describe("LeadExitDialog", () => {
  it("prefills nothing and waits for the user's choice", () => {
    renderDialog();
    expect(screen.getByRole("radio", { name: new RegExp(t.choice.button) })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: new RegExp(t.choice.word) })).not.toBeChecked();
    expect(screen.getByRole("button", { name: t.choice.apply })).toBeDisabled();
  });

  it("adds a quick reply with the text and exit action the user chose", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(t.choice.button) }));
    fireEvent.change(screen.getByLabelText(t.choice.buttonText), { target: { value: "Não quero" } });
    fireEvent.click(screen.getByRole("combobox", { name: t.action.label }));
    fireEvent.click(await screen.findByRole("option", { name: t.kinds.opt_out }));
    fireEvent.click(screen.getByRole("button", { name: t.choice.apply }));
    expect(onApply).toHaveBeenCalledWith({ mode: "button", text: "Não quero", action: { kind: "opt_out", params: {}, confirmation: "" } });
  });

  it("offers only exit kinds for the exit button", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(t.choice.button) }));
    fireEvent.click(screen.getByRole("combobox", { name: t.action.label }));
    const names = (await screen.findAllByRole("option")).map((option) => option.textContent);
    expect(names).toEqual([t.kinds.opt_out, t.kinds.consent_grant]);
  });

  it("offers only the exit kinds the server allows this viewer", async () => {
    renderDialog(undefined, "", ["hand_off", "consent_grant"]);
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(t.choice.button) }));
    fireEvent.click(screen.getByRole("combobox", { name: t.action.label }));
    const names = (await screen.findAllByRole("option")).map((option) => option.textContent);
    expect(names).toEqual([t.kinds.consent_grant]);
  });

  it("offers no exit kind while the allowed kinds are unknown", () => {
    renderDialog(undefined, "", []);
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(t.choice.button) }));
    fireEvent.click(screen.getByRole("combobox", { name: t.action.label }));
    expect(screen.queryAllByRole("option")).toEqual([]);
  });

  it("writes the footer the user typed once it shows the command", () => {
    renderDialog(undefined, "Texto atual");
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(t.choice.word) }));
    expect(screen.getByLabelText(t.choice.footerText)).toHaveValue("Texto atual");
    fireEvent.change(screen.getByLabelText(t.choice.wordLabel), { target: { value: "parar" } });
    fireEvent.change(screen.getByLabelText(t.choice.footerText), { target: { value: "Responda parar para sair" } });
    expect(screen.getByRole("button", { name: t.choice.apply })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(t.choice.footerText), { target: { value: "Responda /parar para sair" } });
    fireEvent.change(screen.getByLabelText(t.confirmation.label), { target: { value: "Pronto." } });
    fireEvent.click(screen.getByRole("button", { name: t.choice.apply }));
    expect(onApply).toHaveBeenCalledWith({ mode: "word", word: "parar", footerText: "Responda /parar para sair", confirmation: "Pronto." });
  });

  it("shows the fixed slash in front of the exit word", () => {
    renderDialog(undefined, "");
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(t.choice.word) }));
    const input = screen.getByLabelText(t.choice.wordLabel);
    expect(within(input.parentElement as HTMLElement).getByText("/")).toBeInTheDocument();
  });

  it("does not offer a new button when the template has no room for it", () => {
    renderDialog({ button: false });
    expect(screen.getByRole("radio", { name: new RegExp(t.choice.button) })).toBeDisabled();
    expect(screen.getByText(t.choice.buttonFull)).toBeInTheDocument();
  });

  it("tells what an opt-out means when the exit is a word", () => {
    renderDialog();
    expect(screen.queryByText(t.optOutNotice.title)).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(t.choice.word) }));
    expect(screen.getByText(t.optOutNotice.title)).toBeInTheDocument();
  });
});
