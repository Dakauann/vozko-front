import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";

import { MapEmptyState } from "../MapEmptyState";
import { MapFilterEmpty } from "../MapFilterEmpty";
import { renderInPortuguese } from "./intl";

const summary = {
  total: 46760,
  onMap: 0,
  approximate: 0,
  withoutAddress: 46100,
  notFound: 12,
  pending: 648,
};

describe("MapEmptyState", () => {
  it("shows the counts instead of a blank map", () => {
    renderInPortuguese(<MapEmptyState summary={summary} />);
    expect(screen.getByRole("heading", { name: "Nenhum lead no mapa ainda" })).toBeInTheDocument();
    const counts = screen.getAllByRole("term").map((term) => `${term.textContent} ${term.nextElementSibling?.textContent}`);
    expect(counts).toEqual(["Leads 46.760", "Sem endereço 46.100", "Aproximados 0", "Aguardando 648", "Não localizados 12"]);
  });

  it("never shows the held or refused counts of the retired external provider", () => {
    renderInPortuguese(<MapEmptyState summary={summary} />);
    const terms = screen.getAllByRole("term").map((term) => term.textContent);
    expect(terms).toHaveLength(5);
    expect(terms).not.toContain("Recusados pelo provedor");
    expect(terms).not.toContain("Parados pelo limite");
  });

  it("offers the three actions in order and calls each one", () => {
    const importAddresses = vi.fn();
    const requestAddress = vi.fn();
    const createLead = vi.fn();
    renderInPortuguese(
      <MapEmptyState
        summary={summary}
        importAddresses={{ onSelect: importAddresses }}
        requestAddress={{ onSelect: requestAddress }}
        createLead={{ onSelect: createLead }}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Importar endereços", "Pedir endereço pelo WhatsApp", "Cadastrar lead"]);
    buttons.forEach((button) => fireEvent.click(button));
    expect(importAddresses).toHaveBeenCalledTimes(1);
    expect(requestAddress).toHaveBeenCalledTimes(1);
    expect(createLead).toHaveBeenCalledTimes(1);
  });

  it("disables an action and says why", () => {
    const requestAddress = vi.fn();
    renderInPortuguese(
      <MapEmptyState
        summary={summary}
        requestAddress={{ onSelect: requestAddress, disabledReason: "Nenhum número não oficial conectado" }}
      />,
    );
    const button = screen.getByRole("button", { name: "Pedir endereço pelo WhatsApp" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Nenhum número não oficial conectado");
    fireEvent.click(button);
    expect(requestAddress).not.toHaveBeenCalled();
  });

  it("disables an action that only has a reason, and shows the reason", () => {
    renderInPortuguese(<MapEmptyState summary={summary} createLead={{ disabledReason: "Sem permissão para cadastrar leads" }} />);
    const button = screen.getByRole("button", { name: "Cadastrar lead" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Sem permissão para cadastrar leads");
  });

  it("never shows a disabled action without a reason", () => {
    const unexplained = {} as unknown as { disabledReason: string };
    renderInPortuguese(<MapEmptyState summary={summary} createLead={unexplained} />);
    expect(screen.queryByRole("button", { name: "Cadastrar lead" })).not.toBeInTheDocument();
  });

  it("leaves out actions the page did not offer", () => {
    renderInPortuguese(<MapEmptyState summary={summary} createLead={{ onSelect: vi.fn() }} />);
    const section = screen.getByRole("region", { name: "Nenhum lead no mapa ainda" });
    expect(within(section).getAllByRole("button")).toHaveLength(1);
  });

  it("renders without counts while they load", () => {
    renderInPortuguese(<MapEmptyState summary={null} />);
    expect(screen.queryAllByRole("term")).toHaveLength(0);
  });
});

describe("MapEmptyState for a filter", () => {
  it("says the leads of the filter are off the map instead of calling it day one", () => {
    renderInPortuguese(<MapEmptyState summary={summary} scope="filter" />);
    expect(screen.getByRole("heading", { name: "Nenhum lead deste filtro está no mapa" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Nenhum lead no mapa ainda" })).not.toBeInTheDocument();
  });
});

describe("MapFilterEmpty", () => {
  it("says the filter has no lead and clears it", () => {
    const onClear = vi.fn();
    renderInPortuguese(<MapFilterEmpty onClear={onClear} />);
    expect(screen.getByRole("heading", { name: "Nenhum lead neste filtro" })).toBeInTheDocument();
    expect(screen.getByText("Mude ou limpe os filtros para ver leads no mapa.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Incluir aproximados" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("offers the approximate leads inside the area when only exact positions count", () => {
    const onSelect = vi.fn();
    renderInPortuguese(<MapFilterEmpty onClear={vi.fn()} includeApproximate={{ count: 40, onSelect }} />);
    expect(screen.getByText("40 leads com posição aproximada estão dentro da área.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Incluir aproximados" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
