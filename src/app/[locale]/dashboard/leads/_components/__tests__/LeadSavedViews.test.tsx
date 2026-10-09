import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const listSavedViewsAction = vi.fn();
const createSavedViewAction = vi.fn();
const deleteSavedViewAction = vi.fn();
vi.mock("@/app/actions/saved-views", () => ({
  listSavedViewsAction: (...args: unknown[]) => listSavedViewsAction(...args),
  createSavedViewAction: (...args: unknown[]) => createSavedViewAction(...args),
  deleteSavedViewAction: (...args: unknown[]) => deleteSavedViewAction(...args),
}));

import LeadSavedViews from "../LeadSavedViews";
import type { SavedView } from "@/lib/crm/saved-views";
import { emptyLeadFilter } from "@/lib/leads/filters";

const SAVED: SavedView = {
  id: "v1",
  name: "Janela aberta",
  objectType: "lead",
  filter: emptyLeadFilter,
  groupBy: "none",
  columns: ["window"],
  isDefault: false,
  position: 0,
};

function renderViews(onApply = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <LeadSavedViews filter={emptyLeadFilter} sorts={[{ key: "createdAt", direction: "desc" }]} columns={["memories"]} onApply={onApply} />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Visões/ }));
  return { onApply };
}

describe("LeadSavedViews", () => {
  beforeEach(() => {
    listSavedViewsAction.mockReset().mockResolvedValue({ views: [SAVED] });
    createSavedViewAction.mockReset();
    deleteSavedViewAction.mockReset().mockResolvedValue({ success: true });
  });

  it("saves the chosen columns, even without a filter", async () => {
    createSavedViewAction.mockResolvedValue({ view: { ...SAVED, id: "v2", name: "Memórias", columns: ["memories"] } });
    renderViews();
    fireEvent.change(await screen.findByPlaceholderText("Nome da visão"), { target: { value: "Memórias" } });
    fireEvent.click(screen.getByTitle("Salvar visão atual"));

    await waitFor(() => expect(createSavedViewAction).toHaveBeenCalledTimes(1));
    expect(createSavedViewAction.mock.calls[0][0]).toMatchObject({
      name: "Memórias",
      objectType: "lead",
      columns: ["memories"],
      sortField: "createdAt",
      sortDir: "desc",
    });
    expect(await screen.findByText("Memórias")).toBeInTheDocument();
  });

  it("hands the whole view back so the page restores its columns", async () => {
    const { onApply } = renderViews();
    fireEvent.click(await screen.findByText("Janela aberta"));
    expect(onApply).toHaveBeenCalledWith(SAVED);
  });

  it("explains a refused filter in words instead of the server text", async () => {
    createSavedViewAction.mockResolvedValue({ view: null, error: "raw server text", code: "lead_filter_address_forbidden" });
    renderViews();
    fireEvent.change(await screen.findByPlaceholderText("Nome da visão"), { target: { value: "CEP" } });
    fireEvent.click(screen.getByTitle("Salvar visão atual"));
    expect(
      await screen.findByText("Você não tem permissão para filtrar por CEP ou pela localização no mapa."),
    ).toBeInTheDocument();
    expect(screen.queryByText("raw server text")).not.toBeInTheDocument();
  });

  it("falls back to the generic message for an unknown refusal", async () => {
    createSavedViewAction.mockResolvedValue({ view: null, error: "raw server text" });
    renderViews();
    fireEvent.change(await screen.findByPlaceholderText("Nome da visão"), { target: { value: "X" } });
    fireEvent.click(screen.getByTitle("Salvar visão atual"));
    expect(await screen.findByText("Não foi possível salvar a visão")).toBeInTheDocument();
  });
});
