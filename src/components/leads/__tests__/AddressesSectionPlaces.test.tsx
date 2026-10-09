import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

vi.mock("@/app/actions/leads", () => ({ pinLeadAddressAction: vi.fn() }));
const searchCepAction = vi.fn();
vi.mock("@/app/actions/cep", () => ({ searchCepAction: (...args: unknown[]) => searchCepAction(...args) }));
const fetchReferencePoint = vi.fn();
const fetchLeadMapViewport = vi.fn();
vi.mock("@/app/actions/lead-map", () => ({
  fetchLeadMapViewport: (...args: unknown[]) => fetchLeadMapViewport(...args),
  fetchReferencePoint: (...args: unknown[]) => fetchReferencePoint(...args),
}));
const fetchPlaces = vi.fn();
vi.mock("@/app/actions/places", () => ({ fetchPlaces: (...args: unknown[]) => fetchPlaces(...args) }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws1" } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/maps/MiniMap", () => ({
  MiniMap: function StubMiniMap({
    position,
    draggable,
    onPinMoved,
  }: {
    position: { lat: number; lng: number } | null;
    draggable?: boolean;
    onPinMoved?: (position: { lat: number; lng: number }) => void;
  }) {
    return (
      <button
        type="button"
        data-testid="mini-map"
        data-position={position ? `${position.lat},${position.lng}` : ""}
        data-draggable={draggable ? "true" : "false"}
        onClick={() => onPinMoved?.({ lat: -8.0911, lng: -34.8812 })}
      >
        mapa
      </button>
    );
  },
}));

import { emptyLeadDraft, type AddressDraft, type LeadSheetDraft } from "@/lib/leads/sheet";
import type { Place } from "@/lib/maps/places";

import { AddressesSection, type AddressPinEditor } from "../sheet/AddressesSection";

const blank: AddressDraft = {
  key: "k1",
  label: "home",
  primary: true,
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "PE",
  cityCode: "",
};

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
  bounds: null,
  addressCount: 700,
  zipCount: 0,
};

const boaHora: Place = {
  ...recife,
  kind: "street",
  label: "Rua Boa Hora, Pina, Recife, PE",
  name: "Rua Boa Hora",
  street: "Rua Boa Hora",
  district: "Pina",
  districtPair: "pe:recife/pina",
  zipCode: "51030300",
  zipCount: 1,
  position: { lat: -8.09, lng: -34.88 },
  precision: "street",
};

const latest: { draft: LeadSheetDraft | null } = { draft: null };

function Harness({ address, pin }: { address: AddressDraft; pin?: AddressPinEditor }) {
  const [draft, setDraft] = useState<LeadSheetDraft>({ ...emptyLeadDraft(), addresses: [address] });
  return (
    <AddressesSection
      draft={draft}
      errors={{}}
      editable
      onUpdate={(update) =>
        setDraft((current) => {
          const next = update(current);
          latest.draft = next;
          return next;
        })
      }
      pin={pin}
    />
  );
}

function renderHarness(address: AddressDraft, pin?: AddressPinEditor) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <Harness address={address} pin={pin} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function answer(places: Place[]) {
  return { answer: { places, coveredStates: ["PE"], attribution: "IBGE, CNEFE 2022" }, error: null };
}

async function settle() {
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
}

