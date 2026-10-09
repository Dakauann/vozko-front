import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const pinLeadAddressAction = vi.fn();
vi.mock("@/app/actions/leads", () => ({ pinLeadAddressAction: (...args: unknown[]) => pinLeadAddressAction(...args) }));
vi.mock("@/app/actions/cep", () => ({ searchCepAction: vi.fn() }));
const fetchLeadMapViewport = vi.fn();
const fetchReferencePoint = vi.fn();
vi.mock("@/app/actions/lead-map", () => ({
  fetchLeadMapViewport: (...args: unknown[]) => fetchLeadMapViewport(...args),
  fetchReferencePoint: (...args: unknown[]) => fetchReferencePoint(...args),
}));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws1" } }) }));
const mounts = { count: 0 };
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/maps/MiniMap", () => ({
  MiniMap: function StubMiniMap({
    position,
    draggable,
    interactive,
    zoom,
    onPinMoved,
  }: {
    position: { lat: number; lng: number } | null;
    draggable?: boolean;
    interactive?: boolean;
    zoom?: number;
    onPinMoved?: (position: { lat: number; lng: number }) => void;
  }) {
    const [mount] = useState(() => ++mounts.count);
    return (
      <button
        type="button"
        data-testid="mini-map"
        data-mount={mount}
        data-position={position ? `${position.lat},${position.lng}` : ""}
        data-draggable={draggable ? "true" : "false"}
        data-interactive={interactive ? "true" : "false"}
        data-zoom={zoom ?? ""}
        onClick={() => onPinMoved?.({ lat: -23.5615, lng: -46.656 })}
      >
        mapa
      </button>
    );
  },
}));

import { SectionError } from "@/lib/analytics/section-query";
import { emptyLeadDraft, type AddressDraft, type LeadSheetDraft } from "@/lib/leads/sheet";
import type { LeadRecord } from "@/lib/leads/types";

import { AddressesSection } from "../sheet/AddressesSection";

const saved: AddressDraft = {
  key: "k1",
  id: "a1",
  label: "home",
  primary: true,
  zipCode: "01310-100",
  street: "Av. Paulista",
  number: "1000",
  complement: "",
  district: "Bela Vista",
  city: "São Paulo",
  state: "SP",
  cityCode: "3550308",
};

const unsaved: AddressDraft = { ...saved, key: "k2", id: undefined, primary: false };

const CEP_POINT = { position: { lat: -23.5614, lng: -46.6559 }, precision: "street", attribution: "IBGE, CNEFE 2022" };

function renderSection(
  pin: Parameters<typeof AddressesSection>[0]["pin"],
  addresses: AddressDraft[] = [saved],
  more: { base?: LeadRecord; onUpdate?: (update: (draft: LeadSheetDraft) => LeadSheetDraft) => void } = {},
) {
  const draft: LeadSheetDraft = { ...emptyLeadDraft(), addresses };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <AddressesSection draft={draft} base={more.base} errors={{}} editable onUpdate={more.onUpdate ?? vi.fn()} pin={pin} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return draft;
}

function pinnedLead(positionSource: string): LeadRecord {
  return {
    id: "l1",
    workspaceId: "ws1",
    number: "5511987654321",
    name: "Ana",
    blocked: false,
    relativesCount: 0,
    referredCount: 0,
    version: 3,
    addresses: [
      {
        id: "a1",
        label: "home",
        primary: true,
        zipCode: saved.zipCode,
        street: saved.street,
        number: saved.number,
        district: saved.district,
        city: saved.city,
        state: saved.state,
        cityCode: saved.cityCode,
        geoStatus: "located",
        positionSource,
        latitude: -23.5614,
        longitude: -46.6559,
      },
    ],
  };
}

describe("AddressesSection keeping a hand-placed pin", () => {
  const movedText: AddressDraft = { ...saved, number: "1200" };

  it("offers to keep the pin once the text of a hand-placed address changed, and records the choice", () => {
    const onUpdate = vi.fn();
    const draft = renderSection(undefined, [movedText], { base: pinnedLead("manual"), onUpdate });
    expect(screen.getByText("O endereço mudou. Ao salvar, a posição marcada à mão volta a ser calculada, a não ser que você a mantenha.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Manter a posição do alfinete" }));
    const update = onUpdate.mock.calls[0][0] as (draft: LeadSheetDraft) => LeadSheetDraft;
    expect(update(draft).addresses[0]).toMatchObject({ key: "k1", keepPosition: true });
  });

  it("does not offer it while the address text is unchanged", () => {
    renderSection(undefined, [saved], { base: pinnedLead("lead_pin") });
    expect(screen.queryByRole("checkbox", { name: "Manter a posição do alfinete" })).not.toBeInTheDocument();
  });

  it("does not offer it for a position the server calculated", () => {
    renderSection(undefined, [movedText], { base: pinnedLead("reference") });
    expect(screen.queryByRole("checkbox", { name: "Manter a posição do alfinete" })).not.toBeInTheDocument();
  });
});

