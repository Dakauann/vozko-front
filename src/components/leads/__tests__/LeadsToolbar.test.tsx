import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const fetchLeadSection = vi.fn();
const findLeadsByNameAction = vi.fn();
const listLeadsQueryAction = vi.fn();
const listCustomFieldsAction = vi.fn();
const INTERESSE = {
  id: "f1",
  key: "interesse",
  label: "Interesse",
  type: "select",
  role: "classification",
  readable: true,
  position: 0,
  options: ["Positivo", "Negativo"],
  optionTones: { Positivo: "chart-2" },
};
const permissions = { current: new Set<string>(["leads:read", "members:read"]) };

vi.mock("@/app/actions/whatsapp-campaigns", () => ({
  listWhatsAppCampaignsAction: async () => ({ campaigns: [{ id: "c1", name: "Matrículas" }] }),
}));
vi.mock("@/app/actions/stages", () => ({ listStagesAction: async () => ({ stages: [] }) }));
vi.mock("@/app/actions/labels", () => ({ listLabelsAction: async () => ({ labels: [] }) }));
vi.mock("@/app/actions/leads", () => ({
  fetchLeadSection: (...args: unknown[]) => fetchLeadSection(...args),
  findLeadsByNameAction: (...args: unknown[]) => findLeadsByNameAction(...args),
  findLeadByNumberAction: async () => ({ matches: [], error: null }),
  listLeadsQueryAction: (...args: unknown[]) => listLeadsQueryAction(...args),
}));
vi.mock("@/app/actions/custom-fields", () => ({
  listCustomFieldsAction: (...args: unknown[]) => listCustomFieldsAction(...args),
}));
vi.mock("@/app/actions/workspace", () => ({
  listAssignableMembersAction: async () => ({ members: [{ userId: "u-1", username: "Clara M." }] }),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    currentWorkspace: { id: "ws1" },
    can: (resource: string, action: string) => permissions.current.has(`${resource}:${action}`),
  }),
}));
vi.mock("@/hooks/use-in-view", () => ({ useInView: () => [() => undefined, true] }));
vi.mock("@/lib/analytics/section-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics/section-query")>()),
  shouldRetrySection: () => false,
}));

import { LeadsToolbar } from "../LeadsToolbar";
import { keyedFilterField } from "@/lib/crm/board";
import { LEAD_FILTER_FIELD, emptyLeadFilter, readSet, withSet, type LeadFilter } from "@/lib/leads/filters";
import { LeadSectionError } from "@/lib/leads/sections";

const PLACES = {
  cities: [{ cityKey: "sp:barueri", city: "Barueri", state: "SP", count: 900 }],
  districts: [
    { pair: "sp:barueri/centro", cityKey: "sp:barueri", districtKey: "centro", district: "Centro", city: "Barueri", state: "SP", count: 120 },
  ],
};

const FACETS = {
  channels: {},
  memoryCategories: {},
  campaignStatuses: {},
  sources: {},
  owners: [{ owner: "u-1", name: "Clara M.", count: 7 }],
  ownersTruncated: false,
  classification: { key: "interesse", values: { Positivo: 5 } },
};

let latest: LeadFilter = emptyLeadFilter;

function Harness({ initial, countFacets, areas }: { initial: LeadFilter; countFacets: boolean; areas?: { id: string; name: string }[] }) {
  const [filter, setFilter] = useState(initial);
  const [search, setSearch] = useState("");
  const change = (next: LeadFilter) => {
    latest = next;
    setFilter(next);
  };
  return (
    <LeadsToolbar
      filter={filter}
      onFilterChange={change}
      search={search}
      onSearchChange={setSearch}
      countFacets={countFacets}
      areas={areas}
    />
  );
}