describe("AddressesSection place suggestions", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchPlaces.mockReset();
    searchCepAction.mockReset();
    fetchReferencePoint.mockReset();
    fetchLeadMapViewport.mockReset();
    fetchReferencePoint.mockResolvedValue({ point: null, error: { code: "reference_point_not_found" } });
    fetchLeadMapViewport.mockResolvedValue({ bbox: { south: -8.2, west: -35, north: -7.9, east: -34.8 }, basis: "located", view: "positions" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("suggests cities of the chosen UF and fills the city with its code from the keyboard", async () => {
    fetchPlaces.mockResolvedValue(answer([recife]));
    renderHarness(blank);
    const city = screen.getByRole("combobox", { name: "Cidade" });
    fireEvent.focus(city);
    fireEvent.change(city, { target: { value: "rec" } });
    await settle();
    await waitFor(() => expect(screen.getByRole("listbox", { name: "Cidades sugeridas" })).toBeVisible());
    expect(fetchPlaces.mock.calls[0][0]).toMatchObject({ kind: "city", text: "rec", state: "PE" });
    fireEvent.keyDown(city, { key: "ArrowDown" });
    expect(city).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: /Recife/ }).id);
    fireEvent.keyDown(city, { key: "Enter" });
    expect(latest.draft?.addresses[0]).toMatchObject({ city: "Recife", state: "PE", cityCode: "2611606" });
    expect(city).toHaveAttribute("aria-expanded", "false");
  });

  it("asks for streets only inside the chosen city", async () => {
    renderHarness(blank);
    const street = screen.getByRole("combobox", { name: "Logradouro" });
    fireEvent.focus(street);
    fireEvent.change(street, { target: { value: "boa" } });
    await settle();
    expect(fetchPlaces).not.toHaveBeenCalled();
  });

  it("fills CEP, bairro, city and UF from a street without asking the CEP again", async () => {
    fetchPlaces.mockResolvedValue(answer([boaHora]));
    renderHarness({ ...blank, city: "Recife", cityCode: "2611606", number: "120" });
    const street = screen.getByRole("combobox", { name: "Logradouro" });
    fireEvent.focus(street);
    fireEvent.change(street, { target: { value: "boa h" } });
    await settle();
    await waitFor(() => expect(screen.getByRole("option", { name: /Rua Boa Hora/ })).toBeInTheDocument());
    expect(fetchPlaces.mock.calls[0][0]).toMatchObject({ kind: "street", cityCode: "2611606" });
    fireEvent.click(screen.getByRole("option", { name: /Rua Boa Hora/ }));
    expect(latest.draft?.addresses[0]).toMatchObject({
      zipCode: "51030-300",
      street: "Rua Boa Hora",
      district: "Pina",
      city: "Recife",
      state: "PE",
      cityCode: "2611606",
      number: "120",
    });
    expect(searchCepAction).not.toHaveBeenCalled();
  });

  it("says when the state has no address base loaded", async () => {
    fetchPlaces.mockResolvedValue({ answer: null, error: { code: "reference_not_loaded", expected: { coveredStates: "DF,PE" } } });
    renderHarness({ ...blank, state: "SP" });
    const city = screen.getByRole("combobox", { name: "Cidade" });
    fireEvent.focus(city);
    fireEvent.change(city, { target: { value: "sao" } });
    await settle();
    await waitFor(() =>
      expect(screen.getByText("Este estado ainda não tem base de endereços carregada. Estados com base: DF, PE.")).toBeInTheDocument(),
    );
  });
});

describe("AddressesSection pin before saving", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchPlaces.mockReset();
    fetchReferencePoint.mockReset();
    fetchLeadMapViewport.mockReset();
    fetchReferencePoint.mockResolvedValue({ point: { position: { lat: -8.1, lng: -34.89 }, precision: "postal_code", attribution: "IBGE, CNEFE 2022" }, error: null });
    fetchLeadMapViewport.mockResolvedValue({ bbox: { south: -8.2, west: -35, north: -7.9, east: -34.8 }, basis: "located", view: "positions" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const placer: AddressPinEditor = { leadId: null, canPlace: true, positions: {}, onPinned: vi.fn() };

  it("lets someone who can place pins drag the pin of a new address, starting at its CEP point", async () => {
    renderHarness({ ...blank, zipCode: "51020-230" }, placer);
    const map = await screen.findByTestId("mini-map");
    expect(map).toHaveAttribute("data-draggable", "true");
    expect(map).toHaveAttribute("data-position", "-8.1,-34.89");
    fireEvent.click(map);
    expect(latest.draft?.addresses[0].pin).toEqual({ lat: -8.0911, lng: -34.8812 });
    expect(screen.getByText(ptMessages.leadSheet.addresses.pin.unsavedMoved)).toBeInTheDocument();
  });

  it("moves the pin to the chosen street unless it was moved by hand", async () => {
    fetchPlaces.mockResolvedValue(answer([boaHora]));
    renderHarness({ ...blank, city: "Recife", cityCode: "2611606" }, placer);
    const street = screen.getByRole("combobox", { name: "Logradouro" });
    fireEvent.focus(street);
    fireEvent.change(street, { target: { value: "boa" } });
    await settle();
    fireEvent.click(await screen.findByRole("option", { name: /Rua Boa Hora/ }));
    await waitFor(() => expect(screen.getByTestId("mini-map")).toHaveAttribute("data-position", "-8.09,-34.88"));
    fireEvent.click(screen.getByTestId("mini-map"));
    expect(screen.getByTestId("mini-map")).toHaveAttribute("data-position", "-8.0911,-34.8812");
    fireEvent.click(screen.getByRole("button", { name: ptMessages.leadSheet.addresses.pin.unsavedReset }));
    expect(screen.getByTestId("mini-map")).toHaveAttribute("data-position", "-8.09,-34.88");
    expect(latest.draft?.addresses[0].pin).toBeUndefined();
  });

  it("keeps a fixed preview for someone who cannot place pins", async () => {
    renderHarness({ ...blank, zipCode: "51020-230" }, { ...placer, canPlace: false });
    const map = await screen.findByTestId("mini-map");
    expect(map).toHaveAttribute("data-draggable", "false");
  });
});
