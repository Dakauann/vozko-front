import { describe, expect, it, vi } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";

import ptMessages from "@/i18n/messages/pt.json";

const getWorkflowAction = vi.fn();
const getWorkflowVersionAction = vi.fn();

vi.mock("@/app/actions/workflows", () => ({
  getWorkflowAction: (...a: unknown[]) => getWorkflowAction(...a),
  getWorkflowVersionAction: (...a: unknown[]) => getWorkflowVersionAction(...a),
}));

import RunWorkflowBindingDetails from "../RunWorkflowBindingDetails";

function IntlWrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      {children}
    </NextIntlClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: IntlWrapper });
}

function workflow(status: string, draftNodes: unknown[], publishedVersion: number | null = 3) {
  return { workflow: { id: "wf-1", name: "Matrícula", status, publishedVersion, graph: { nodes: draftNodes, edges: [] } } };
}

function published(nodes: unknown[]) {
  return { version: { id: "v3", workflowId: "wf-1", version: 3, graph: { nodes, edges: [] } } };
}

const AGENT_TRIGGER = {
  id: "t1",
  type: "trigger_agent_call",
  position: { x: 0, y: 0 },
  config: { inputs: [{ name: "cpf", type: "string", required: true, description: "CPF do aluno" }] },
};

describe("RunWorkflowBindingDetails", () => {
  it("shows the workflow, the fields the AI fills read-only, the link and the conversation note", async () => {
    getWorkflowAction.mockResolvedValueOnce(workflow("active", [AGENT_TRIGGER]));
    getWorkflowVersionAction.mockResolvedValueOnce(published([AGENT_TRIGGER]));
    render(<RunWorkflowBindingDetails config={{ workflow_id: "wf-1" }} />);
    expect(await screen.findByText("Matrícula")).toBeInTheDocument();
    expect(screen.getByText("Campos que a IA vai preencher")).toBeInTheDocument();
    expect(screen.getByText("cpf")).toBeInTheDocument();
    expect(screen.getByText("CPF do aluno")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("link", { name: /Abrir fluxo/ })).toHaveAttribute("href", "/dashboard/workflows/wf-1");
    expect(screen.getByText(/A conversa atual vai junto automaticamente/)).toBeInTheDocument();
  });

  it("flags an inactive workflow and one without the agent-call trigger", async () => {
    getWorkflowAction.mockResolvedValueOnce(workflow("paused", []));
    getWorkflowVersionAction.mockResolvedValueOnce(published([]));
    render(<RunWorkflowBindingDetails config={{ workflow_id: "wf-1" }} />);
    expect(await screen.findByText("Fluxo inativo")).toBeInTheDocument();
    expect(screen.getByText("Sem o gatilho Chamado por agente IA")).toBeInTheDocument();
  });

  it("says so when the workflow cannot be read", async () => {
    getWorkflowAction.mockResolvedValueOnce({ workflow: null, error: "boom" });
    render(<RunWorkflowBindingDetails config={{ workflow_id: "wf-1" }} />);
    expect(await screen.findByText("Não foi possível ler este fluxo.")).toBeInTheDocument();
  });

  it("lists the fields of the published trigger, which is what the agent calls, not the draft", async () => {
    const draftTrigger = { ...AGENT_TRIGGER, config: { inputs: [{ name: "rascunho", type: "string" }] } };
    getWorkflowAction.mockResolvedValueOnce(workflow("active", [draftTrigger]));
    getWorkflowVersionAction.mockResolvedValueOnce(published([AGENT_TRIGGER]));
    render(<RunWorkflowBindingDetails config={{ workflow_id: "wf-1" }} />);
    expect(await screen.findByText("cpf")).toBeInTheDocument();
    expect(screen.queryByText("rascunho")).toBeNull();
    expect(getWorkflowVersionAction).toHaveBeenCalledWith("wf-1", 3);
  });

  it("says the workflow is not published instead of listing draft fields", async () => {
    getWorkflowVersionAction.mockReset();
    getWorkflowAction.mockResolvedValueOnce(workflow("draft", [AGENT_TRIGGER], null));
    render(<RunWorkflowBindingDetails config={{ workflow_id: "wf-1" }} />);
    expect(await screen.findByText("Fluxo não publicado")).toBeInTheDocument();
    expect(screen.queryByText("cpf")).toBeNull();
    expect(screen.queryByText("Sem o gatilho Chamado por agente IA")).toBeNull();
    expect(getWorkflowVersionAction).not.toHaveBeenCalled();
  });

  it("says so when the published version cannot be read, never falling back to the draft", async () => {
    getWorkflowAction.mockResolvedValueOnce(workflow("active", [AGENT_TRIGGER]));
    getWorkflowVersionAction.mockResolvedValueOnce({ version: null, error: "boom" });
    render(<RunWorkflowBindingDetails config={{ workflow_id: "wf-1" }} />);
    expect(await screen.findByText("Não foi possível ler este fluxo.")).toBeInTheDocument();
    expect(screen.queryByText("cpf")).toBeNull();
  });
});
