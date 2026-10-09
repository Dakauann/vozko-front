import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const fetchLeadSection = vi.fn();
vi.mock("@/app/actions/leads", () => ({ fetchLeadSection: (...args: unknown[]) => fetchLeadSection(...args) }));
const access = { readsAddresses: true };
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    currentWorkspace: { id: "ws1" },
    can: (resource: string, action: string) => resource === "leads" && action === "read_addresses" && access.readsAddresses,
  }),
}));
const onScreen = { current: true };
vi.mock("@/hooks/use-in-view", () => ({ useInView: () => [() => undefined, onScreen.current] }));

import { LeadStatsStrip } from "../LeadStatsStrip";
import { LEAD_FILTER_FIELD, emptyLeadFilter, readBoolean, readSet, type LeadFilter } from "@/lib/leads/filters";
import { LeadSectionError, type LeadSummarySection } from "@/lib/leads/sections";

const SUMMARY: LeadSummarySection = {
  total: 7942,
  withAddress: 6825,
  onMap: 5214,
  approximate: 1611,
  withoutAddress: 1117,
  birthdaysToday: 0,
  blocked: 18,
  windowOpen: 312,
};

function renderStrip({
  filter = emptyLeadFilter,
  onFilterChange = vi.fn(),
}: { filter?: LeadFilter; onFilterChange?: (filter: LeadFilter) => void } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <LeadStatsStrip filter={filter} search="" onFilterChange={onFilterChange} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { onFilterChange };
}

describe("LeadStatsStrip", () => {
  beforeEach(() => {
    onScreen.current = true;
    access.readsAddresses = true;
    fetchLeadSection.mockReset().mockResolvedValue(SUMMARY);
  });

  it("waits until the strip is on screen before asking the server", () => {
    onScreen.current = false;
    renderStrip();
    expect(fetchLeadSection).not.toHaveBeenCalled();
    expect(screen.getByText("Carregando os números")).toBeInTheDocument();
  });

  it("shows the summary tiles and hides the ones that are zero", async () => {
    renderStrip();
    expect(await screen.findByText("7.942")).toBeInTheDocument();
    expect(screen.getByText("No mapa")).toBeInTheDocument();
    expect(screen.getByText("Aproximados")).toBeInTheDocument();
    expect(screen.getByText("Sem endereço")).toBeInTheDocument();
    expect(screen.getByText("Bloqueados")).toBeInTheDocument();
    expect(screen.getByText("Janela aberta")).toBeInTheDocument();
    expect(screen.queryByText("Aniversariantes hoje")).not.toBeInTheDocument();
    expect(fetchLeadSection).toHaveBeenCalledWith("summary", expect.objectContaining({ filter: emptyLeadFilter }), expect.anything());
  });

  it("applies a tile's filter when it is clicked", async () => {
    const { onFilterChange } = renderStrip();
    fireEvent.click(await screen.findByRole("button", { name: /Sem endereço/ }));
    const next = vi.mocked(onFilterChange).mock.calls[0][0];
    expect(readBoolean(next, LEAD_FILTER_FIELD.hasAddress)).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /Bloqueados/ }));
    expect(readBoolean(vi.mocked(onFilterChange).mock.calls[1][0], LEAD_FILTER_FIELD.blocked)).toBe(true);
  });

  it("marks an applied tile as pressed", async () => {
    const filter: LeadFilter = { groups: [{ conjunction: "and", predicates: [{ field: "blocked", operator: "is_true", values: [] }] }] };
    renderStrip({ filter });
    expect(await screen.findByRole("button", { name: /Bloqueados/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Janela aberta/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("marks an applied tile with the status rail underline instead of a box", async () => {
    const filter: LeadFilter = { groups: [{ conjunction: "and", predicates: [{ field: "blocked", operator: "is_true", values: [] }] }] };
    renderStrip({ filter });
    const applied = await screen.findByRole("button", { name: /Bloqueados/ });
    expect(applied.className).toContain("shadow-[inset_0_-2px_0_0_hsl(var(--primary))]");
    expect(applied.className).not.toMatch(/\bborder\b/);
    const resting = screen.getByRole("button", { name: /Janela aberta/ });
    expect(within(resting).getByText("312").className).toContain("decoration-border-strong");
  });

  it("keeps the total as a plain count and lists the leads on the map with their placement", async () => {
    const { onFilterChange } = renderStrip();
    await screen.findByText("7.942");
    expect(screen.queryByRole("button", { name: /Total/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /No mapa/ }));
    expect(readSet((onFilterChange as ReturnType<typeof vi.fn>).mock.calls[0][0] as LeadFilter, LEAD_FILTER_FIELD.geoPlacement)).toEqual(["on_map"]);
    fireEvent.click(screen.getByRole("button", { name: /Aproximados/ }));
    expect(readSet((onFilterChange as ReturnType<typeof vi.fn>).mock.calls[1][0] as LeadFilter, LEAD_FILTER_FIELD.geoPlacement)).toEqual(["approximate"]);
  });

  it("keeps the map tiles as plain counts for a viewer who cannot read addresses", async () => {
    access.readsAddresses = false;
    renderStrip();
    await screen.findByText("7.942");
    expect(screen.queryByRole("button", { name: /No mapa/ })).not.toBeInTheDocument();
    expect(screen.getByText("No mapa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sem endereço/ })).toBeInTheDocument();
  });

  it("shows its own error with a retry instead of zeros", async () => {
    fetchLeadSection.mockRejectedValueOnce(new LeadSectionError("boom", 400)).mockResolvedValueOnce(SUMMARY);
    renderStrip();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Não foi possível carregar os números deste filtro.")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();

    fireEvent.click(within(alert).getByRole("button"));
    expect(await screen.findByText("7.942")).toBeInTheDocument();
  });
});
