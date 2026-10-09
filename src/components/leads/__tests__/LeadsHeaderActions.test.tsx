import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { LeadsHeaderActions, type LeadsHeaderActionsProps } from "../LeadsHeaderActions";

function renderActions(props: Partial<LeadsHeaderActionsProps> = {}) {
  const handlers = {
    onViewChange: vi.fn(),
    onCreate: vi.fn(),
    onImport: vi.fn(),
    onDownloadTemplate: vi.fn(),
    onManageFields: vi.fn(),
  };
  const view = render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <LeadsHeaderActions view="map" showViewToggle canCreate canManageFields imports={<span>importações</span>} {...handlers} {...props} />
    </NextIntlClientProvider>,
  );
  return { ...handlers, ...view };
}

function openMenu() {
  fireEvent.keyDown(screen.getByRole("button", { name: "Mais ações" }), { key: "Enter" });
}

describe("LeadsHeaderActions", () => {
  it("keeps the primary action in view and the rest behind one compact menu", () => {
    renderActions();
    expect(screen.getByRole("button", { name: "Novo lead" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Importar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Baixar modelo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Campos" })).toBeNull();
    expect(screen.getByText("importações")).toBeInTheDocument();
  });

  it("opens the menu from the keyboard and runs each action", async () => {
    const { onImport, onDownloadTemplate, onManageFields } = renderActions();
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Importar" }));
    expect(onImport).toHaveBeenCalledTimes(1);
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Baixar modelo" }));
    expect(onDownloadTemplate).toHaveBeenCalledTimes(1);
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Campos" }));
    expect(onManageFields).toHaveBeenCalledTimes(1);
  });

  it("creates a lead from the primary action", () => {
    const { onCreate } = renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Novo lead" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("offers only the fields to someone who may configure but not create", async () => {
    renderActions({ canCreate: false });
    expect(screen.queryByRole("button", { name: "Novo lead" })).toBeNull();
    expect(screen.queryByText("importações")).toBeNull();
    openMenu();
    expect(await screen.findByRole("menuitem", { name: "Campos" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Importar" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Baixar modelo" })).toBeNull();
  });

  it("offers no fields to someone who may create but not configure", async () => {
    renderActions({ canManageFields: false });
    openMenu();
    expect(await screen.findByRole("menuitem", { name: "Importar" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Campos" })).toBeNull();
  });

  it("has no menu when there is nothing to put in it", () => {
    renderActions({ canCreate: false, canManageFields: false });
    expect(screen.queryByRole("button", { name: "Mais ações" })).toBeNull();
  });

  it("switches between table and map from the header", () => {
    const { onViewChange } = renderActions();
    const toggle = screen.getByRole("group", { name: "Ver como" });
    expect(toggle).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tabela" }));
    expect(onViewChange).toHaveBeenCalledWith("table");
  });

  it("hides the view toggle from someone who may not see the map", () => {
    renderActions({ showViewToggle: false, view: "table" });
    expect(screen.queryByRole("group", { name: "Ver como" })).toBeNull();
  });
});
