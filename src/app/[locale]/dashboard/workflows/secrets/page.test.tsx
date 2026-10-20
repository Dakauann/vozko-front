import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";

const api = vi.hoisted(() => ({
  listWorkflowSecretsAction: vi.fn(),
  putWorkflowSecretAction: vi.fn(),
  deleteWorkflowSecretAction: vi.fn(),
}));

vi.mock("@/app/actions/workflow-secrets", () => api);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws-1" } }),
}));

vi.mock("@/hooks/use-settled-permission", () => ({
  useSettledPermission: (resource: string) => resource === "workflows",
}));

vi.mock("@/hooks/use-assignable-members", () => ({
  useAssignableMembers: () => ({ names: new Map<string, string>() }),
}));

import WorkflowSecretsPage from "./page";

function renderPage() {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
      <WorkflowSecretsPage />
    </NextIntlClientProvider>,
  );
}

describe("secrets page create guard", () => {
  beforeEach(() => {
    api.listWorkflowSecretsAction.mockReset();
    api.putWorkflowSecretAction.mockReset();
  });

  it("never saves a new secret after the list failed to load, so a stored credential cannot be overwritten", async () => {
    api.listWorkflowSecretsAction.mockResolvedValue({ secrets: [], error: "down" });
    renderPage();
    expect(await screen.findByText("Não foi possível carregar os segredos")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Novo segredo" })[0]);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "api_key" } });
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "s3cr3t" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText(/Não foi possível conferir os segredos existentes/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled());
    expect(api.putWorkflowSecretAction).not.toHaveBeenCalled();
  });

  it("saves a new secret once the list has loaded", async () => {
    api.listWorkflowSecretsAction.mockResolvedValue({ secrets: [{ name: "other", updatedAt: "", updatedBy: "" }] });
    api.putWorkflowSecretAction.mockResolvedValue({ secret: { name: "api_key", updatedAt: "", updatedBy: "" } });
    renderPage();
    expect(await screen.findByText("other")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Novo segredo" })[0]);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "api_key" } });
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "s3cr3t" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.putWorkflowSecretAction).toHaveBeenCalledWith("api_key", "s3cr3t"));
  });
});

describe("secrets page refusals", () => {
  const errors = ptMessages.workflowSecretsPage.errors;

  beforeEach(() => {
    api.listWorkflowSecretsAction.mockReset();
    api.putWorkflowSecretAction.mockReset();
  });

  it("explains a list that failed with the catalog copy of its code", async () => {
    api.listWorkflowSecretsAction.mockResolvedValue({ secrets: [], error: "raw list", code: "workspace_required", status: 400 });
    renderPage();
    expect(await screen.findByText(errors.workspace_required)).toBeInTheDocument();
    expect(screen.queryByText("raw list")).toBeNull();
  });

  it("shows a refused value under the field in the catalog's words", async () => {
    api.listWorkflowSecretsAction.mockResolvedValue({ secrets: [] });
    api.putWorkflowSecretAction.mockResolvedValue({ secret: null, error: "raw value", code: "value_too_long", status: 400 });
    renderPage();
    await waitFor(() => expect(api.listWorkflowSecretsAction).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole("button", { name: "Novo segredo" })[0]);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "api_key" } });
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "s3cr3t" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText(errors.value_too_long)).toBeInTheDocument();
    expect(screen.queryByText("raw value")).toBeNull();
  });
});
