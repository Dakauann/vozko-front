import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const actions = vi.hoisted(() => ({ updateLeadAreaAction: vi.fn(), deleteLeadAreaAction: vi.fn() }));
vi.mock("@/app/actions/lead-map", () => actions);
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws1" } }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import type { DrawnArea } from "@/lib/maps/types";

import { AreaList, AreaManager } from "../AreaManager";

const MINE: DrawnArea = {
  id: "a1",
  name: "Região Norte",
  visibility: "private",
  ownerId: "u1",
  canEdit: true,
  shape: { kind: "circle", center: { lat: -23.5, lng: -46.6 }, radiusM: 1500 },
  createdAt: "",
  updatedAt: "",
};
const THEIRS: DrawnArea = { ...MINE, id: "a2", name: "Centro da Ana", visibility: "shared", ownerId: "u2", canEdit: false };

function renderList(props: Partial<Parameters<typeof AreaList>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const handlers = { onToggle: vi.fn(), onDeleted: vi.fn() };
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <AreaList areas={[MINE, THEIRS]} activeIds={["a1"]} {...handlers} {...props} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { ...handlers, invalidate };
}

function row(name: string) {
  return screen.getAllByRole("listitem").find((item) => within(item).queryByText(name) !== null)!;
}

describe("AreaManager", () => {
  beforeEach(() => {
    Object.values(actions).forEach((mock) => mock.mockReset());
    Object.values(toast).forEach((mock) => mock.mockReset());
  });

  it("lists every readable area, says which narrow the filter, and toggles them", () => {
    const { onToggle } = renderList();
    const applied = screen.getByRole("button", { name: "Tirar Região Norte do filtro" });
    expect(applied).toHaveAttribute("aria-pressed", "true");
    const other = screen.getByRole("button", { name: "Aplicar Centro da Ana ao filtro" });
    expect(other).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(other);
    expect(onToggle).toHaveBeenCalledWith("a2");
    expect(within(row("Região Norte")).getByText("Privada")).toBeInTheDocument();
    expect(within(row("Centro da Ana")).getByText("Compartilhada")).toBeInTheDocument();
  });

  it("offers rename, share and delete only on the areas the viewer created, and says why not on the others", () => {
    renderList();
    expect(within(row("Região Norte")).getByRole("button", { name: "Renomear Região Norte" })).toBeInTheDocument();
    expect(within(row("Centro da Ana")).queryByRole("button", { name: /Renomear/ })).not.toBeInTheDocument();
    expect(within(row("Centro da Ana")).getByText("Só quem criou a área pode alterá-la.")).toBeInTheDocument();
  });

  it("renames an area and refreshes the areas", async () => {
    actions.updateLeadAreaAction.mockResolvedValue({ area: { ...MINE, name: "Zona Norte" }, error: null });
    const { invalidate } = renderList();
    fireEvent.click(screen.getByRole("button", { name: "Renomear Região Norte" }));
    const input = screen.getByRole("textbox", { name: "Novo nome de Região Norte" });
    expect(input).toHaveValue("Região Norte");
    fireEvent.change(input, { target: { value: "  Zona Norte  " } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salvar" })));
    expect(actions.updateLeadAreaAction).toHaveBeenCalledWith("a1", { name: "Zona Norte" });
    expect(toast.success).toHaveBeenCalledWith("Área renomeada.");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["lead-map", "ws1"] });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("keeps the name being typed and explains a refused rename", async () => {
    actions.updateLeadAreaAction.mockResolvedValue({ area: null, error: { code: "area_name_too_long", status: 400 } });
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Renomear Região Norte" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x".repeat(300) } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salvar" })));
    expect(toast.error).toHaveBeenCalledWith("O nome da área é longo demais.");
    expect(screen.getByRole("textbox")).toHaveValue("x".repeat(300));
  });

  it("does not send a blank name", () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Renomear Região Norte" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("shares a private area with the workspace", async () => {
    actions.updateLeadAreaAction.mockResolvedValue({ area: { ...MINE, visibility: "shared" }, error: null });
    renderList();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Compartilhar Região Norte com o workspace" })));
    expect(actions.updateLeadAreaAction).toHaveBeenCalledWith("a1", { visibility: "shared" });
    expect(toast.success).toHaveBeenCalledWith("Área compartilhada com o workspace.");
  });

  it("makes a shared area private again", async () => {
    actions.updateLeadAreaAction.mockResolvedValue({ area: MINE, error: null });
    renderList({ areas: [{ ...MINE, visibility: "shared" }] });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Deixar Região Norte só para mim" })));
    expect(actions.updateLeadAreaAction).toHaveBeenCalledWith("a1", { visibility: "private" });
  });

  it("deletes an area after confirming and takes it out of the filter", async () => {
    actions.deleteLeadAreaAction.mockResolvedValue({ error: null });
    const { onDeleted } = renderList();
    fireEvent.click(screen.getByRole("button", { name: "Apagar Região Norte" }));
    expect(actions.deleteLeadAreaAction).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Apagar a área Região Norte?")).toBeInTheDocument();
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Apagar área" })));
    expect(actions.deleteLeadAreaAction).toHaveBeenCalledWith("a1");
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("a1"));
    expect(toast.success).toHaveBeenCalledWith("Área apagada.");
  });

  it("keeps the area when the delete is refused", async () => {
    actions.deleteLeadAreaAction.mockResolvedValue({ error: { code: "area_forbidden", status: 403 } });
    const { onDeleted } = renderList();
    fireEvent.click(screen.getByRole("button", { name: "Apagar Região Norte" }));
    const dialog = await screen.findByRole("alertdialog");
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Apagar área" })));
    expect(toast.error).toHaveBeenCalledWith("Você não pode alterar esta área.");
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("opens the list from the map and counts the saved areas", async () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
          <AreaManager areas={[MINE, THEIRS]} activeIds={[]} onToggle={vi.fn()} onDeleted={vi.fn()} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Áreas salvas: 2" }));
    expect(await screen.findByRole("button", { name: "Aplicar Região Norte ao filtro" })).toBeInTheDocument();
  });
});
