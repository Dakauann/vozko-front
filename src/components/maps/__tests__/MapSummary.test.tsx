import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";

import { MapSummary } from "../MapSummary";
import { renderInPortuguese } from "./intl";

const summary = {
  total: 1200,
  onMap: 800,
  approximate: 200,
  withoutAddress: 150,
  notFound: 0,
  pending: 1,
  quotaExceeded: 0,
  refused: 0,
};

describe("MapSummary", () => {
  it("announces the counts as text in a polite live region", () => {
    renderInPortuguese(<MapSummary summary={summary} visibleCount={340} />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(status).toHaveTextContent(
      "340 leads nesta parte do mapa. 1.200 leads no filtro. 800 no mapa. 200 aproximados. 150 sem endereço. 1 aguardando localização.",
    );
  });

  it("announces the approximate leads drawn in this part of the map apart from the ones on the map", () => {
    renderInPortuguese(<MapSummary summary={summary} visibleCount={340} visibleApproximate={12} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "340 leads nesta parte do mapa. 12 com posição aproximada nesta parte do mapa. 1.200 leads no filtro. 800 no mapa.",
    );
  });

  it("leaves out off-map groups that are empty", () => {
    renderInPortuguese(<MapSummary summary={summary} />);
    expect(screen.getByRole("status").textContent).not.toContain("não localizado");
    expect(screen.getByRole("status").textContent).not.toContain("limite");
  });

  it("announces the addresses the provider refused when there are any", () => {
    renderInPortuguese(<MapSummary summary={{ ...summary, refused: 2 }} />);
    expect(screen.getByRole("status")).toHaveTextContent("2 recusados pelo provedor de localização.");
  });

  it("says when nothing is on the map", () => {
    renderInPortuguese(<MapSummary summary={{ ...summary, onMap: 0 }} visibleCount={0} />);
    expect(screen.getByRole("status")).toHaveTextContent("Nenhum lead nesta parte do mapa. 1.200 leads no filtro. Nenhum no mapa.");
  });

  it("announces loading and failure instead of stale numbers", () => {
    const { rerender } = renderInPortuguese(<MapSummary summary={summary} loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando as contagens do mapa.");
    rerender(<MapSummary summary={summary} failed />);
    expect(screen.getByRole("status")).toHaveTextContent("Não foi possível carregar as contagens do mapa.");
  });

  it("is visually hidden unless asked to show", () => {
    const { rerender } = renderInPortuguese(<MapSummary summary={summary} />);
    expect(screen.getByRole("status")).toHaveClass("sr-only");
    rerender(<MapSummary summary={summary} visible />);
    expect(screen.getByRole("status")).not.toHaveClass("sr-only");
  });
});
