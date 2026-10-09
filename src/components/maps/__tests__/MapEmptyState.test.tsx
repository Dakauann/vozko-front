import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";

import { MapEmptyState } from "../MapEmptyState";
import { renderInPortuguese } from "./intl";

const summary = {
  total: 46760,
  onMap: 0,
  approximate: 0,
  withoutAddress: 46100,
  notFound: 12,
  pending: 648,
  quotaExceeded: 0,
  refused: 0,
};

describe("MapEmptyState", () => {
  it("shows the counts instead of a blank map", () => {
    renderInPortuguese(<MapEmptyState summary={summary} />);
    expect(screen.getByRole("heading", { name: "Nenhum lead no mapa ainda" })).toBeInTheDocument();
    const counts = screen.getAllByRole("term").map((term) => `${term.textContent} ${term.nextElementSibling?.textContent}`);
    expect(counts).toEqual(["Leads 46.760", "Sem endereço 46.100", "Aproximados 0", "Aguardando 648", "Não localizados 12"]);
  });

  it("adds the held and refused counts only when there are some, so the counts add up to the total", () => {
    renderInPortuguese(<MapEmptyState summary={{ ...summary, total: 46773, quotaExceeded: 4, refused: 9 }} />);
    const counts = screen.getAllByRole("term").map((term) => `${term.textContent} ${term.nextElementSibling?.textContent}`);
    expect(counts).toEqual([
      "Leads 46.773",
      "Sem endereço 46.100",
      "Aproximados 0",
      "Aguardando 648",
      "Não localizados 12",
      "Parados pelo limite 4",
      "Recusados pelo provedor 9",
    ]);
  });

  it("shows a refused count without the held one when nothing is held", () => {
    renderInPortuguese(<MapEmptyState summary={{ ...summary, refused: 3 }} />);
    const terms = screen.getAllByRole("term").map((term) => term.textContent);
    expect(terms).toContain("Recusados pelo provedor");
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
