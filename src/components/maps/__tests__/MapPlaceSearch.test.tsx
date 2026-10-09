import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const fetchPlaces = vi.fn();
vi.mock("@/app/actions/places", () => ({ fetchPlaces: (...args: unknown[]) => fetchPlaces(...args) }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws1" } }) }));

import { LEAD_FILTER_FIELD, readSet } from "@/lib/leads/filters";
import type { Place } from "@/lib/maps/places";

import { MapPlaceSearch, placeFilterOf } from "../MapPlaceSearch";

const recife: Place = {
  kind: "city",
  label: "Recife, PE",
  name: "Recife",
  zipCode: "",
  street: "",
  district: "",
  city: "Recife",
  cityCode: "2611606",
  cityKey: "pe:recife",
  districtPair: "",
  state: "PE",
  position: { lat: -8.05, lng: -34.9 },
  precision: "city",
  bounds: { south: -8.15, west: -35.0, north: -7.93, east: -34.85 },
  addressCount: 700,
  zipCount: 0,
};

const boaViagem: Place = { ...recife, kind: "district", label: "Boa Viagem, Recife, PE", name: "Boa Viagem", district: "Boa Viagem", districtPair: "pe:recife/boa viagem", precision: "district" };
const avenue: Place = { ...boaViagem, kind: "street", label: "Avenida Boa Viagem, Boa Viagem, Recife, PE", name: "Avenida Boa Viagem", street: "Avenida Boa Viagem", zipCount: 12, bounds: null, precision: "postal_code" };

function renderSearch(props: Partial<Parameters<typeof MapPlaceSearch>[0]> = {}) {
  const onSelect = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <MapPlaceSearch onSelect={onSelect} {...props} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { onSelect, input: screen.getByRole("combobox", { name: "Buscar lugar no mapa" }) };
}

async function type(input: HTMLElement, value: string) {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
}

describe("MapPlaceSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.sessionStorage.clear();
    fetchPlaces.mockReset();
    fetchPlaces.mockResolvedValue({ answer: { places: [recife, boaViagem, avenue], coveredStates: ["PE"], attribution: "IBGE" }, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("searches every kind at once and groups the results with their kind", async () => {
    const { input } = renderSearch();
    await type(input, "boa");
    const list = await screen.findByRole("listbox", { name: "Buscar lugar no mapa" });
    expect(fetchPlaces.mock.calls[0][0]).toMatchObject({ kind: null, text: "boa" });
    expect(within(list).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Recife, PE",
      "Boa Viagem, Recife, PE",
      "Avenida Boa Viagem, Boa Viagem, Recife, PE",
    ]);
    expect(list.textContent).toContain("Cidades");
    expect(list.textContent).toContain("Bairros");
    expect(list.textContent).toContain("Ruas");
  });

  it("hands the chosen place over and remembers it for the workspace", async () => {
    const { input, onSelect } = renderSearch();
    await type(input, "boa");
    await screen.findByRole("option", { name: /^Recife/ });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(boaViagem);
    expect(input).toHaveValue("Boa Viagem, Recife, PE");
    expect(JSON.parse(window.sessionStorage.getItem("vozko:recent-places:ws1") ?? "[]")).toHaveLength(1);
  });

  it("offers the recent places when the field is empty", async () => {
    window.sessionStorage.setItem("vozko:recent-places:ws1", JSON.stringify([recife]));
    const { input } = renderSearch();
    fireEvent.focus(input);
    const list = await screen.findByRole("listbox", { name: "Buscar lugar no mapa" });
    expect(list.textContent).toContain("Recentes");
    expect(within(list).getByRole("option").textContent).toBe("Recife, PE");
    expect(fetchPlaces).not.toHaveBeenCalled();
  });

  it("offers to filter by a chosen city or bairro, never by a street", async () => {
    const onFilter = vi.fn();
    const { input } = renderSearch({ onFilter });
    await type(input, "boa");
    fireEvent.click(await screen.findByRole("option", { name: /^Boa Viagem/ }));
    fireEvent.click(screen.getByRole("button", { name: "Filtrar por este lugar: Boa Viagem, Recife, PE" }));
    expect(onFilter).toHaveBeenCalledWith(boaViagem);

    await type(input, "aven");
    fireEvent.click(await screen.findByRole("option", { name: /^Avenida/ }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Filtrar por este lugar/ })).toBeNull());
  });

  it("hides the filter action once that place is already in the filter", async () => {
    const onFilter = vi.fn();
    const { input } = renderSearch({ onFilter, filter: placeFilterOf(boaViagem) ?? undefined });
    await type(input, "boa");
    fireEvent.click(await screen.findByRole("option", { name: /^Boa Viagem/ }));
    expect(screen.queryByRole("button", { name: /Filtrar por este lugar/ })).toBeNull();
    await type(input, "rec");
    fireEvent.click(await screen.findByRole("option", { name: /^Recife/ }));
    expect(screen.getByRole("button", { name: "Filtrar por este lugar: Recife, PE" })).toBeInTheDocument();
  });

  it("exports the filter helper the map wires to the lead filter", () => {
    const filter = placeFilterOf(boaViagem);
    expect(filter && readSet(filter, LEAD_FILTER_FIELD.district)).toEqual(["pe:recife/boa viagem"]);
  });
});