describe("AddressesSection pin editor", () => {
  beforeEach(() => {
    pinLeadAddressAction.mockReset();
    fetchLeadMapViewport.mockReset();
    fetchReferencePoint.mockReset();
    fetchReferencePoint.mockResolvedValue({ point: null, error: { code: "reference_not_loaded", status: 422 } });
    toast.success.mockReset();
    toast.error.mockReset();
  });

  it("shows a draggable pin at the saved position of a located address", () => {
    renderSection({ leadId: "l1", positions: { a1: { lat: -23.5614, lng: -46.6559, precision: "street" } }, onPinned: vi.fn() });
    const map = screen.getByTestId("mini-map");
    expect(map).toHaveAttribute("data-position", "-23.5614,-46.6559");
    expect(map).toHaveAttribute("data-draggable", "true");
    expect(screen.getByText("Posição no mapa")).toBeInTheDocument();
  });

  it("saves a moved pin through the pin route and hands back the record", async () => {
    const lead = { id: "l1", version: 4 };
    pinLeadAddressAction.mockResolvedValue({ lead, error: null });
    const onPinned = vi.fn();
    renderSection({ leadId: "l1", positions: { a1: { lat: -23.5614, lng: -46.6559 } }, onPinned });
    await act(async () => fireEvent.click(screen.getByTestId("mini-map")));
    expect(pinLeadAddressAction).toHaveBeenCalledWith("l1", "a1", { lat: -23.5615, lng: -46.656 });
    expect(onPinned).toHaveBeenCalledWith(lead);
    expect(toast.success).toHaveBeenCalledWith("Posição salva.");
  });

  it("says when the pin could not be saved and keeps the record", async () => {
    pinLeadAddressAction.mockResolvedValue({ lead: null, error: { code: "something_else", status: 500 } });
    const onPinned = vi.fn();
    renderSection({ leadId: "l1", positions: { a1: { lat: -23.5614, lng: -46.6559 } }, onPinned });
    await act(async () => fireEvent.click(screen.getByTestId("mini-map")));
    expect(onPinned).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar a posição.");
  });

  it("puts the pin back where it was saved when the server refuses the move", async () => {
    pinLeadAddressAction.mockResolvedValue({ lead: null, error: { code: "lead_location_invalid", status: 400 } });
    renderSection({ leadId: "l1", positions: { a1: { lat: -23.5614, lng: -46.6559 } }, onPinned: vi.fn() });
    const before = screen.getByTestId("mini-map").getAttribute("data-mount");
    await act(async () => fireEvent.click(screen.getByTestId("mini-map")));
    const map = screen.getByTestId("mini-map");
    expect(map.getAttribute("data-mount")).not.toBe(before);
    expect(map).toHaveAttribute("data-position", "-23.5614,-46.6559");
  });

  it.each([
    ["lead_location_invalid", "A posição precisa ficar dentro do Brasil. Arraste o marcador de volta."],
    ["lead_address_not_found", "Este endereço não existe mais neste lead. Feche e abra o lead de novo."],
    ["forbidden", "Você não tem permissão para mudar a posição deste endereço."],
  ])("explains the %s refusal", async (code, message) => {
    pinLeadAddressAction.mockResolvedValue({ lead: null, error: { code, status: 400 } });
    renderSection({ leadId: "l1", positions: { a1: { lat: -23.5614, lng: -46.6559 } }, onPinned: vi.fn() });
    await act(async () => fireEvent.click(screen.getByTestId("mini-map")));
    expect(toast.error).toHaveBeenCalledWith(message);
  });

  it("lets the viewer place the pin of an address not located yet, starting where the workspace leads are", async () => {
    fetchLeadMapViewport.mockResolvedValue({ bbox: { south: -23.7, west: -46.8, north: -23.5, east: -46.6 }, basis: "located", view: "positions" });
    pinLeadAddressAction.mockResolvedValue({ lead: { id: "l1", version: 2 }, error: null });
    renderSection({ leadId: "l1", positions: { a1: null }, onPinned: vi.fn() });
    const map = await screen.findByTestId("mini-map");
    expect(map).toHaveAttribute("data-position", "-23.6,-46.7");
    expect(map).toHaveAttribute("data-interactive", "true");
    expect(map).toHaveAttribute("data-draggable", "true");
    expect(screen.getByText("Este endereço ainda não foi localizado. Aproxime o mapa e toque na casa, ou arraste o marcador até ela.")).toBeInTheDocument();
    await act(async () => fireEvent.click(map));
    expect(pinLeadAddressAction).toHaveBeenCalledWith("l1", "a1", { lat: -23.5615, lng: -46.656 });
  });

  it("starts over Brazil when the workspace map cannot say where its leads are", async () => {
    fetchLeadMapViewport.mockRejectedValue(new SectionError("off", 503, "lead_map_unavailable"));
    renderSection({ leadId: "l1", positions: { a1: null }, onPinned: vi.fn() });
    const map = await screen.findByTestId("mini-map");
    const [lat, lng] = (map.getAttribute("data-position") ?? "").split(",").map(Number);
    expect(lat).toBeCloseTo(-14.25);
    expect(lng).toBeCloseTo(-51.45);
    expect(map).toHaveAttribute("data-interactive", "true");
  });

  it("asks to save the lead first for an address the server has not stored and whose CEP has no point", async () => {
    renderSection({ leadId: "l1", positions: {}, onPinned: vi.fn() }, [unsaved]);
    expect(await screen.findByText("Salve o lead para posicionar este endereço no mapa.")).toBeInTheDocument();
    expect(fetchReferencePoint).toHaveBeenCalledWith({ zipCode: "01310100" }, expect.anything());
    expect(screen.queryByTestId("mini-map")).not.toBeInTheDocument();
  });

  it("starts the pin of an address not located yet at its CEP point", async () => {
    fetchReferencePoint.mockResolvedValue({ point: CEP_POINT, error: null });
    fetchLeadMapViewport.mockResolvedValue({ bbox: { south: -23.7, west: -46.8, north: -23.5, east: -46.6 }, basis: "located", view: "positions" });
    renderSection({ leadId: "l1", positions: { a1: null }, onPinned: vi.fn() });
    const map = await screen.findByTestId("mini-map");
    expect(map).toHaveAttribute("data-position", "-23.5614,-46.6559");
    expect(map).toHaveAttribute("data-zoom", "15");
    expect(map).toHaveAttribute("data-draggable", "true");
    expect(screen.getByText("Este endereço ainda não foi localizado. O marcador começa no ponto do CEP: arraste até a casa.")).toBeInTheDocument();
  });

  it("previews the CEP point of an address not saved yet, without a draggable pin", async () => {
    fetchReferencePoint.mockResolvedValue({ point: CEP_POINT, error: null });
    renderSection({ leadId: "l1", positions: {}, onPinned: vi.fn() }, [unsaved]);
    const map = await screen.findByTestId("mini-map");
    expect(map).toHaveAttribute("data-position", "-23.5614,-46.6559");
    expect(map).toHaveAttribute("data-draggable", "false");
    expect(map).toHaveAttribute("data-interactive", "false");
    expect(screen.getByText("Ponto aproximado do CEP (fonte: IBGE, CNEFE 2022). Salve o lead para ajustar o marcador na casa.")).toBeInTheDocument();
    await act(async () => fireEvent.click(map));
    expect(pinLeadAddressAction).not.toHaveBeenCalled();
  });

  it("previews the CEP point on a new lead", async () => {
    fetchReferencePoint.mockResolvedValue({ point: CEP_POINT, error: null });
    renderSection({ leadId: null, positions: {}, onPinned: vi.fn() }, [unsaved]);
    expect(await screen.findByTestId("mini-map")).toHaveAttribute("data-position", "-23.5614,-46.6559");
  });

  it("asks nothing while the CEP is incomplete", () => {
    renderSection({ leadId: null, positions: {}, onPinned: vi.fn() }, [{ ...unsaved, zipCode: "0131" }]);
    expect(fetchReferencePoint).not.toHaveBeenCalled();
    expect(screen.getByText("Salve o lead para posicionar este endereço no mapa.")).toBeInTheDocument();
  });

  it("shows no pin editor without the pin capability", () => {
    renderSection(undefined);
    expect(screen.queryByTestId("mini-map")).not.toBeInTheDocument();
    expect(screen.queryByText("Posição no mapa")).not.toBeInTheDocument();
  });
});
