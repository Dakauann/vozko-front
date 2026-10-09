import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const actions = {
  fetchLeadMapSummary: vi.fn(),
  fetchLeadMapViewport: vi.fn(),
  fetchLeadMapDistricts: vi.fn(),
  fetchLeadMapLayer: vi.fn(),
  fetchLeadMapPoint: vi.fn(),
  listLeadAreas: vi.fn(),
  createLeadAreaAction: vi.fn(),
  fetchLeadMapLeftOut: vi.fn(),
  updateLeadAreaAction: vi.fn(),
  deleteLeadAreaAction: vi.fn(),
};
vi.mock("@/app/actions/lead-map", () => ({
  fetchLeadMapSummary: (...args: unknown[]) => actions.fetchLeadMapSummary(...args),
  fetchLeadMapViewport: (...args: unknown[]) => actions.fetchLeadMapViewport(...args),
  fetchLeadMapDistricts: (...args: unknown[]) => actions.fetchLeadMapDistricts(...args),
  fetchLeadMapLayer: (...args: unknown[]) => actions.fetchLeadMapLayer(...args),
  fetchLeadMapPoint: (...args: unknown[]) => actions.fetchLeadMapPoint(...args),
  listLeadAreas: (...args: unknown[]) => actions.listLeadAreas(...args),
  createLeadAreaAction: (...args: unknown[]) => actions.createLeadAreaAction(...args),
  fetchLeadMapLeftOut: (...args: unknown[]) => actions.fetchLeadMapLeftOut(...args),
  updateLeadAreaAction: (...args: unknown[]) => actions.updateLeadAreaAction(...args),
  deleteLeadAreaAction: (...args: unknown[]) => actions.deleteLeadAreaAction(...args),
}));
const fetchLeadSection = vi.fn();
const getLeadByIdAction = vi.fn();
vi.mock("@/app/actions/leads", () => ({
  fetchLeadSection: (...args: unknown[]) => fetchLeadSection(...args),
  getLeadByIdAction: (...args: unknown[]) => getLeadByIdAction(...args),
}));
const navigation = vi.hoisted(() => ({ search: "view=map", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
  usePathname: () => "/dashboard/leads",
  useRouter: () => ({ replace: navigation.replace }),
}));
const placeSearch = vi.hoisted(() => ({ props: null as null | { onSelect: (place: unknown) => void; onFilter?: (place: unknown) => void } }));
vi.mock("@/components/maps/MapPlaceSearch", async () => {
  const places = await vi.importActual<typeof import("@/lib/maps/places")>("@/lib/maps/places");
  return {
    placeFilterOf: places.placeFilterOf,
    MapPlaceSearch: (props: { onSelect: (place: unknown) => void; onFilter?: (place: unknown) => void }) => {
      placeSearch.props = props;
      return <div data-testid="place-search" />;
    },
  };
});
const sendGate = vi.hoisted(() => ({
  current: { send_template: { enabled: true }, send_message: { enabled: true } } as Record<string, { enabled: boolean; reason?: string }>,
}));
vi.mock("@/components/leads/sends/use-lead-send-gate", () => ({ useLeadSendGate: () => sendGate.current }));
const sendDialog = vi.hoisted(() => ({ props: null as null | { action: string; selection: unknown; size: number; onClose: () => void } }));
vi.mock("@/components/leads/sends/LeadSendDialog", () => ({
  LeadSendDialog: (props: { action: string; selection: unknown; size: number; onClose: () => void }) => {
    sendDialog.props = props;
    return <div data-testid="send-dialog" />;
  },
}));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws1" } }) }));
const onScreen = { current: true };
vi.mock("@/hooks/use-in-view", () => ({ useInView: () => [() => undefined, onScreen.current] }));
vi.mock("@/components/leads/LeadCall", () => ({ LeadCallButton: () => null }));
vi.mock("@/components/leads/sends/LeadSendButton", () => ({ LeadSendButton: () => null }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

interface StubProps {
  mode?: string;
  coloured?: boolean;
  allSelected?: boolean;
  toolsBesidePanel?: boolean;
  selectedPointIds?: readonly string[];
  areas?: unknown;
  bounds?: unknown;
  goTo?: unknown;
  placeMarker?: unknown;
  tools?: ReactNode;
  onUserPan?: () => void;
  layer?: unknown;
  onViewportChange?: (viewport: unknown) => void;
  onPointClick?: (point: unknown, at: { x: number; y: number }) => void;
  onPointShiftClick?: (point: unknown) => void;
  onDistrictClick?: (district: unknown) => void;
  onAreaDrawn?: (area: unknown) => void;
  children?: ReactNode;
}
const mapProps: { current: StubProps } = { current: {} };
vi.mock("@/components/maps/LeadMap", () => ({
  LeadMap: (props: StubProps) => {
    mapProps.current = props;
    return (
      <div data-testid="lead-map" data-view={props.mode} data-coloured={String(props.coloured ?? false)} data-selected={(props.selectedPointIds ?? []).join(",")}>
        {props.tools}
        {props.children}
      </div>
    );
  },
}));

import { SectionError } from "@/lib/analytics/section-query";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import { LEAD_FILTER_FIELD, emptyLeadFilter, readBoolean, readSet, withSet, type LeadFilter } from "@/lib/leads/filters";
import type { MapPicks } from "@/lib/leads/map-view";
import { snapViewport } from "@/lib/maps/tiles";

import { LeadsMapView } from "../LeadsMapView";

const SUMMARY = { total: 7942, onMap: 5214, approximate: 1611, withoutAddress: 1117, notFound: 214, pending: 96, quotaExceeded: 0, refused: 0 };
const VIEWPORT = { bbox: { south: -23.7, west: -46.8, north: -23.4, east: -46.4 }, basis: "located", view: "positions" };
const DISTRICTS = [{ pair: "3550308/centro", cityKey: "3550308", districtKey: "centro", name: "Centro", lat: -23.55, lng: -46.63, count: 291 }];
const POINT = { id: "-23.55,-46.63", lat: -23.55, lng: -46.63, precision: "exact", placement: "on_map", tone: "chart-2", count: 2, leadIds: ["l1", "l2"] };
const NEAR = { id: "approximate:-23.55,-46.63", lat: -23.55, lng: -46.63, precision: "district", placement: "approximate", tone: "neutral", count: 3, leadIds: ["l7", "l8", "l9"] };
const PLACE = {
  kind: "street",
  label: "Rua Grande, Centro, Santo Antônio, RN",
  name: "Rua Grande",
  zipCode: "",
  street: "Rua Grande",
  district: "Centro",
  city: "Santo Antônio",
  cityCode: "2411403",
  cityKey: "rn:santo antonio",
  districtPair: "rn:santo antonio/centro",
  state: "RN",
  position: { lat: -6.3104, lng: -35.4793 },
  precision: "street",
  bounds: null,
  addressCount: 12,
  zipCount: 1,
};
const AREA = {
  id: "a1",
  name: "Região Norte",
  visibility: "private",
  ownerId: "u1",
  canEdit: true,
  shape: { kind: "circle", center: { lat: -23.5, lng: -46.6 }, radiusM: 1500 },
  createdAt: "",
  updatedAt: "",
};

const classification: CustomFieldDefinition = {
  id: "f1",
  workspaceId: "ws1",
  objectType: "lead",
  key: "interesse",
  label: "Interesse",
  type: "select",
  options: ["Matriculado", "Interessado"],
  optionTones: { Matriculado: "chart-2" },
  required: false,
  sensitive: false,
  role: "classification",
  position: 1,
  readable: true,
  createdAt: "",
  updatedAt: "",
};

const stage: CustomFieldDefinition = { ...classification, id: "f2", key: "etapa", label: "Etapa", role: undefined, position: 2 };

function renderView(props: Partial<Parameters<typeof LeadsMapView>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const handlers = {
    onFilterChange: vi.fn(),
    onShowTable: vi.fn(),
    onImport: vi.fn(),
    onCreateLead: vi.fn(),
    onPicksChange: vi.fn(),
    selectionBar: vi.fn(({ total, inArea }: { total: number | null; inArea: boolean }) => (
      <span>{`barra ${total ?? "sem total"} ${inArea ? "na área" : "fora de área"}`}</span>
    )),
  };
  function Harness(extra: Partial<Parameters<typeof LeadsMapView>[0]>) {
    return (
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
          <LeadsMapView
            filter={emptyLeadFilter}
            search=""
            areas={[]}
            picks={{}}
            classification={classification}
            fields={[classification, stage]}
            canCreateLead
            {...handlers}
            {...props}
            {...extra}
          />
        </NextIntlClientProvider>
      </QueryClientProvider>
    );
  }
  const view = render(<Harness />);
  return { ...handlers, rerender: (extra: Partial<Parameters<typeof LeadsMapView>[0]>) => view.rerender(<Harness {...extra} />) };
}

function moveTo(zoom: number) {
  const viewport = snapViewport({ bbox: { south: -23.6, west: -46.7, north: -23.5, east: -46.6 }, zoom });
  act(() => mapProps.current.onViewportChange?.(viewport));
  return viewport;
}

describe("LeadsMapView", () => {
  beforeEach(() => {
    onScreen.current = true;
    mapProps.current = {};
    Object.values(actions).forEach((mock) => mock.mockReset());
    Object.values(toast).forEach((mock) => mock.mockReset());
    navigation.search = "view=map";
    navigation.replace.mockReset();
    getLeadByIdAction.mockReset();
    sendDialog.props = null;
    sendGate.current = { send_template: { enabled: true }, send_message: { enabled: true } };
    actions.fetchLeadMapLeftOut.mockResolvedValue({ total: 0, filter: null, districts: [] });
    fetchLeadSection.mockReset().mockResolvedValue({ classification: { key: "interesse", values: { Matriculado: 612, Interessado: 301 } } });
    actions.fetchLeadMapSummary.mockResolvedValue(SUMMARY);
    actions.fetchLeadMapViewport.mockResolvedValue(VIEWPORT);
    actions.fetchLeadMapDistricts.mockResolvedValue(DISTRICTS);
    actions.fetchLeadMapLayer.mockResolvedValue({ kind: "points", points: [POINT] });
  });

  it("loads nothing until the map is on screen", () => {
    onScreen.current = false;
    renderView();
    expect(actions.fetchLeadMapSummary).not.toHaveBeenCalled();
    expect(actions.fetchLeadMapViewport).not.toHaveBeenCalled();
    expect(actions.fetchLeadMapDistricts).not.toHaveBeenCalled();
    expect(actions.fetchLeadMapLayer).not.toHaveBeenCalled();
    expect(fetchLeadSection).not.toHaveBeenCalled();
  });

  it("frames the map where the server says the leads are", async () => {
    renderView();
    await waitFor(() => expect(mapProps.current.bounds).toEqual(VIEWPORT.bbox));
    expect(screen.getByTestId("lead-map")).toHaveAttribute("data-view", "points");
    expect(mapProps.current.toolsBesidePanel).toBe(true);
  });

  it("opens Calor while the server answers cells, and Pontos when it answers points", async () => {
    actions.fetchLeadMapLayer.mockResolvedValue({ kind: "cells", cellSizeDegrees: 0.1, cells: [{ ix: 1, iy: 1, placement: "on_map", count: 4, lat: -23.5, lng: -46.6 }] });
    renderView();
    await screen.findByTestId("lead-map");
    moveTo(8);
    await waitFor(() => expect(screen.getByTestId("lead-map")).toHaveAttribute("data-view", "heat"));
    expect(within(screen.getByRole("group", { name: "Camada do mapa" })).getByRole("button", { name: "Calor" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the layer the person chose, read from the address", async () => {
    navigation.search = "view=map&layer=points";
    actions.fetchLeadMapLayer.mockResolvedValue({ kind: "cells", cellSizeDegrees: 0.1, cells: [] });
    actions.fetchLeadMapViewport.mockResolvedValue({ ...VIEWPORT, view: "districts" });
    renderView();
    await screen.findByTestId("lead-map");
    moveTo(8);
    await waitFor(() => expect(actions.fetchLeadMapLayer).toHaveBeenCalled());
    expect(screen.getByTestId("lead-map")).toHaveAttribute("data-view", "points");
  });

  it("stores the chosen layer in the address", async () => {
    navigation.search = "view=map&focus=l1";
    getLeadByIdAction.mockReturnValue(new Promise(() => undefined));
    renderView();
    await screen.findByTestId("lead-map");
    fireEvent.click(within(screen.getByRole("group", { name: "Camada do mapa" })).getByRole("button", { name: "Calor" }));
    expect(navigation.replace).toHaveBeenCalledWith("/dashboard/leads?view=map&focus=l1&layer=heat", { scroll: false });
  });

  it("opens on the bairro circles when the server says few leads pin a house", async () => {
    actions.fetchLeadMapViewport.mockResolvedValue({ ...VIEWPORT, view: "districts" });
    renderView();
    await waitFor(() => expect(screen.getByTestId("lead-map")).toHaveAttribute("data-view", "districts"));
  });

  it("asks for the layer of each settled viewport, coloured by the classification", async () => {
    renderView();
    await screen.findByTestId("lead-map");
    const viewport = moveTo(13.4);
    await waitFor(() => expect(actions.fetchLeadMapLayer).toHaveBeenCalled());
    expect(actions.fetchLeadMapLayer).toHaveBeenCalledWith({ filter: emptyLeadFilter, q: "" }, { viewport, colorBy: "interesse" }, expect.anything());
  });

  it("stores the colour choice in the address and stops colouring for Nenhum", async () => {
    renderView();
    await screen.findByTestId("lead-map");
    expect(screen.getByTestId("lead-map")).toHaveAttribute("data-coloured", "true");
    fireEvent.keyDown(screen.getByRole("button", { name: "Colorir por: Interesse" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Nenhum" }));
    expect(navigation.replace).toHaveBeenCalledWith("/dashboard/leads?view=map&color=none", { scroll: false });
  });

  it("draws every precise lead in one colour when the address says Nenhum", async () => {
    navigation.search = "view=map&color=none";
    renderView();
    await screen.findByTestId("lead-map");
    expect(screen.getByTestId("lead-map")).toHaveAttribute("data-coloured", "false");
    const viewport = moveTo(12);
    await waitFor(() => expect(actions.fetchLeadMapLayer).toHaveBeenCalledWith(expect.anything(), { viewport }, expect.anything()));
    expect(screen.queryByText("Colorido por Interesse")).not.toBeInTheDocument();
  });

  it("colours by another field from the address and counts its values in the panel", async () => {
    navigation.search = "view=map&color=etapa";
    fetchLeadSection.mockResolvedValue({ classification: { key: "etapa", values: { Matriculado: 40 } } });
    renderView();
    await screen.findByTestId("lead-map");
    const viewport = moveTo(12);
    await waitFor(() => expect(actions.fetchLeadMapLayer).toHaveBeenCalledWith(expect.anything(), { viewport, colorBy: "etapa" }, expect.anything()));
    expect(fetchLeadSection).toHaveBeenCalledWith("facets", expect.objectContaining({ colorBy: "etapa" }), expect.anything());
    expect(await screen.findByText("Colorido por Etapa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Colorir por: Etapa" })).toBeInTheDocument();
  });

  it("shows Por bairro from the address without asking for positions", async () => {
    navigation.search = "view=map&layer=districts";
    renderView();
    await screen.findByTestId("lead-map");
    expect(screen.getByTestId("lead-map")).toHaveAttribute("data-view", "districts");
    moveTo(12);
    await waitFor(() => expect(actions.fetchLeadMapDistricts).toHaveBeenCalled());
    expect(actions.fetchLeadMapLayer).not.toHaveBeenCalled();
  });

  it("keeps the basemap on day one and floats the counts and three ways to add addresses over it", async () => {
    actions.fetchLeadMapSummary.mockResolvedValue({ ...SUMMARY, onMap: 0, approximate: 0 });
    actions.fetchLeadMapDistricts.mockResolvedValue([]);
    const { onImport, onCreateLead } = renderView();
    expect(await screen.findByRole("heading", { name: "Nenhum lead no mapa ainda" })).toBeInTheDocument();
    expect(screen.getByTestId("lead-map")).toBeInTheDocument();
    expect(mapProps.current.bounds).toEqual(VIEWPORT.bbox);
    fireEvent.click(screen.getByRole("button", { name: /Importar endereços/ }));
    fireEvent.click(screen.getByRole("button", { name: /Cadastrar lead/ }));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onCreateLead).toHaveBeenCalledTimes(1);
  });

  it("asks the leads of the filter without an address for it through the template send", async () => {
    actions.fetchLeadMapSummary.mockResolvedValue({ ...SUMMARY, onMap: 0, approximate: 0 });
    actions.fetchLeadMapDistricts.mockResolvedValue([]);
    const filter = withSet(emptyLeadFilter, LEAD_FILTER_FIELD.city, ["sp:barueri"]);
    renderView({ filter, search: "maria" });
    fireEvent.click(await screen.findByRole("button", { name: /Pedir endereço pelo WhatsApp/ }));
    expect(screen.getByTestId("send-dialog")).toBeInTheDocument();
    const props = sendDialog.props!;
    expect(props.action).toBe("send_template");
    expect(props.size).toBe(SUMMARY.withoutAddress);
    const selection = props.selection as { mode: string; filter: LeadFilter };
    expect(selection.mode).toBe("all_matching");
    expect(readBoolean(selection.filter, LEAD_FILTER_FIELD.hasAddress)).toBe(false);
    expect(readSet(selection.filter, LEAD_FILTER_FIELD.city)).toEqual(["sp:barueri"]);
    act(() => props.onClose());
    expect(screen.queryByTestId("send-dialog")).not.toBeInTheDocument();
  });

  it("says why the address request is off when the template send is", async () => {
    sendGate.current = { send_template: { enabled: false, reason: "noOfficialNumber" }, send_message: { enabled: true } };
    actions.fetchLeadMapSummary.mockResolvedValue({ ...SUMMARY, onMap: 0, approximate: 0 });
    actions.fetchLeadMapDistricts.mockResolvedValue([]);
    renderView();
    const request = await screen.findByRole("button", { name: /Pedir endereço pelo WhatsApp/ });
    expect(request).toBeDisabled();
    expect(request).toHaveAccessibleDescription(ptMessages.leadSends.blockers.noOfficialNumber);
  });

  it("says nobody needs an address when every lead of the filter has one", async () => {
    actions.fetchLeadMapSummary.mockResolvedValue({ ...SUMMARY, onMap: 0, approximate: 0, withoutAddress: 0 });
    actions.fetchLeadMapDistricts.mockResolvedValue([]);
    renderView();
    const request = await screen.findByRole("button", { name: /Pedir endereço pelo WhatsApp/ });
    expect(request).toBeDisabled();
    expect(request).toHaveAccessibleDescription("Todos os leads deste filtro já têm endereço.");
  });

  it("explains why import and create are off for a viewer who cannot create leads", async () => {
    actions.fetchLeadMapSummary.mockResolvedValue({ ...SUMMARY, onMap: 0 });
    actions.fetchLeadMapDistricts.mockResolvedValue([]);
    renderView({ canCreateLead: false });
    const importButton = await screen.findByRole("button", { name: /Importar endereços/ });
    expect(importButton).toBeDisabled();
    expect(importButton).toHaveAccessibleDescription("Você não tem permissão para cadastrar leads.");
  });

  it("says the map is unavailable when the server has none", async () => {
    actions.fetchLeadMapSummary.mockRejectedValue(new SectionError("off", 503, "lead_map_unavailable"));
    renderView();
    expect(await screen.findByText("O mapa de leads está indisponível no momento. Tente de novo mais tarde.")).toBeInTheDocument();
  });

  it("saves a drawn area with a name in the viewer's locale and adds the Área chip", async () => {
    actions.createLeadAreaAction.mockResolvedValue({ area: AREA, error: null });
    const { onFilterChange } = renderView();
    await screen.findByTestId("lead-map");
    await act(async () => mapProps.current.onAreaDrawn?.(AREA.shape));
    expect(actions.createLeadAreaAction).toHaveBeenCalledWith({
      name: expect.stringMatching(/^Área desenhada em \d{2}\/\d{2}\/\d{4}/),
      visibility: "private",
      shape: AREA.shape,
    });
    const filter = onFilterChange.mock.calls[0][0] as LeadFilter;
    expect(readSet(filter, LEAD_FILTER_FIELD.area)).toEqual(["a1"]);
    expect(toast.success).toHaveBeenCalledWith("Área salva e aplicada ao filtro.");
  });

  it("explains a refused area and leaves the filter alone", async () => {
    actions.createLeadAreaAction.mockResolvedValue({ area: null, error: { code: "area_limit_reached", status: 400 } });
    const { onFilterChange } = renderView();
    await screen.findByTestId("lead-map");
    await act(async () => mapProps.current.onAreaDrawn?.(AREA.shape));
    expect(toast.error).toHaveBeenCalledWith("O workspace chegou ao limite de áreas salvas. Apague uma área antes de desenhar outra.");
    expect(onFilterChange).not.toHaveBeenCalled();
  });

  it("leaves the number of areas in a filter to the server", async () => {
    const ids = Array.from({ length: 20 }, (_, index) => `area-${index}`);
    actions.createLeadAreaAction.mockResolvedValue({ area: AREA, error: null });
    const { onFilterChange } = renderView({ filter: withSet(emptyLeadFilter, LEAD_FILTER_FIELD.area, ids) });
    await screen.findByTestId("lead-map");
    await act(async () => mapProps.current.onAreaDrawn?.(AREA.shape));
    expect(readSet(onFilterChange.mock.calls[0][0] as LeadFilter, LEAD_FILTER_FIELD.area)).toEqual([...ids, "a1"]);
  });

  it("says why the server refused the filter when it has too many areas", async () => {
    actions.fetchLeadMapViewport.mockRejectedValue(new SectionError("too many", 400, "area_too_many"));
    renderView();
    expect(await screen.findByText("Este filtro tem áreas demais. Tire uma área do filtro e tente de novo.")).toBeInTheDocument();
  });

  it("shows a failed viewport on the map with a retry instead of opening over Brazil in silence", async () => {
    actions.fetchLeadMapViewport.mockRejectedValue(new SectionError("bad", 400));
    renderView();
    expect(await screen.findByText("Não foi possível abrir o mapa neste filtro.")).toBeInTheDocument();
    expect(screen.getByTestId("lead-map")).toBeInTheDocument();
    actions.fetchLeadMapViewport.mockResolvedValue(VIEWPORT);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(mapProps.current.bounds).toEqual(VIEWPORT.bbox));
    expect(screen.queryByText("Não foi possível abrir o mapa neste filtro.")).not.toBeInTheDocument();
  });

  it("draws the map frame at once but asks for no layer until the server viewport settles", async () => {
    actions.fetchLeadMapViewport.mockReturnValue(new Promise(() => undefined));
    renderView();
    expect(await screen.findByTestId("lead-map")).toBeInTheDocument();
    moveTo(4);
    await waitFor(() => expect(actions.fetchLeadMapSummary).toHaveBeenCalled());
    expect(actions.fetchLeadMapLayer).not.toHaveBeenCalled();
  });

  it("fits the map to the leads a search finds, from the same viewport section", async () => {
    const { rerender } = renderView();
    await waitFor(() => expect(mapProps.current.bounds).toEqual(VIEWPORT.bbox));
    const santoAntonio = { south: -5.79, west: -35.21, north: -5.77, east: -35.2 };
    actions.fetchLeadMapViewport.mockResolvedValue({ ...VIEWPORT, bbox: santoAntonio });
    rerender({ search: "santo antonio" });
    await waitFor(() => expect(mapProps.current.bounds).toEqual(santoAntonio));
    expect(actions.fetchLeadMapViewport).toHaveBeenLastCalledWith(expect.objectContaining({ q: "santo antonio" }), expect.anything());
  });

  it("keeps the map on screen while a new filter asks for its viewport", async () => {
    const { rerender } = renderView();
    await screen.findByTestId("lead-map");
    actions.fetchLeadMapViewport.mockReturnValue(new Promise(() => undefined));
    rerender({ search: "maria" });
    expect(screen.getByTestId("lead-map")).toBeInTheDocument();
  });

  it("saves a radius area around a bairro chosen from the keyboard list", async () => {
    actions.createLeadAreaAction.mockResolvedValue({ area: AREA, error: null });
    renderView();
    const list = await screen.findByRole("list", { name: "Bairros do filtro" });
    fireEvent.click(within(list).getByRole("button", { name: /Centro/ }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "1 km" })));
    expect(actions.createLeadAreaAction).toHaveBeenCalledWith({
      name: "Raio de 1 km em Centro",
      visibility: "private",
      shape: { kind: "circle", center: { lat: -23.55, lng: -46.63 }, radiusM: 1000 },
    });
  });

  it("outlines every drawn area of the filter and names it in the panel", async () => {
    const north = AREA;
    const south = { ...AREA, id: "a2", name: "Região Sul", shape: { kind: "circle", center: { lat: -23.7, lng: -46.6 }, radiusM: 900 } };
    const filter = withSet(emptyLeadFilter, LEAD_FILTER_FIELD.area, ["a1", "a2"]);
    renderView({ filter, areas: [north, south] as never });
    await screen.findByTestId("lead-map");
    expect(mapProps.current.areas).toEqual([north.shape, south.shape]);
    expect(mapProps.current.allSelected).toBe(true);
    expect(await screen.findByText("leads em 2 áreas")).toBeInTheDocument();
    expect(screen.getByText("barra 7942 na área")).toBeInTheDocument();
  });

  it("lists the approximate leads the area left out, all of them or by bairro", async () => {
    const listed = { groups: [{ conjunction: "and" as const, predicates: [{ field: "area_approximate", operator: "in", values: ["a1"] }] }] };
    actions.fetchLeadMapLeftOut.mockResolvedValue({
      total: 37,
      filter: listed,
      districts: [{ pair: "3550308/se", cityKey: "3550308", districtKey: "se", name: "Sé", city: "São Paulo", state: "SP", count: 6 }],
    });
    const filter = withSet(emptyLeadFilter, LEAD_FILTER_FIELD.area, ["a1"]);
    const { onShowTable } = renderView({ filter, areas: [AREA] as never });
    expect(await screen.findByText("37 leads aproximados ficaram fora da área desenhada.")).toBeInTheDocument();
    expect(actions.fetchLeadMapLeftOut).toHaveBeenCalledWith({ filter, q: "" }, expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "Listar os 37 aproximados fora da área na tabela" }));
    expect(onShowTable).toHaveBeenLastCalledWith(listed);
    fireEvent.click(screen.getByRole("button", { name: "Ver por bairro" }));
    fireEvent.click(screen.getByRole("button", { name: "Listar na tabela os 6 aproximados de Sé fora da área" }));
    const byBairro = onShowTable.mock.calls.at(-1)?.[0] as LeadFilter;
    expect(readSet(byBairro, LEAD_FILTER_FIELD.district)).toEqual(["3550308/se"]);
    expect(readSet(byBairro, "area_approximate")).toEqual(["a1"]);
  });

  it("asks for no left-out count when no area narrows the filter", async () => {
    renderView();
    await screen.findByText("Fora do mapa neste filtro");
    expect(actions.fetchLeadMapLeftOut).not.toHaveBeenCalled();
  });

  it("applies, removes and forgets saved areas from the map", async () => {
    const other = { ...AREA, id: "a2", name: "Região Sul" };
    const filter = withSet(emptyLeadFilter, LEAD_FILTER_FIELD.area, ["a1"]);
    const { onFilterChange } = renderView({ filter, areas: [AREA, other] as never });
    fireEvent.click(await screen.findByRole("button", { name: "Áreas salvas: 2" }));
    fireEvent.click(await screen.findByRole("button", { name: "Aplicar Região Sul ao filtro" }));
    expect(readSet(onFilterChange.mock.calls.at(-1)?.[0] as LeadFilter, LEAD_FILTER_FIELD.area)).toEqual(["a1", "a2"]);
    fireEvent.click(screen.getByRole("button", { name: "Tirar Região Norte do filtro" }));
    expect(readSet(onFilterChange.mock.calls.at(-1)?.[0] as LeadFilter, LEAD_FILTER_FIELD.area)).toEqual([]);
    onFilterChange.mockClear();
    actions.deleteLeadAreaAction.mockResolvedValue({ error: null });
    fireEvent.click(screen.getByRole("button", { name: "Apagar Região Norte" }));
    const dialog = await screen.findByRole("alertdialog");
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Apagar área" })));
    await waitFor(() => expect(actions.deleteLeadAreaAction).toHaveBeenCalledWith("a1"));
    await waitFor(() => expect(onFilterChange).toHaveBeenCalled());
    expect(readSet(onFilterChange.mock.calls.at(-1)?.[0] as LeadFilter, LEAD_FILTER_FIELD.area)).toEqual([]);
  });

  it("adds the leads of a dot to the selection on shift-click", async () => {
    const { onPicksChange, rerender } = renderView();
    await screen.findByTestId("lead-map");
    await act(async () => mapProps.current.onPointShiftClick?.(POINT));
    expect(onPicksChange).toHaveBeenCalledWith({ [POINT.id]: ["l1", "l2"] });
    const picks: MapPicks = { [POINT.id]: ["l1", "l2"] };
    rerender({ picks });
    expect(screen.getByTestId("lead-map")).toHaveAttribute("data-selected", POINT.id);
  });

  it("looks the people up when a dot holds more than its ids", async () => {
    const crowded = { ...POINT, count: 60, leadIds: ["l1", "l2", "l3", "l4", "l5"] };
    actions.fetchLeadMapPoint.mockResolvedValue({ total: 60, items: Array.from({ length: 50 }, (_, index) => ({ id: `m${index}` })) });
    const { onPicksChange } = renderView();
    await screen.findByTestId("lead-map");
    await act(async () => mapProps.current.onPointShiftClick?.(crowded));
    await waitFor(() => expect(onPicksChange).toHaveBeenCalled());
    expect((onPicksChange.mock.calls[0][0] as MapPicks)[crowded.id]).toHaveLength(50);
    expect(toast.message).toHaveBeenCalledWith("Só os primeiros 50 leads deste ponto entraram na seleção.");
  });

  it("takes a selected dot out on a second shift-click", async () => {
    const { onPicksChange } = renderView({ picks: { [POINT.id]: ["l1", "l2"] } });
    await screen.findByTestId("lead-map");
    await act(async () => mapProps.current.onPointShiftClick?.(POINT));
    expect(onPicksChange).toHaveBeenCalledWith({});
  });

  it("opens the peek of a clicked dot", async () => {
    actions.fetchLeadMapPoint.mockResolvedValue({ total: 1, items: [{ id: "l1", number: "5511900010142", realName: "Maria", version: 1 }] });
    renderView();
    await screen.findByTestId("lead-map");
    act(() => mapProps.current.onPointClick?.(POINT, { x: 40, y: 40 }));
    expect(await screen.findByText("Maria")).toBeInTheDocument();
  });

  it("lists each off-map count in the table with the placement filter it was counted with", async () => {
    const { onFilterChange, onShowTable } = renderView();
    await screen.findByText("Fora do mapa neste filtro");
    fireEvent.click(screen.getByRole("button", { name: /Listar na tabela os leads aproximados/ }));
    expect(readSet(onShowTable.mock.calls[0][0] as LeadFilter, LEAD_FILTER_FIELD.geoPlacement)).toEqual(["approximate"]);
    fireEvent.click(screen.getByRole("button", { name: /Listar na tabela os leads sem endereço/ }));
    expect(readBoolean(onShowTable.mock.calls[1][0] as LeadFilter, LEAD_FILTER_FIELD.hasAddress)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /Listar na tabela os endereços não localizados/ }));
    expect(readSet(onShowTable.mock.calls[2][0] as LeadFilter, LEAD_FILTER_FIELD.geoPlacement)).toEqual(["not_found"]);
    fireEvent.click(screen.getByRole("button", { name: /Listar na tabela os leads aguardando localização/ }));
    expect(readSet(onShowTable.mock.calls[3][0] as LeadFilter, LEAD_FILTER_FIELD.geoPlacement)).toEqual(["pending"]);
    expect(onFilterChange).not.toHaveBeenCalled();
  });

  it("narrows the filter to a bairro from the keyboard list", async () => {
    const { onFilterChange } = renderView();
    const list = await screen.findByRole("list", { name: "Bairros do filtro" });
    fireEvent.click(within(list).getByRole("button", { name: /Centro/ }));
    fireEvent.click(screen.getByRole("button", { name: "Selecionar todos deste bairro" }));
    expect(readSet(onFilterChange.mock.calls[0][0] as LeadFilter, LEAD_FILTER_FIELD.district)).toEqual(["3550308/centro"]);
  });

  it("counts the approximate leads drawn apart from the ones on the map", async () => {
    actions.fetchLeadMapLayer.mockResolvedValue({ kind: "points", points: [POINT, NEAR] });
    renderView();
    await screen.findByTestId("lead-map");
    moveTo(13);
    const status = await screen.findByText(/2 leads nesta parte do mapa\. 3 com posição aproximada nesta parte do mapa\./);
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Aproximado (CEP, bairro ou cidade)")).toBeInTheDocument();
  });

  it("adds the leads of an approximate point to the selection with their own placement", async () => {
    const crowded = { ...NEAR, count: 9 };
    actions.fetchLeadMapPoint.mockResolvedValue({ total: 9, items: Array.from({ length: 9 }, (_, index) => ({ id: `n${index}` })) });
    const { onPicksChange } = renderView();
    await screen.findByTestId("lead-map");
    await act(async () => mapProps.current.onPointShiftClick?.(crowded));
    await waitFor(() => expect(onPicksChange).toHaveBeenCalled());
    expect(actions.fetchLeadMapPoint).toHaveBeenCalledWith(expect.anything(), { lat: -23.55, lng: -46.63, placement: "approximate" });
    expect((onPicksChange.mock.calls[0][0] as MapPicks)[crowded.id]).toHaveLength(9);
  });

  it("offers the place search on the map in every layer", async () => {
    renderView();
    expect(await screen.findByTestId("place-search")).toBeInTheDocument();
  });

  it("fits a searched bairro and outlines it, and flies to a searched street and marks it", async () => {
    renderView();
    await screen.findByTestId("place-search");
    const bounds = { south: -6.33, west: -35.5, north: -6.29, east: -35.46 };
    act(() => placeSearch.props?.onSelect({ ...PLACE, kind: "district", precision: "district", bounds }));
    expect(mapProps.current.goTo).toMatchObject({ bounds });
    expect(mapProps.current.placeMarker).toEqual({ kind: "bounds", bounds });
    act(() => placeSearch.props?.onSelect({ ...PLACE, kind: "street", precision: "street", bounds: null }));
    expect(mapProps.current.goTo).toMatchObject({ center: PLACE.position, zoom: 15 });
    expect(mapProps.current.placeMarker).toEqual({ kind: "point", at: PLACE.position });
    act(() => mapProps.current.onUserPan?.());
    expect(mapProps.current.placeMarker).toBeNull();
  });

  it("goes back to the same place when it is chosen again", async () => {
    renderView();
    await screen.findByTestId("place-search");
    const place = { ...PLACE, kind: "street", precision: "street", bounds: null };
    act(() => placeSearch.props?.onSelect(place));
    const first = (mapProps.current.goTo as { key: number }).key;
    act(() => placeSearch.props?.onSelect(place));
    expect((mapProps.current.goTo as { key: number }).key).not.toBe(first);
  });

  it("filters by a searched city through the shared filter", async () => {
    const filter = withSet(emptyLeadFilter, LEAD_FILTER_FIELD.district, ["rn:natal/centro"]);
    const { onFilterChange } = renderView({ filter });
    await screen.findByTestId("place-search");
    act(() => placeSearch.props?.onFilter?.({ ...PLACE, kind: "city", precision: "city", cityKey: "rn:santo antonio" }));
    const next = onFilterChange.mock.calls[0][0] as LeadFilter;
    expect(readSet(next, LEAD_FILTER_FIELD.city)).toEqual(["rn:santo antonio"]);
    expect(readSet(next, LEAD_FILTER_FIELD.district)).toEqual(["rn:natal/centro"]);
  });

  it("announces the counts for screen readers", async () => {
    renderView();
    const status = await screen.findByText(/7\.942 leads no filtro\./);
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("shows the layer failure on the map instead of an empty map", async () => {
    actions.fetchLeadMapLayer.mockRejectedValue(new SectionError("bad", 400, "map_window_too_wide"));
    renderView();
    await screen.findByTestId("lead-map");
    moveTo(12);
    expect(await screen.findByText("Não foi possível carregar os pontos desta parte do mapa.")).toBeInTheDocument();
  });

  it("opens on the focused lead: centred on its primary address with its peek open", async () => {
    navigation.search = "view=map&focus=l1";
    const lead = {
      id: "l1",
      number: "5511900010142",
      realName: "Maria",
      version: 1,
      addresses: [{ id: "ad1", label: "home", primary: true, geoStatus: "located", latitude: -23.561, longitude: -46.655, precision: "exact" }],
    };
    getLeadByIdAction.mockResolvedValue({ lead, error: null });
    actions.fetchLeadMapPoint.mockResolvedValue({ total: 1, items: [lead] });
    renderView();
    await waitFor(() => expect(getLeadByIdAction).toHaveBeenCalledWith("l1", expect.anything()));
    await waitFor(() => expect((mapProps.current.bounds as { south: number }).south).toBeCloseTo(-23.571, 3));
    expect((mapProps.current.bounds as { north: number }).north).toBeCloseTo(-23.551, 3);
    expect(await screen.findByText("Maria")).toBeInTheDocument();
    expect(actions.fetchLeadMapPoint).toHaveBeenCalledWith({ filter: emptyLeadFilter, q: "" }, { lat: -23.561, lng: -46.655, placement: "on_map" }, expect.anything());
    fireEvent.click(screen.getByRole("button", { name: ptMessages.leadMap.peek.close }));
    expect(navigation.replace).toHaveBeenCalledWith("/dashboard/leads?view=map", { scroll: false });
  });

  it("says when the focused lead has no position on the map", async () => {
    navigation.search = "view=map&focus=l1";
    getLeadByIdAction.mockResolvedValue({ lead: { id: "l1", number: "5511", version: 1, addresses: [] }, error: null });
    renderView();
    expect(await screen.findByText("Este lead ainda não tem posição no mapa.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar aviso" }));
    expect(navigation.replace).toHaveBeenCalledWith("/dashboard/leads?view=map", { scroll: false });
  });

  it("says when the focused lead cannot be read", async () => {
    navigation.search = "view=map&focus=l9";
    getLeadByIdAction.mockResolvedValue({ lead: null, error: { code: "lead_not_found", status: 404 } });
    renderView();
    expect(await screen.findByText("Não foi possível abrir este lead no mapa.")).toBeInTheDocument();
  });
});