function renderToolbar({
  initial = emptyLeadFilter,
  countFacets = true,
  areas,
}: { initial?: LeadFilter; countFacets?: boolean; areas?: { id: string; name: string }[] } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <Harness initial={initial} countFacets={countFacets} areas={areas} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function quickFilter(name: string) {
  return screen.getByRole("button", { name: new RegExp(`^${name}`) });
}

describe("LeadsToolbar area chip", () => {
  beforeEach(() => {
    permissions.current = new Set(["leads:read", "members:read", "leads:read_addresses"]);
    fetchLeadSection.mockReset().mockImplementation(async (section: string) => (section === "places" ? PLACES : FACETS));
    listCustomFieldsAction.mockReset().mockResolvedValue({ fields: [INTERESSE] });
  });

  it("names a drawn area by its saved name and removes it from the filter", async () => {
    const initial = withSet(emptyLeadFilter, LEAD_FILTER_FIELD.area, ["a1"]);
    renderToolbar({ initial, areas: [{ id: "a1", name: "Região Norte" }] });
    const chip = await screen.findByRole("button", { name: "Área: Região Norte" });
    fireEvent.click(chip);
    expect(readSet(latest, LEAD_FILTER_FIELD.area)).toEqual([]);
  });

  it("names the approximate leads left out of an area by the area's saved name", async () => {
    const initial = withSet(emptyLeadFilter, "area_approximate", ["a1"]);
    renderToolbar({ initial, areas: [{ id: "a1", name: "Região Norte" }] });
    fireEvent.click(await screen.findByRole("button", { name: "Aproximados na área: Região Norte" }));
    expect(readSet(latest, "area_approximate")).toEqual([]);
  });

  it("names a map placement filter with its label", async () => {
    const initial = withSet(emptyLeadFilter, LEAD_FILTER_FIELD.geoPlacement, ["approximate"]);
    renderToolbar({ initial });
    expect(await screen.findByRole("button", { name: "Posição no mapa: Aproximado (CEP, bairro, cidade)" })).toBeInTheDocument();
  });

  it("does not offer areas in the advanced panel, where they cannot be drawn", async () => {
    renderToolbar({ areas: [{ id: "a1", name: "Região Norte" }] });
    fireEvent.click(await screen.findByRole("button", { name: /^Filtros/ }));
    expect(screen.queryByText("Área")).not.toBeInTheDocument();
  });
});

describe("LeadsToolbar", () => {
  beforeEach(() => {
    permissions.current = new Set(["leads:read", "members:read"]);
    latest = emptyLeadFilter;
    fetchLeadSection.mockReset().mockImplementation(async (section: string) => (section === "places" ? PLACES : FACETS));
    listCustomFieldsAction.mockReset().mockResolvedValue({ fields: [INTERESSE] });
  });

  it("puts Bairro, Cidade, the classification and Responsável before Filtros", async () => {
    renderToolbar();
    await screen.findByRole("button", { name: /^Interesse/ });
    const names = screen
      .getAllByRole("button")
      .map((button) => button.textContent?.trim() ?? "")
      .filter((text) => ["Bairro", "Cidade", "Interesse", "Responsável", "Filtros"].includes(text));
    expect(names).toEqual(["Bairro", "Cidade", "Interesse", "Responsável", "Filtros"]);
  });

  it("filters by a bairro as its city and bairro pair", async () => {
    renderToolbar();
    fireEvent.click(quickFilter("Bairro"));
    fireEvent.click(await screen.findByText("Centro (Barueri)"));
    expect(readSet(latest, LEAD_FILTER_FIELD.district)).toEqual(["sp:barueri/centro"]);
    expect(await screen.findByText("Bairro: Centro (Barueri)")).toBeInTheDocument();
  });

  it("keeps two bairros of different cities apart in the chip", async () => {
    fetchLeadSection.mockImplementation(async (section: string) =>
      section === "places"
        ? {
            ...PLACES,
            districts: [
              ...PLACES.districts,
              { pair: "sp:osasco/centro", cityKey: "sp:osasco", districtKey: "centro", district: "Centro", city: "Osasco", state: "SP", count: 40 },
            ],
          }
        : FACETS,
    );
    const initial: LeadFilter = {
      groups: [{ conjunction: "and", predicates: [{ field: "district", operator: "in", values: ["sp:barueri/centro", "sp:osasco/centro"] }] }],
    };
    renderToolbar({ initial });
    expect(await screen.findByText("Bairro: Centro (Barueri), Centro (Osasco)")).toBeInTheDocument();
  });

  it("says the bairros are loading while the places section is on its way", async () => {
    fetchLeadSection.mockImplementation((section: string) => (section === "places" ? new Promise(() => {}) : Promise.resolve(FACETS)));
    renderToolbar();
    fireEvent.click(quickFilter("Bairro"));
    expect(await screen.findByText("Carregando...")).toBeInTheDocument();
  });

  it("filters by the classification through its custom field key", async () => {
    renderToolbar();
    fireEvent.click(await screen.findByRole("button", { name: /^Interesse/ }));
    const option = await screen.findByText("Positivo");
    expect(within(option.closest("[cmdk-item]") as HTMLElement).getByText("5")).toBeInTheDocument();
    fireEvent.click(option);
    expect(latest.groups[0].predicates).toEqual([{ field: "custom", key: "interesse", operator: "in", values: ["Positivo"] }]);
  });

  it("removes a custom field chip without touching the other filters", async () => {
    const initial: LeadFilter = {
      groups: [
        {
          conjunction: "and",
          predicates: [
            { field: "custom", key: "interesse", operator: "in", values: ["Positivo"] },
            { field: "city", operator: "in", values: ["sp:barueri"] },
          ],
        },
      ],
    };
    renderToolbar({ initial });
    fireEvent.click(await screen.findByText("Interesse: Positivo"));
    expect(readSet(latest, keyedFilterField("custom", "interesse"))).toEqual([]);
    expect(readSet(latest, LEAD_FILTER_FIELD.city)).toEqual(["sp:barueri"]);
  });

  it("counts owners from the facets section", async () => {
    renderToolbar();
    fireEvent.click(quickFilter("Responsável"));
    const owner = await screen.findByText("Clara M.");
    await waitFor(() => expect(within(owner.closest("[cmdk-item]") as HTMLElement).getByText("7")).toBeInTheDocument());
    fireEvent.click(owner);
    expect(readSet(latest, LEAD_FILTER_FIELD.owner)).toEqual(["u-1"]);
  });

  it("says when the counts failed and lets the person retry", async () => {
    fetchLeadSection.mockImplementation(async (section: string) => {
      if (section === "facets") throw new LeadSectionError("boom", 400);
      return PLACES;
    });
    renderToolbar();
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("As contagens dos filtros não carregaram.");
    fetchLeadSection.mockImplementation(async (section: string) => (section === "places" ? PLACES : FACETS));
    fireEvent.click(within(notice).getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.queryByText("As contagens dos filtros não carregaram.")).not.toBeInTheDocument());
  });

  it("uses the shared busy copy when the counts are refused for load", async () => {
    fetchLeadSection.mockImplementation(async (section: string) => {
      if (section === "facets") throw new LeadSectionError("busy", 503);
      return PLACES;
    });
    renderToolbar();
    expect(await screen.findByText(ptMessages.metricsOps.common.sectionBusy)).toBeInTheDocument();
  });

  it("says when the custom fields did not load and lets the person retry", async () => {
    listCustomFieldsAction.mockResolvedValue({ fields: [], error: "down" });
    renderToolbar({ countFacets: false });
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("Os campos personalizados não carregaram.");
    expect(screen.queryByRole("button", { name: /^Interesse/ })).not.toBeInTheDocument();

    listCustomFieldsAction.mockResolvedValue({ fields: [INTERESSE] });
    fireEvent.click(within(notice).getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("button", { name: /^Interesse/ })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says when an option list did not load and lets the person retry", async () => {
    fetchLeadSection.mockRejectedValue(new LeadSectionError("boom", 400));
    renderToolbar({ countFacets: false });
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("Algumas opções de filtro não carregaram.");

    fetchLeadSection.mockResolvedValue(PLACES);
    fireEvent.click(within(notice).getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("does not ask for counts when the caller does not show them", async () => {
    renderToolbar({ countFacets: false });
    await screen.findByRole("button", { name: /^Interesse/ });
    expect(fetchLeadSection.mock.calls.every((call) => call[0] === "places")).toBe(true);
  });

  it("offers the new groups in the advanced filters", async () => {
    renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
    for (const group of ["Endereço", "Família", "Responsável", "Campos personalizados"]) {
      expect(await screen.findByText(group, { selector: "span.uppercase" })).toBeInTheDocument();
    }
    expect(screen.queryByText("Precisão da localização")).not.toBeInTheDocument();
  });

  it("offers street level filters to a viewer with leads:read_addresses", async () => {
    permissions.current = new Set(["leads:read", "leads:read_addresses"]);
    renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
    expect((await screen.findAllByText("Precisão da localização")).length).toBeGreaterThan(0);
  });
});

const REFERRER = "6f1b2c3d-0000-4000-8000-0000000000aa";

describe("LeadsToolbar CEP, Indicado por and Sem responsável", () => {
  beforeEach(() => {
    permissions.current = new Set(["leads:read", "members:read", "leads:read_addresses"]);
    latest = emptyLeadFilter;
    fetchLeadSection.mockReset().mockImplementation(async (section: string) => (section === "places" ? PLACES : FACETS));
    listCustomFieldsAction.mockReset().mockResolvedValue({ fields: [INTERESSE] });
    findLeadsByNameAction.mockReset().mockResolvedValue({ matches: [{ id: REFERRER, realName: "Maria Souza", number: "5511900010142" }], error: null });
    listLeadsQueryAction.mockReset().mockResolvedValue({
      items: [{ id: REFERRER, realName: "Maria Souza", number: "5511900010142" }],
      meta: { page: 1, pageSize: 1, totalPages: 1, totalItems: 1 },
      error: null,
      errorCode: null,
    });
  });

  function openPanel() {
    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
  }

  it("filters by the CEPs typed, and names them formatted in the chip", async () => {
    renderToolbar();
    openPanel();
    const input = await screen.findByRole("textbox", { name: "CEP" });
    fireEvent.change(input, { target: { value: "06402-000, 01310100" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(readSet(latest, LEAD_FILTER_FIELD.zip)).toEqual(["06402000", "01310100"]);
    expect(await screen.findByRole("button", { name: "CEP: 06402-000, 01310-100" })).toBeInTheDocument();
  });

  it("says which text is not a CEP and keeps it out of the filter", async () => {
    renderToolbar();
    openPanel();
    const input = await screen.findByRole("textbox", { name: "CEP" });
    fireEvent.change(input, { target: { value: "0640" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(readSet(latest, LEAD_FILTER_FIELD.zip)).toEqual([]);
    expect(await screen.findByText(ptMessages.leadsPage.filters.zip.invalid.replace("{values}", "0640"))).toBeInTheDocument();
  });

  it("does not offer CEP to a viewer without leads:read_addresses", async () => {
    permissions.current = new Set(["leads:read", "members:read"]);
    renderToolbar();
    openPanel();
    await screen.findByText("Família", { selector: "span.uppercase" });
    expect(screen.queryByRole("textbox", { name: "CEP" })).not.toBeInTheDocument();
  });

  it("filters by the lead who referred, picked by name", async () => {
    renderToolbar();
    openPanel();
    const input = await screen.findByRole("textbox", { name: "Indicado por" });
    fireEvent.change(input, { target: { value: "Maria" } });
    fireEvent.click(await screen.findByRole("button", { name: /Maria Souza/ }, { timeout: 5_000 }));
    expect(readSet(latest, LEAD_FILTER_FIELD.referredBy)).toEqual([REFERRER]);
    expect(await screen.findByRole("button", { name: "Indicado por: Maria Souza" })).toBeInTheDocument();
  });

  it("names a referrer that came in the link by reading that lead", async () => {
    renderToolbar({ initial: withSet(emptyLeadFilter, LEAD_FILTER_FIELD.referredBy, [REFERRER]) });
    expect(await screen.findByRole("button", { name: "Indicado por: Maria Souza" })).toBeInTheDocument();
    const [params] = listLeadsQueryAction.mock.calls[0];
    expect(readSet(params.filter, "id")).toEqual([REFERRER]);
  });

  it("asks for leads without an owner and names the chip Sem responsável", async () => {
    renderToolbar();
    openPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Sem responsável" }));
    expect(latest.groups[0].predicates).toEqual([{ field: "owner", operator: "is_empty", values: [] }]);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Sem responsável" })).toHaveLength(2));
  });
});
