import { describe, expect, it, vi } from "vitest";
import { fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";

import ptMessages from "@/i18n/messages/pt.json";

const listWorkflowSecretsAction = vi.fn();
const putWorkflowSecretAction = vi.fn();

vi.mock("@/app/actions/workflow-secrets", () => ({
  listWorkflowSecretsAction: (...a: unknown[]) => listWorkflowSecretsAction(...a),
  putWorkflowSecretAction: (...a: unknown[]) => putWorkflowSecretAction(...a),
}));

import { MoveToSecretDialog, type MoveToSecretRequest } from "./move-to-secret-dialog";

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

function request(): MoveToSecretRequest {
  return {
    nodeId: "n55",
    nodeLabel: "Login",
    inCode: false,
    fix: {
      value: "s3cr3t",
      suggestedName: "authorization",
      replace: (name) => ({ headers: { Authorization: `{{secret.${name}}}` } }),
    },
  };
}

describe("MoveToSecretDialog", () => {
  it("creates the secret with the literal and swaps the node config, never showing the value", async () => {
    listWorkflowSecretsAction.mockResolvedValueOnce({ secrets: [] });
    putWorkflowSecretAction.mockResolvedValueOnce({ secret: { name: "authorization" } });
    const onMoved = vi.fn();
    const onClose = vi.fn();
    render(<MoveToSecretDialog request={request()} onClose={onClose} onMoved={onMoved} />);
    expect(screen.queryByText(/s3cr3t/)).toBeNull();
    const confirm = screen.getByRole("button", { name: "Mover para segredos" });
    await waitFor(() => expect(confirm).not.toBeDisabled());
    fireEvent.click(confirm);
    await waitFor(() => expect(onMoved).toHaveBeenCalledWith("n55", { headers: { Authorization: "{{secret.authorization}}" } }));
    expect(putWorkflowSecretAction).toHaveBeenCalledWith("authorization", "s3cr3t");
    expect(onClose).toHaveBeenCalled();
  });

  it("refuses a name that already exists, so no secret is overwritten", async () => {
    listWorkflowSecretsAction.mockResolvedValueOnce({ secrets: [{ name: "authorization", updatedAt: "", updatedBy: "" }] });
    render(<MoveToSecretDialog request={request()} onClose={vi.fn()} onMoved={vi.fn()} />);
    expect(await screen.findByText("Já existe um segredo com esse nome. Escolha outro nome.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mover para segredos" })).toBeDisabled();
  });

  it("refuses while the existing secrets cannot be checked", async () => {
    listWorkflowSecretsAction.mockResolvedValueOnce({ secrets: [], error: "down" });
    render(<MoveToSecretDialog request={request()} onClose={vi.fn()} onMoved={vi.fn()} />);
    expect(await screen.findByText(/Não foi possível conferir os segredos existentes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mover para segredos" })).toBeDisabled();
  });
});
