import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { TemplateDraftPurpose } from "@/lib/whatsapp-templates/draft";

import { MarketingExitDialog } from "../MarketingExitDialog";

const t = ptMessages.templateExit;
const onApplyPlan = vi.fn();
const onOpenChange = vi.fn();

function renderDialog(footerText = "", purpose: TemplateDraftPurpose = "create") {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <MarketingExitDialog
        open
        onOpenChange={onOpenChange}
        templateName="promo_outubro"
        room={{ button: true }}
        allowedKinds={["opt_out"]}
        footerText={footerText}
        busy={false}
        purpose={purpose}
        onApplyPlan={onApplyPlan}
      />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  onApplyPlan.mockReset();
  onOpenChange.mockReset();
});

describe("MarketingExitDialog", () => {
  it("names the template and offers no way to create without an exit", () => {
    renderDialog();
    expect(screen.getByText(t.createDialog.description.replace("{name}", "promo_outubro"))).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: new RegExp(t.choice.button) })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: new RegExp(t.choice.word) })).not.toBeChecked();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("button", { name: t.createDialog.applyAndCreate })).toBeDisabled();
  });

  it("offers only the exit kinds the server allows this viewer", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(t.choice.button) }));
    fireEvent.click(screen.getByRole("combobox", { name: t.action.label }));
    const names = (await screen.findAllByRole("option")).map((option) => option.textContent);
    expect(names).toEqual([t.kinds.opt_out]);
  });

  it("writes the ready-made footer with the command and creates with it", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(t.choice.word) }));
    fireEvent.change(screen.getByLabelText(t.choice.wordLabel), { target: { value: "parar" } });
    const footer = t.choice.footerSentence.replace("{command}", "/parar");
    expect(screen.getByLabelText(t.choice.footerText)).toHaveValue(footer);
    fireEvent.click(screen.getByRole("button", { name: t.createDialog.applyAndCreate }));
    expect(onApplyPlan).toHaveBeenCalledWith({ mode: "word", word: "parar", footerText: footer, confirmation: "" });
  });

  it("asks for the command in a footer the user already wrote", () => {
    renderDialog("Equipe Clínica");
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(t.choice.word) }));
    fireEvent.change(screen.getByLabelText(t.choice.wordLabel), { target: { value: "sair" } });
    expect(screen.getByText(t.choice.footerNeedsCommand.replace("{command}", "/sair"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.createDialog.applyAndCreate })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(t.choice.footerText), { target: { value: "Equipe Clínica. Envie /sair" } });
    expect(screen.getByRole("button", { name: t.createDialog.applyAndCreate })).toBeEnabled();
  });

  it("goes back to the builder", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: t.createDialog.back }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onApplyPlan).not.toHaveBeenCalled();
  });
});

describe("MarketingExitDialog in a content edit", () => {
  it("says the edit is saved with the exit and applies the word", () => {
    renderDialog("", "edit");
    expect(screen.getByText(t.editDialog.description.replace("{name}", "promo_outubro"))).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: new RegExp(t.choice.button) })).toBeEnabled();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(t.choice.word) }));
    fireEvent.change(screen.getByLabelText(t.choice.wordLabel), { target: { value: "parar" } });
    fireEvent.click(screen.getByRole("button", { name: t.editDialog.applyAndSave }));
    expect(onApplyPlan).toHaveBeenCalledWith({ mode: "word", word: "parar", footerText: t.choice.footerSentence.replace("{command}", "/parar"), confirmation: "" });
  });

  it("goes back to the builder", () => {
    renderDialog("", "edit");
    fireEvent.click(screen.getByRole("button", { name: t.editDialog.back }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
