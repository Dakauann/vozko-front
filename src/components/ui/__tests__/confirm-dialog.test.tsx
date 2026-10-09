import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { fireEvent, render as renderBare, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";

import { ConfirmDialog } from "../confirm-dialog";

function render(ui: ReactElement) {
  return renderBare(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function renderDialog(onConfirm: () => boolean | void | Promise<boolean | void>) {
  const onOpenChange = vi.fn();
  render(
    <ConfirmDialog open onOpenChange={onOpenChange} title="Aplicar?" confirmLabel="Aplicar" onConfirm={onConfirm} />,
  );
  return onOpenChange;
}

describe("ConfirmDialog", () => {
  it("closes once the confirmation is done", async () => {
    const onOpenChange = renderDialog(async () => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("stays open when the confirmation answers false", async () => {
    const onConfirm = vi.fn(async () => false);
    const onOpenChange = renderDialog(onConfirm);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "Aplicar" })).not.toBeDisabled());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("shows its own controls between the description and the buttons", () => {
    render(
      <ConfirmDialog open title="Aplicar?" description="Explica" confirmLabel="Aplicar" confirmDisabled onConfirm={() => undefined}>
        <fieldset aria-label="Origem">
          <input type="radio" aria-label="Pedido do lead" />
        </fieldset>
      </ConfirmDialog>,
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toContainElement(screen.getByRole("group", { name: "Origem" }));
    expect(screen.getByRole("button", { name: "Aplicar" })).toBeDisabled();
  });
});
