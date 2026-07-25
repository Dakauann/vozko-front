/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog", () => {
  it("opens from its trigger and shows the title and description", async () => {
    render(
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
    render(
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
    render(
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
    render(
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
});
