import { describe, expect, it, vi } from "vitest";
import { fireEvent, render as rtlRender, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";

import ptMessages from "@/i18n/messages/pt.json";

const getAgentByIdAction = vi.fn();

vi.mock("@/app/actions/agents", () => ({
  getAgentByIdAction: (...a: unknown[]) => getAgentByIdAction(...a),
}));

import { AgentCallInputsField, AgentReplyFieldsField } from "./agent-call-config";

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

function pickAgentButton({ onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onChange("ag-1")}>
      escolher agente
    </button>
  );
}

describe("AgentCallInputsField", () => {
  it("shows the backend rules on the field they break", () => {
    render(
      <AgentCallInputsField
        value={[{ name: "Cpf" }, { name: "nome" }, { name: "nome" }]}
        onChange={vi.fn()}
        renderAgentPicker={pickAgentButton}
      />,
    );
    expect(screen.getByText("Use só letras minúsculas, dígitos e _, com até 64 caracteres.")).toBeInTheDocument();
    expect(screen.getByText("Já existe um campo com esse nome.")).toBeInTheDocument();
  });

  it("adds an empty text input", () => {
    const onChange = vi.fn();
    render(<AgentCallInputsField value={[]} onChange={onChange} renderAgentPicker={pickAgentButton} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar campo" }));
    expect(onChange).toHaveBeenCalledWith([{ name: "", type: "string", description: "", required: false, example: "" }]);
  });

  it("imports the body fields of the chosen agent's HTTP tool", async () => {
    getAgentByIdAction.mockResolvedValueOnce({
      agent: {
        internalTools: [
          { name: "http_request", config: { method: "POST", url: "https://api/matricula", body_schema: [{ name: "cpfAluno", type: "string", required: true }] } },
        ],
      },
    });
    const onChange = vi.fn();
    render(<AgentCallInputsField value={[]} onChange={onChange} renderAgentPicker={pickAgentButton} />);
    fireEvent.click(screen.getByRole("button", { name: "Importar de uma ferramenta HTTP do agente" }));
    fireEvent.click(screen.getByRole("button", { name: "escolher agente" }));
    fireEvent.click(await screen.findByRole("button", { name: "Importar" }));
    expect(getAgentByIdAction).toHaveBeenCalledWith("ag-1");
    expect(onChange).toHaveBeenCalledWith([{ name: "cpf_aluno", type: "string", description: "", required: true, example: "" }]);
    expect(screen.getByRole("status").textContent).toContain("1 campo importado.");
  });

  it("says so when the agent cannot be read, instead of offering nothing silently", async () => {
    getAgentByIdAction.mockResolvedValueOnce({ agent: null, error: "boom" });
    render(<AgentCallInputsField value={[]} onChange={vi.fn()} renderAgentPicker={pickAgentButton} />);
    fireEvent.click(screen.getByRole("button", { name: "Importar de uma ferramenta HTTP do agente" }));
    fireEvent.click(screen.getByRole("button", { name: "escolher agente" }));
    expect(await screen.findByText("Não foi possível ler este agente.")).toBeInTheDocument();
  });
});

describe("AgentReplyFieldsField", () => {
  it("adds a key and value row", () => {
    const onChange = vi.fn();
    render(<AgentReplyFieldsField value={[{ key: "status", value: "ok" }]} onChange={onChange} availableVars={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar campo" }));
    expect(onChange).toHaveBeenCalledWith([
      { key: "status", value: "ok" },
      { key: "", value: "" },
    ]);
  });

  it("warns that a repeated key keeps only its last value", () => {
    render(
      <AgentReplyFieldsField
        value={[
          { key: "status", value: "a" },
          { key: "status", value: "b" },
        ]}
        onChange={vi.fn()}
        availableVars={[]}
      />,
    );
    expect(screen.getByText("Chave repetida: só o último valor chega ao agente.")).toBeInTheDocument();
  });
});
