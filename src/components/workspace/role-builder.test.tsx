import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import pt from "@/i18n/messages/pt.json";
import type { AvailablePermission, CustomRole, Feature, RolePreset } from "@/lib/workspace/types";

const client = vi.hoisted(() => ({
  fetchAvailablePermissions: vi.fn(),
  createCustomRole: vi.fn(),
  updateCustomRole: vi.fn(),
}));

vi.mock("@/lib/workspace/client", () => client);

import { RoleBuilder } from "./role-builder";

const permissions: AvailablePermission[] = [
  { resource: "conversations", actions: ["read", "send", "view_others"] },
  {
    resource: "whatsapp_campaigns",
    actions: ["read", "start"],
    risks: { start: [{ kind: "spends_balance", level: "high", description: "" }] },
  },
];

const features: Feature[] = [
  {
    key: "inbox",
    name: "Chat",
    location: "",
    description: "",
    scopes: [],
    capabilities: [
      {
        key: "inbox.view",
        description: "Ver a caixa de entrada",
        requires: [{ resource: "conversations", action: "read" }],
        managersOnly: false,
        screens: [],
      },
    ],
  },
];

const presets: RolePreset[] = [
  {
    key: "operator",
    name: "Operador de atendimento",
    description: "",
    highlights: [],
    capabilities: ["inbox.view"],
    permissions: [
      { resource: "conversations", action: "read" },
      { resource: "conversations", action: "send" },
      { resource: "future_resource" as never, action: "read" },
    ],
  },
  {
    key: "marketing",
    name: "Marketing",
    description: "",
    highlights: [],
    capabilities: [],
    permissions: [
      { resource: "whatsapp_campaigns", action: "read" },
      { resource: "whatsapp_campaigns", action: "start" },
    ],
  },
];

function catalog(rolePresets: RolePreset[] = presets) {
  return { permissions, features, rolePresets };
}

function renderBuilder(props: Partial<React.ComponentProps<typeof RoleBuilder>> = {}) {
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <RoleBuilder wsId="ws-1" onSaved={onSaved} onCancel={onCancel} {...props} />
    </NextIntlClientProvider>,
  );
  return { onSaved, onCancel };
}

const nameInput = () => screen.getByLabelText("Nome do cargo") as HTMLInputElement;
const saveButton = () => screen.getByRole("button", { name: /Salvar cargo|Salvando/ });

async function pickPreset(name: string) {
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(name) }));
}

beforeEach(() => {
  client.fetchAvailablePermissions.mockReset().mockResolvedValue(catalog());
  client.createCustomRole.mockReset();
  client.updateCustomRole.mockReset();
});

