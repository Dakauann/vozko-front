import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CircuitRoutes } from "./circuit-routes";

describe("CircuitRoutes", () => {
  it("draws one route per source, named by its sentence, with source, trace and target", () => {
    render(
      <CircuitRoutes
        label="Destinos dos botões"
        routes={[
          { key: 0, name: "Falar com a equipe leva para Iniciar fluxo", state: "linked", source: <span>Falar com a equipe</span>, target: <span>Iniciar fluxo</span> },
          { key: 1, name: "Ver horários ainda sem ação", state: "open", source: <span>Ver horários</span>, target: <span>Sem ação</span> },
        ]}
      />,
    );

    const list = screen.getByRole("list", { name: "Destinos dos botões" });
    const linked = within(list).getByRole("listitem", { name: "Falar com a equipe leva para Iniciar fluxo" });
    expect(within(linked).getByText("Falar com a equipe")).toBeInTheDocument();
    expect(within(linked).getByText("Iniciar fluxo")).toBeInTheDocument();
    expect(linked).toHaveAttribute("data-state", "linked");
    expect(linked.querySelector("[data-trace]")).not.toBeNull();

    expect(within(list).getByRole("listitem", { name: "Ver horários ainda sem ação" })).toHaveAttribute("data-state", "open");
  });

  it("runs current only through linked routes", () => {
    render(
      <CircuitRoutes
        routes={[
          { key: 0, name: "a", state: "linked", source: "A", target: "1" },
          { key: 1, name: "b", state: "open", source: "B", target: "2" },
          { key: 2, name: "c", state: "stale", source: "C", target: "3" },
        ]}
      />,
    );

    expect(screen.getByRole("listitem", { name: "a" }).querySelector(".vz-circuit-spark")).not.toBeNull();
    expect(screen.getByRole("listitem", { name: "b" }).querySelector(".vz-circuit-spark")).toBeNull();
    expect(screen.getByRole("listitem", { name: "c" }).querySelector(".vz-circuit-spark")).toBeNull();
  });
});
