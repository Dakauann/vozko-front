import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const fetchLeadSection = vi.fn();

vi.mock("@/app/actions/leads", () => ({
  fetchLeadSection: (...args: unknown[]) => fetchLeadSection(...args),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws1" }, can: () => true }),
}));
vi.mock("@/lib/analytics/section-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics/section-query")>()),
  shouldRetrySection: () => false,
}));

import { LeadSearchBox } from "../LeadSearchBox";
import { LEAD_FILTER_FIELD, emptyLeadFilter, readSet, withSet, type LeadFilter } from "@/lib/leads/filters";

const PLACES = {
  cities: [{ cityKey: "rn:natal", city: "Natal", state: "RN", count: 900 }],
  districts: [
    { pair: "rn:natal/santo antonio", cityKey: "rn:natal", districtKey: "santo antonio", district: "Santo Antônio", city: "Natal", state: "RN", count: 2 },
  ],
};

const searches: string[] = [];
let picked: LeadFilter | null = null;

function Harness({ initialSearch = "", resultCount = null }: { initialSearch?: string; resultCount?: number | null }) {
  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState<LeadFilter>(withSet(emptyLeadFilter, LEAD_FILTER_FIELD.city, ["sp:barueri"]));
  return (
    <LeadSearchBox
      search={search}
      onSearchChange={(next) => {
        searches.push(next);
        setSearch(next);
      }}
      filter={filter}
      onPickPlace={(next) => {
        picked = next;
        setFilter(next);
        setSearch("");
      }}
      resultCount={resultCount}
    />
  );
}

function renderBox(props: { initialSearch?: string; resultCount?: number | null } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <Harness {...props} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function box() {
  return screen.getByRole("combobox", { name: "Buscar leads" });
}

describe("LeadSearchBox", () => {
  beforeEach(() => {
    searches.length = 0;
    picked = null;
    fetchLeadSection.mockReset().mockImplementation(async () => PLACES);
  });

  it("sends the trimmed search once typing pauses and never a single letter", async () => {
    renderBox();
    expect(box()).toHaveAttribute("placeholder", "Buscar por nome, telefone, bairro ou cidade");
    fireEvent.change(box(), { target: { value: "a" } });
    fireEvent.change(box(), { target: { value: " Santo Antonio " } });
    await waitFor(() => expect(searches).toEqual(["Santo Antonio"]));
    fireEvent.change(box(), { target: { value: "S" } });
    await waitFor(() => expect(searches).toEqual(["Santo Antonio", ""]));
  });

  it("suggests bairros and cities from the workspace places with the current filter", async () => {
    renderBox();
    fireEvent.focus(box());
    fireEvent.change(box(), { target: { value: "santo" } });
    expect(await screen.findByRole("option", { name: /Santo Antônio, Natal/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Buscar leads com «santo»" })).toBeInTheDocument();
    expect(screen.getByText("Bairros")).toBeInTheDocument();
    expect(screen.getByText("Cidades")).toBeInTheDocument();
    const [section, params] = fetchLeadSection.mock.calls.at(-1) ?? [];
    expect(section).toBe("places");
    expect(params).toMatchObject({ place: "santo" });
    expect(readSet(params.filter, LEAD_FILTER_FIELD.city)).toEqual(["sp:barueri"]);
    expect(box()).toHaveAttribute("aria-expanded", "true");
  });

  it("applies a bairro chosen with the keyboard as its filter chip instead of free text", async () => {
    renderBox();
    fireEvent.focus(box());
    fireEvent.change(box(), { target: { value: "santo" } });
    await screen.findByRole("option", { name: /Santo Antônio, Natal/ });
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    const active = box().getAttribute("aria-activedescendant");
    expect(active && document.getElementById(active)).toHaveTextContent(/Santo Antônio/);
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(picked && readSet(picked, LEAD_FILTER_FIELD.district)).toEqual(["rn:natal/santo antonio"]);
    expect(picked && readSet(picked, LEAD_FILTER_FIELD.city)).toEqual(["sp:barueri"]);
    expect(box()).toHaveValue("");
    expect(box()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the list on the first Escape and clears the search on the second", async () => {
    renderBox();
    fireEvent.focus(box());
    fireEvent.change(box(), { target: { value: "santo" } });
    await screen.findByRole("option", { name: /Santo Antônio, Natal/ });
    await waitFor(() => expect(searches).toEqual(["santo"]));
    fireEvent.keyDown(box(), { key: "Escape" });
    expect(box()).toHaveAttribute("aria-expanded", "false");
    expect(box()).toHaveValue("santo");
    fireEvent.keyDown(box(), { key: "Escape" });
    expect(box()).toHaveValue("");
    expect(searches).toEqual(["santo", ""]);
  });

  it("clears with the button and announces the result count of the search", async () => {
    renderBox({ initialSearch: "maria", resultCount: 2 });
    expect(screen.getByText("2 leads encontrados")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(box()).toHaveValue("");
    expect(searches).toEqual([""]);
  });

  it("searches right away on Enter without waiting for the pause", async () => {
    renderBox();
    fireEvent.change(box(), { target: { value: "maria" } });
    act(() => {
      fireEvent.keyDown(box(), { key: "Enter" });
    });
    expect(searches).toEqual(["maria"]);
  });
});
