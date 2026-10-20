import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";

import ptMessages from "@/i18n/messages/pt.json";
import type { SecretNameList } from "@/lib/workflow-secrets/secret-create";

const putWorkflowSecretAction = vi.fn();

vi.mock("@/app/actions/workflow-secrets", () => ({
  putWorkflowSecretAction: (...a: unknown[]) => putWorkflowSecretAction(...a),
}));

import { WorkflowSecretDialog } from "./workflow-secret-dialog";

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

function list(state: Partial<SecretNameList> = {}): SecretNameList {
  return { names: new Set<string>(), loading: false, failed: false, ...state };
}

function fill(name: string, value: string) {
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Valor"), { target: { value } });
}

describe("WorkflowSecretDialog create", () => {
  beforeEach(() => {
    putWorkflowSecretAction.mockReset();
  });

  it("creates a new secret once the list is known", async () => {
    putWorkflowSecretAction.mockResolvedValueOnce({ secret: { name: "api_key", updatedAt: "", updatedBy: "" } });
    const onSaved = vi.fn();
    render(<WorkflowSecretDialog mode={{ kind: "create" }} existing={list()} onClose={vi.fn()} onSaved={onSaved} />);
    fill("api_key", "s3cr3t");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(putWorkflowSecretAction).toHaveBeenCalledWith("api_key", "s3cr3t");
  });

  it("refuses while the list is loading, since an existing secret could be silently overwritten", async () => {
    render(<WorkflowSecretDialog mode={{ kind: "create" }} existing={list({ loading: true })} onClose={vi.fn()} onSaved={vi.fn()} />);
    fill("api_key", "s3cr3t");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled());
    expect(putWorkflowSecretAction).not.toHaveBeenCalled();
  });

  it("refuses after a failed list read and says the names could not be checked", async () => {
    render(<WorkflowSecretDialog mode={{ kind: "create" }} existing={list({ failed: true })} onClose={vi.fn()} onSaved={vi.fn()} />);
    fill("api_key", "s3cr3t");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText(/Não foi possível conferir os segredos existentes/)).toBeInTheDocument();
    expect(putWorkflowSecretAction).not.toHaveBeenCalled();
  });

  it("refuses a name already in the list", async () => {
    render(
      <WorkflowSecretDialog
        mode={{ kind: "create" }}
        existing={list({ names: new Set(["api_key"]) })}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    fill("api_key", "s3cr3t");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText(/Já existe um segredo com esse nome. Para trocar o valor/)).toBeInTheDocument();
    expect(putWorkflowSecretAction).not.toHaveBeenCalled();
  });

  it("replaces an existing secret without the create guard", async () => {
    putWorkflowSecretAction.mockResolvedValueOnce({ secret: null });
    const onSaved = vi.fn();
    render(
      <WorkflowSecretDialog
        mode={{ kind: "replace", name: "api_key" }}
        existing={list({ names: new Set(["api_key"]) })}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "novo" } });
    fireEvent.click(screen.getByRole("button", { name: "Substituir" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(putWorkflowSecretAction).toHaveBeenCalledWith("api_key", "novo");
  });

  it("puts a backend name error on the name field, in the catalog words of its code", async () => {
    putWorkflowSecretAction.mockResolvedValueOnce({ secret: null, error: "nome inválido no servidor", code: "invalid_name" });
    render(<WorkflowSecretDialog mode={{ kind: "create" }} existing={list()} onClose={vi.fn()} onSaved={vi.fn()} />);
    fill("api_key", "s3cr3t");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText(ptMessages.workflowSecretsPage.errors.invalid_name)).toBeInTheDocument();
  });
});
