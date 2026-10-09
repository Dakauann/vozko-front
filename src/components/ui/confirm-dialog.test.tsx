import type { ReactElement } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import enMessages from "@/i18n/messages/en.json";

import { ConfirmDialog } from "./confirm-dialog";

function renderInPt(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("ConfirmDialog", () => {
  it("opens from its trigger and shows the title and description", async () => {
    renderInPt(
      <ConfirmDialog
        trigger={<button type="button">Excluir workflow</button>}
        title="Excluir workflow"
        description="Esta ação não pode ser desfeita."
        onConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("Excluir workflow"));
    expect(
      await screen.findByText("Esta ação não pode ser desfeita."),
    ).toBeInTheDocument();
  });

  it("runs onConfirm and closes when confirmed", async () => {
    const onConfirm = vi.fn();
    renderInPt(
      <ConfirmDialog
        trigger={<button type="button">open</button>}
        title="Excluir workflow"
        confirmLabel="Excluir"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByText("open"));
    const confirm = await screen.findByRole("button", { name: "Excluir" });
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByText("Excluir workflow")).not.toBeInTheDocument(),
    );
  });

  it("does not run onConfirm when cancelled", async () => {
    const onConfirm = vi.fn();
    renderInPt(
      <ConfirmDialog
        trigger={<button type="button">open</button>}
        title="Título"
        cancelLabel="Cancelar"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByText("open"));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("uses the default danger confirm label when none is given", async () => {
    renderInPt(
      <ConfirmDialog
        trigger={<button type="button">open</button>}
        title="Título"
        onConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("open"));
    expect(
      await screen.findByRole("button", { name: "Excluir" }),
    ).toBeInTheDocument();
  });

  it("takes its default labels from the viewer's locale", () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ConfirmDialog open title="Remove" onConfirm={() => {}} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    unmount();

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ConfirmDialog open tone="default" title="Apply" onConfirm={() => {}} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it.each([
    ["danger", "tile-fault"],
    ["default", "tile-info"],
  ] as const)(
    "marks the %s tone with a glyph tile, never grain or a gradient",
    (tone, tileClass) => {
      renderInPt(
        <ConfirmDialog open tone={tone} title="Título" onConfirm={() => {}} />,
      );
      const dialog = screen.getByRole("alertdialog");
      expect(dialog.querySelector(`.${tileClass}`)).not.toBeNull();
      expect(dialog.querySelector("canvas")).toBeNull();
      expect(dialog.querySelector("filter")).toBeNull();
      expect(dialog.querySelector("[class*='gradient']")).toBeNull();
      expect(dialog.querySelector("[class*='shadow-lg']")).toBeNull();
    },
  );
});