describe("RoleBuilder", () => {
  it("shows the gallery with counts that ignore unknown permissions and the risk of each preset", async () => {
    renderBuilder();
    const operator = await screen.findByRole("button", { name: /Operador de atendimento/ });
    expect(within(operator).getByText("2 permissões")).toBeInTheDocument();
    const marketing = screen.getByRole("button", { name: /Marketing/ });
    expect(within(marketing).getByText("Consumo de saldo")).toBeInTheDocument();
    expect(operator).toHaveAttribute("aria-pressed", "false");
  });

  it("prefills the name from the preset and follows preset switches until the user edits it", async () => {
    renderBuilder();
    await pickPreset("Operador de atendimento");
    expect(nameInput().value).toBe("Operador de atendimento");
    expect(screen.getByText("Ver a caixa de entrada")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Trocar ponto de partida" }));
    await pickPreset("Marketing");
    expect(nameInput().value).toBe("Marketing");

    fireEvent.change(nameInput(), { target: { value: "Time de campanhas" } });
    fireEvent.click(screen.getByRole("button", { name: "Trocar ponto de partida" }));
    await pickPreset("Operador de atendimento");
    expect(nameInput().value).toBe("Time de campanhas");
  });

  it("creates a linked role by default with the preset key", async () => {
    client.createCustomRole.mockResolvedValue({ role: { id: "r1" } });
    const { onSaved } = renderBuilder();
    await pickPreset("Operador de atendimento");
    expect(screen.getByRole("radio", { name: /Vincular ao modelo/ })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(saveButton());
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: "r1" }));
    expect(client.createCustomRole).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({ name: "Operador de atendimento", presetKey: "operator", linked: true }),
    );
  });

  it("keeps the editor read only while linked and unlocks it after unlinking", async () => {
    renderBuilder();
    await pickPreset("Operador de atendimento");
    fireEvent.click(screen.getByRole("button", { name: /Ver permissões/ }));
    expect(screen.queryByRole("button", { name: "Desmarcar tudo" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("switch").every((item) => item.hasAttribute("disabled"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Desvincular para editar" }));
    expect(screen.getAllByRole("switch").some((item) => !item.hasAttribute("disabled"))).toBe(true);
    expect(screen.getByRole("radio", { name: /Copiar e personalizar/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /Ajustar permissões/ })).toBeInTheDocument();
  });

  it("asks before replacing permissions the user changed and reports the change count", async () => {
    renderBuilder();
    await pickPreset("Operador de atendimento");
    fireEvent.click(screen.getByRole("radio", { name: /Copiar e personalizar/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ajustar permissões/ }));
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[2]);
    expect(screen.getByText(/Baseado em Operador de atendimento/)).toBeInTheDocument();
    expect(screen.getByText("1 alteração")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Trocar ponto de partida" }));
    await pickPreset("Marketing");
    expect(await screen.findByText("Substituir as permissões?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Substituir" }));
    await waitFor(() => expect(nameInput().value).toBe("Marketing"));
  });

  it("shows a taken name as an inline field error", async () => {
    client.createCustomRole.mockResolvedValue({ role: null, error: "taken", code: "role_name_taken" });
    const { onSaved } = renderBuilder();
    await pickPreset("Operador de atendimento");
    fireEvent.click(saveButton());
    expect(await screen.findByText("Já existe um cargo com este nome. Escolha outro nome.")).toBeInTheDocument();
    expect(nameInput()).toHaveAttribute("aria-invalid", "true");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("blocks saving a blank name or a role without permissions", async () => {
    renderBuilder();
    fireEvent.click(await screen.findByRole("button", { name: /Começar do zero/ }));
    fireEvent.change(nameInput(), { target: { value: "   " } });
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("Dê um nome ao cargo para salvar.")).toBeInTheDocument();
    fireEvent.change(nameInput(), { target: { value: "Plantão" } });
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("Escolha ao menos uma permissão para salvar o cargo.")).toBeInTheDocument();
  });

  it("submits only once while saving", async () => {
    let resolve: (value: unknown) => void = () => {};
    client.createCustomRole.mockReturnValue(new Promise((r) => (resolve = r)));
    renderBuilder();
    await pickPreset("Operador de atendimento");
    fireEvent.click(saveButton());
    fireEvent.click(saveButton());
    expect(client.createCustomRole).toHaveBeenCalledTimes(1);
    expect(saveButton()).toBeDisabled();
    resolve({ role: { id: "r1" } });
    await waitFor(() => expect(client.createCustomRole).toHaveBeenCalledTimes(1));
  });

  it("falls back to the blank form with a notice when there are no presets", async () => {
    client.fetchAvailablePermissions.mockResolvedValue(catalog([]));
    renderBuilder();
    expect(
      await screen.findByText("Os modelos de cargo não estão disponíveis agora. Monte o cargo escolhendo as permissões abaixo."),
    ).toBeInTheDocument();
    expect(nameInput()).toBeInTheDocument();
  });

  it("opens an existing role on the form and recognises its preset", async () => {
    const role: CustomRole = {
      id: "r9",
      workspaceId: "ws-1",
      name: "Atendente SP",
      description: "",
      permissions: [
        { resource: "conversations", action: "send" },
        { resource: "conversations", action: "read" },
      ],
      linked: false,
      createdAt: "",
      updatedAt: "",
    };
    client.updateCustomRole.mockResolvedValue({ role });
    const { onSaved } = renderBuilder({ role });
    expect(await screen.findByText("Corresponde ao modelo Operador de atendimento")).toBeInTheDocument();
    expect(nameInput().value).toBe("Atendente SP");
    fireEvent.click(saveButton());
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(client.updateCustomRole).toHaveBeenCalledWith("ws-1", "r9", {
      name: "Atendente SP",
      description: undefined,
      permissions: expect.arrayContaining([{ resource: "conversations", action: "read" }]),
    });
  });

  it("maps a linked role rejection to a localized message", async () => {
    const role: CustomRole = {
      id: "r9",
      workspaceId: "ws-1",
      name: "Supervisores",
      description: "",
      permissions: [{ resource: "conversations", action: "read" }],
      presetKey: "operator",
      linked: false,
      createdAt: "",
      updatedAt: "",
    };
    client.updateCustomRole.mockResolvedValue({ role: null, error: "linked", code: "role_linked" });
    renderBuilder({ role });
    await screen.findByRole("radio", { name: /Copiar e personalizar/ });
    fireEvent.click(saveButton());
    expect(
      await screen.findByText("Este cargo está vinculado a um modelo. Desvincule para editar as permissões."),
    ).toBeInTheDocument();
  });
});
