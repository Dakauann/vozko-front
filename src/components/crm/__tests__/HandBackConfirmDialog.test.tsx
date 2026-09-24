import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import pt from "@/i18n/messages/pt.json";
import { HandBackConfirmDialog } from "../HandBackConfirmDialog";

function renderDialog(canViewOthers: boolean, onConfirm = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <HandBackConfirmDialog
        open
        onOpenChange={() => {}}
        target={{ kind: "ai", name: "Sofia" }}
        canViewOthers={canViewOthers}
        onConfirm={onConfirm}
      />
    </NextIntlClientProvider>,
  );
  return onConfirm;
}

describe("HandBackConfirmDialog", () => {
  it("names who takes the conversation back", () => {
    renderDialog(false);
    expect(screen.getByText(/Devolver para Sofia/)).toBeTruthy();
  });

  it("warns an operator that the conversation leaves their list", () => {
    renderDialog(false);
    expect(screen.getByText(/sai da sua lista/)).toBeTruthy();
  });

  it("tells someone who sees others' conversations that it stays visible", () => {
    renderDialog(true);
    expect(screen.getByText(/continua visível para você/)).toBeTruthy();
  });

  it("hands back only on confirm", () => {
    const onConfirm = renderDialog(false);
    fireEvent.click(screen.getByRole("button", { name: "Devolver" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
