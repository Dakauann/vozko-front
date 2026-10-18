import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ElevatedStepFlow } from "./elevated-step-flow";

const steps = [
  { id: "identity", title: "Identidade", description: "Nome do agente", summary: "Recepção 24h" },
  { id: "models", title: "Modelo", description: "Escolha o modelo", summary: "gpt-4o" },
  { id: "review", title: "Revisar", description: "Confira e salve" },
];

function renderFlow(currentStep: number, onStepClick = vi.fn()) {
  render(
    <ElevatedStepFlow steps={steps} currentStep={currentStep} onStepClick={onStepClick} editLabel="Alterar" actions={<button type="button">Próximo</button>}>
      <p>Corpo da etapa</p>
    </ElevatedStepFlow>,
  );
  return onStepClick;
}

describe("ElevatedStepFlow", () => {
  it("lists every step top to bottom and marks only the current one", () => {
    renderFlow(1);
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => within(item).getAllByText(/Identidade|Modelo|Revisar/)[0].textContent)).toEqual(["Identidade", "Modelo", "Revisar"]);
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[0]).not.toHaveAttribute("aria-current");
  });

  it("expands only the current step with its body and actions", () => {
    renderFlow(1);
    const current = screen.getAllByRole("listitem")[1];
    expect(within(current).getByText("Corpo da etapa")).toBeInTheDocument();
    expect(within(current).getByRole("button", { name: "Próximo" })).toBeInTheDocument();
    expect(screen.getAllByText("Corpo da etapa")).toHaveLength(1);
  });

  it("summarizes completed steps and lets them be reopened", () => {
    const onStepClick = renderFlow(2);
    expect(screen.getByText("Recepção 24h")).toBeInTheDocument();
    expect(screen.getByText("gpt-4o")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Alterar Identidade/ }));
    expect(onStepClick).toHaveBeenCalledWith(0);
  });

  it("keeps upcoming steps closed and not clickable", () => {
    renderFlow(0);
    expect(screen.queryByText("Recepção 24h")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Revisar/ })).not.toBeInTheDocument();
    expect(screen.getByText("Confira e salve")).toBeInTheDocument();
  });
});
