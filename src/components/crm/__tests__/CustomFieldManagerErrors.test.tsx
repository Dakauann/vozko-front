import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import ptMessages from "@/i18n/messages/pt.json";

const listCustomFieldsAction = vi.fn();
const createCustomFieldAction = vi.fn();
const updateCustomFieldAction = vi.fn();
const deleteCustomFieldAction = vi.fn();

vi.mock("@/app/actions/custom-fields", () => ({
  listCustomFieldsAction: (...a: unknown[]) => listCustomFieldsAction(...a),
  createCustomFieldAction: (...a: unknown[]) => createCustomFieldAction(...a),
  updateCustomFieldAction: (...a: unknown[]) => updateCustomFieldAction(...a),
  deleteCustomFieldAction: (...a: unknown[]) => deleteCustomFieldAction(...a),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, can: () => true }),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import CustomFieldManager from "../CustomFieldManager";

function renderManager() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <CustomFieldManager open onOpenChange={vi.fn()} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

async function saveNewField(label: string) {
  fireEvent.click(await screen.findByRole("button", { name: "Novo campo" }));
  fireEvent.change(screen.getByLabelText("Rótulo"), { target: { value: label } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  listCustomFieldsAction.mockResolvedValue({ fields: [] });
});

describe("CustomFieldManager refusals", () => {
  it("explains a refused definition by its code", async () => {
    createCustomFieldAction.mockResolvedValue({
      field: null,
      error: { message: "customfield: key already exists for this object", code: "custom_field_key_exists", status: 409 },
    });
    renderManager();

    await saveNewField("Segmento");

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Já existe um campo com esta chave neste objeto."),
    );
  });

  it("never shows the raw server text for an unknown refusal", async () => {
    createCustomFieldAction.mockResolvedValue({
      field: null,
      error: { message: "Internal server error", status: 500 },
    });
    renderManager();

    await saveNewField("Segmento");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar o campo."));
  });

  it("explains a refused deletion by its code", async () => {
    listCustomFieldsAction.mockResolvedValue({
      fields: [
        {
          id: "f1",
          workspaceId: "ws",
          objectType: "opportunity",
          key: "segmento",
          label: "Segmento",
          type: "text",
          required: false,
          sensitive: false,
          position: 0,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    deleteCustomFieldAction.mockResolvedValue({
      success: false,
      error: { message: "customfield: not found", code: "custom_field_not_found", status: 404 },
    });
    renderManager();

    await screen.findByText("Segmento");
    fireEvent.click(screen.getByRole("button", { name: "Excluir campo" }));
    fireEvent.click(await screen.findByRole("button", { name: "Excluir campo e valores" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Este campo não existe mais. Recarregue a lista."),
    );
  });
});
