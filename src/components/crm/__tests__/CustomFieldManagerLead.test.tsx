import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";

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

function renderManager(objectType?: "lead" | "opportunity") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <CustomFieldManager objectType={objectType} open onOpenChange={vi.fn()} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function renderLeadManager() {
  return renderManager("lead");
}

const savedField: CustomFieldDefinition = {
  id: "new",
  workspaceId: "ws",
  objectType: "lead",
  key: "x",
  label: "x",
  type: "text",
  required: false,
  sensitive: false,
  position: 0,
  createdAt: "",
  updatedAt: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  listCustomFieldsAction.mockResolvedValue({ fields: [] });
  createCustomFieldAction.mockResolvedValue({ field: savedField });
});

describe("CustomFieldManager for leads", () => {
  it("asks explicitly whether a lead field is sensitive before it can be saved", async () => {
    renderLeadManager();
    fireEvent.click(await screen.findByRole("button", { name: "Novo campo" }));
    fireEvent.change(screen.getByLabelText("Rótulo"), { target: { value: "Opinião" } });

    const save = screen.getByRole("button", { name: "Salvar" });
    expect(save).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sim, dado sensível" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Não" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Sim, dado sensível" }));
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Base legal (LGPD)"), { target: { value: "Consentimento do titular" } });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => expect(createCustomFieldAction).toHaveBeenCalledTimes(1));
    expect(createCustomFieldAction).toHaveBeenCalledWith(
      expect.objectContaining({
        objectType: "lead",
        key: "opiniao",
        label: "Opinião",
        sensitive: true,
        legalBasis: "Consentimento do titular",
        role: "",
      }),
    );
  });

  it("sends a non-sensitive answer without a legal basis", async () => {
    renderLeadManager();
    fireEvent.click(await screen.findByRole("button", { name: "Novo campo" }));
    fireEvent.change(screen.getByLabelText("Rótulo"), { target: { value: "Escola" } });
    fireEvent.click(screen.getByRole("button", { name: "Não" }));
    expect(screen.queryByLabelText("Base legal (LGPD)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(createCustomFieldAction).toHaveBeenCalledWith(expect.objectContaining({ key: "escola", sensitive: false, legalBasis: "" })),
    );
  });

  it("opens the Classificação preset with tones and the role, waiting for the person to write the legal basis", async () => {
    renderLeadManager();
    fireEvent.click(await screen.findByRole("button", { name: "Usar modelo Classificação" }));

    expect(screen.getByLabelText("Rótulo")).toHaveValue("Classificação");
    expect(screen.getByLabelText("Opção 1")).toHaveValue("Positivo");
    expect(screen.getByLabelText("Opção 4")).toHaveValue("Não informado");
    expect(screen.getByRole("combobox", { name: "Cor de Não informado" })).toHaveTextContent("Anel vazado");
    const basis = screen.getByLabelText("Base legal (LGPD)");
    expect(basis).toHaveValue("");
    expect(basis.getAttribute("placeholder")).toMatch(/^Ex\.:/);

    const save = screen.getByRole("button", { name: "Salvar" });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(createCustomFieldAction).not.toHaveBeenCalled();

    fireEvent.change(basis, { target: { value: "Consentimento do titular, colhido no cadastro" } });
    fireEvent.click(save);
    await waitFor(() => expect(createCustomFieldAction).toHaveBeenCalledTimes(1));
    expect(createCustomFieldAction).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "classificacao",
        type: "select",
        options: ["Positivo", "Negativo", "A conquistar", "Não informado"],
        optionTones: { Positivo: "chart-2", Negativo: "chart-5", "A conquistar": "chart-3", "Não informado": "neutral" },
        sensitive: true,
        legalBasis: "Consentimento do titular, colhido no cadastro",
        role: "classification",
      }),
    );
  });

  it("shows a failed load with a retry, never an empty list or the preset", async () => {
    listCustomFieldsAction.mockResolvedValueOnce({ fields: [], error: "boom" });
    renderLeadManager();
    expect(await screen.findByText("Não foi possível carregar os campos.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum campo personalizado ainda.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Usar modelo Classificação" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("button", { name: "Usar modelo Classificação" })).toBeInTheDocument();
  });

  it("asks before deleting a field and its values", async () => {
    deleteCustomFieldAction.mockResolvedValue({ success: true });
    listCustomFieldsAction.mockResolvedValue({ fields: [{ ...savedField, id: "f-1", label: "Escola", readable: true }] });
    renderLeadManager();
    fireEvent.click(await screen.findByRole("button", { name: "Excluir campo" }));
    expect(deleteCustomFieldAction).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Excluir campo e valores" }));
    await waitFor(() => expect(deleteCustomFieldAction).toHaveBeenCalledWith("f-1"));
  });

  it("stops offering the preset once a classification field exists", async () => {
    listCustomFieldsAction.mockResolvedValue({
      fields: [{ ...savedField, id: "c", label: "Classificação", type: "select", options: ["A"], sensitive: true, role: "classification" }],
    });
    renderLeadManager();
    expect(await screen.findByText("Sensível")).toBeInTheDocument();
    expect(screen.getAllByText("Classificação")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Usar modelo Classificação" })).not.toBeInTheDocument();
  });

  it("never asks the sensitivity question of an opportunity field", async () => {
    renderManager();
    fireEvent.click(await screen.findByRole("button", { name: "Novo campo" }));
    expect(screen.queryByRole("button", { name: "Não" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Usar modelo Classificação" })).not.toBeInTheDocument();
  });
});
