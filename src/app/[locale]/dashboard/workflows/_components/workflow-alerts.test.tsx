/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { WorkflowAlerts } from "./workflow-alerts";
import type { LintIssue } from "@/lib/workflows/types";

const blocking: LintIssue = {
  code: "missing_required_edge",
  severity: "blocking",
  nodeId: "ask_name",
  message: "Conecte a saída obrigatória deste nó.",
  hint: "Toda saída obrigatória precisa de um destino.",
};
const advisory: LintIssue = {
  code: "unreachable_node",
  severity: "advisory",
  nodeId: "send_bye",
  message: "Este nó não é alcançável a partir do início.",
};

describe("WorkflowAlerts trigger", () => {
  it("shows a clean state with no count badge when there are no issues", () => {
    render(<WorkflowAlerts valid issues={[]} linting={false} />);
    const trigger = screen.getByRole("button", {
      name: "Sem alertas de validação",
    });
    expect(trigger).toBeInTheDocument();
    // No numeric badge in the clean state.
    expect(trigger.textContent).not.toMatch(/\d/);
  });

  it("shows the total count and a blocking-tone label when issues exist", () => {
    render(
      <WorkflowAlerts valid={false} issues={[blocking, advisory]} linting={false} />,
    );
    const trigger = screen.getByRole("button", {
      name: /Alertas: 1 bloqueio, 1 aviso/,
    });
    expect(trigger).toBeInTheDocument();
    expect(trigger.textContent).toContain("2");
  });
});

describe("WorkflowAlerts dropdown", () => {
  it("lists issues and focuses a node when its row is clicked", async () => {
    const onFocusNode = vi.fn();
    render(
      <WorkflowAlerts
        valid={false}
        issues={[blocking, advisory]}
        linting={false}
        nodeLabel={(id) => (id === "ask_name" ? "Perguntar nome" : id)}
        onFocusNode={onFocusNode}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Alertas:/ }));

    // Both issue messages are shown once the panel opens.
    const row = await screen.findByText(
      "Conecte a saída obrigatória deste nó.",
    );
    expect(row).toBeInTheDocument();
    expect(
      screen.getByText("Este nó não é alcançável a partir do início."),
    ).toBeInTheDocument();
    // The node chip uses the friendly label.
    expect(screen.getByText("Perguntar nome")).toBeInTheDocument();

    // Clicking the row focuses that node on the canvas.
    fireEvent.click(row);
    expect(onFocusNode).toHaveBeenCalledWith("ask_name");
  });

  it("shows the empty state when valid with no issues", async () => {
    render(<WorkflowAlerts valid issues={[]} linting={false} />);
    fireEvent.click(screen.getByRole("button", { name: /Sem alertas/ }));
    expect(await screen.findByText("Nenhum alerta")).toBeInTheDocument();
    expect(
      screen.getByText("O workflow está válido e pronto para ativar."),
    ).toBeInTheDocument();
  });
});
