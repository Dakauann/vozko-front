import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";

import { AREA_HANDLE_IMAGE, LEAD_MAP_LAYERS, LEAD_MAP_SOURCES } from "@/lib/maps/layers";
import type { MapLayerResponse } from "@/lib/maps/types";

import { LeadMapCanvas } from "../LeadMapCanvas";
import { renderInPortuguese } from "./intl";

type Handler = (event: Record<string, unknown>) => void;

const maps = vi.hoisted(() => ({ instances: [] as FakeMapShape[], loadStyle: vi.fn(), setWorkerUrl: vi.fn(), createError: null as Error | null }));

interface FakeMapShape {
  options: Record<string, unknown>;
  sources: Map<string, { data: unknown; setData: (data: unknown) => void; getClusterExpansionZoom: (id: number) => Promise<number> }>;
  layers: Array<{ spec: { id: string; type: string }; before?: string }>;
  filters: Record<string, unknown>;
  layout: Record<string, Record<string, unknown>>;
  paint: Array<[string, string, unknown]>;
  fitted: unknown[];
  flown: unknown[];
  eased: unknown[];
  controls: unknown[];
  zooms: string[];
  removed: boolean;
  rendered: Record<string, unknown[]>;
  images: Map<string, unknown>;
  fire(event: string, layerOrPayload?: string | Record<string, unknown>, payload?: Record<string, unknown>): void;
}

vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

vi.mock("maplibre-gl", () => {
  class FakeMap {
    sources = new Map();
    layers: Array<{ spec: { id: string; type: string }; before?: string }> = [];
    filters: Record<string, unknown> = {};
    layout: Record<string, Record<string, unknown>> = {};
    paint: Array<[string, string, unknown]> = [];
    fitted: unknown[] = [];
    eased: unknown[] = [];
    controls: unknown[] = [];
    zooms: string[] = [];
    removed = false;
    handlers: Array<{ event: string; layer?: string; handler: Handler }> = [];
    canvas = { style: { cursor: "" } };
    rendered: Record<string, unknown[]> = {};
    images = new Map<string, unknown>();
    addImage(id: string, image: unknown) {
      this.images.set(id, image);
    }
    hasImage(id: string) {
      return this.images.has(id);
    }
    updateImage(id: string, image: unknown) {
      this.images.set(id, image);
    }
    queryRenderedFeatures(_point: unknown, options: { layers: string[] }) {
      return options.layers.flatMap((layer) => this.rendered[layer] ?? []);
    }
    constructor(public options: { style: { layers: Array<{ id: string; type: string }> } }) {
      if (maps.createError) throw maps.createError;
      maps.instances.push(this as unknown as FakeMapShape);
    }
    on(event: string, layerOrHandler: string | Handler, handler?: Handler) {
      if (typeof layerOrHandler === "string") this.handlers.push({ event, layer: layerOrHandler, handler: handler as Handler });
      else this.handlers.push({ event, handler: layerOrHandler });
      return this;
    }
    fire(event: string, layerOrPayload?: string | Record<string, unknown>, payload?: Record<string, unknown>) {
      const layer = typeof layerOrPayload === "string" ? layerOrPayload : undefined;
      const body = (typeof layerOrPayload === "string" ? payload : layerOrPayload) ?? {};
      for (const entry of this.handlers) if (entry.event === event && entry.layer === layer) entry.handler(body);
    }
    addControl(control: unknown) {
      this.controls.push(control);
      return this;
    }
    zoomIn() {
      this.zooms.push("in");
    }
    zoomOut() {
      this.zooms.push("out");
    }
    addSource(id: string) {
      const source = {
        data: null as unknown,
        setData(data: unknown) {
          source.data = data;
        },
        getClusterExpansionZoom: vi.fn(() => Promise.resolve(14)),
      };
      this.sources.set(id, source);
    }
    getSource(id: string) {
      return this.sources.get(id);
    }
    addLayer(spec: { id: string; type: string }, before?: string) {
      this.layers.push({ spec, before });
    }
    getLayer(id: string) {
      return this.layers.find((layer) => layer.spec.id === id)?.spec ?? this.options.style.layers.find((layer) => layer.id === id);
    }
    getStyle() {
      return { layers: [...this.options.style.layers, ...this.layers.map((layer) => layer.spec)] };
    }
    setFilter(id: string, filter: unknown) {
      this.filters[id] = filter;
    }
    setLayoutProperty(id: string, name: string, value: unknown) {
      this.layout[id] = { ...this.layout[id], [name]: value };
    }
    setPaintProperty(id: string, name: string, value: unknown) {
      this.paint.push([id, name, value]);
    }
    getBounds() {
      return { getSouth: () => -23.7, getWest: () => -46.8, getNorth: () => -23.4, getEast: () => -46.4 };
    }
    getZoom() {
      return 10.2;
    }
    fitBounds(bounds: unknown) {
      this.fitted.push(bounds);
    }
    flown: unknown[] = [];
    flyTo(options: unknown) {
      this.flown.push(options);
    }
    easeTo(options: unknown) {
      this.eased.push(options);
    }
    getCanvas() {
      return this.canvas;
    }
    remove() {
      this.removed = true;
    }
  }
  class NavigationControl {}
  return { Map: FakeMap, NavigationControl, setWorkerUrl: maps.setWorkerUrl, getVersion: () => "6.13.0" };
});

vi.mock("@/lib/maps/style-loader", () => ({ loadBaseStyle: (url: string) => maps.loadStyle(url) }));

vi.mock("../AreaDrawControl", async () => {
  const { useLeadMap } = await import("../map-context");
  function AreaDrawControl() {
    const { setDrawing } = useLeadMap();
    return (
      <div data-testid="area-draw-control">
        <button type="button" onClick={() => setDrawing(true)}>
          start drawing
        </button>
        <button type="button" onClick={() => setDrawing(false)}>
          stop drawing
        </button>
      </div>
    );
  }
  return { AreaDrawControl };
});

const TOKENS: Record<string, string> = {
  "--background": "200 24% 97%",
  "--foreground": "206 15% 9%",
  "--card": "0 0% 100%",
  "--popover": "0 0% 100%",
  "--secondary": "204 20% 95%",
  "--muted": "204 16% 93%",
  "--muted-foreground": "206 9% 38%",
  "--accent-hover": "204 16% 89%",
  "--border": "204 14% 88%",
  "--border-strong": "205 12% 76%",
  "--control-edge": "205 12% 53%",
  "--primary": "164 100% 38%",
  "--chart-1": "164 100% 32%",
  "--chart-2": "231 60% 56%",
  "--chart-3": "43 92% 45%",
  "--chart-4": "199 89% 42%",
  "--chart-5": "321 50% 46%",
  "--warning-ink": "32 94% 29%",
  "--primary-edge": "164 100% 30%",
};

const baseStyle = {
  version: 8,
  sources: { openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#fff" } },
    { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: {} },
    { id: "label_city", type: "symbol", source: "openmaptiles", "source-layer": "place", layout: { "text-font": ["Noto Sans Regular"], "text-field": ["coalesce", ["get", "name_en"], ["get", "name"]] }, paint: {} },
  ],
};

const points: MapLayerResponse = {
  kind: "points",
  points: [
    { id: "p1", lat: -23.55, lng: -46.63, precision: "street", placement: "on_map", tone: "chart-2", count: 1, leadIds: ["l1"] },
    { id: "p2", lat: -23.56, lng: -46.64, precision: "exact", placement: "on_map", tone: "neutral", count: 2, leadIds: ["l2", "l3"] },
    { id: "approximate:-23.56,-46.64", lat: -23.56, lng: -46.64, precision: "district", placement: "approximate", tone: "neutral", count: 3, leadIds: ["l4", "l5", "l6"] },
  ],
};

async function loadedMap() {
  await waitFor(() => expect(maps.instances.length).toBeGreaterThan(0));
  const map = maps.instances[maps.instances.length - 1];
  act(() => map.fire("load"));
  return map;
}

describe("LeadMapCanvas", () => {
  beforeEach(() => {
    maps.instances.length = 0;
    maps.loadStyle.mockReset();
    maps.loadStyle.mockResolvedValue(baseStyle);
    document.documentElement.className = "light";
    for (const [name, value] of Object.entries(TOKENS)) document.documentElement.style.setProperty(name, value);
  });

  afterEach(() => {
    document.documentElement.removeAttribute("style");
    document.documentElement.className = "";
    vi.unstubAllEnvs();
  });

  it("waits with the product loader, not a map-only look", async () => {
    maps.loadStyle.mockReturnValue(new Promise(() => undefined));
    renderInPortuguese(<LeadMapCanvas layer={null} />);
    const loader = screen.getByRole("status");
    expect(loader).toHaveAttribute("data-fit", "fill");
    expect(loader).toHaveTextContent("Carregando mapa…");
  });

  it("refuses a misconfigured basemap address instead of falling back to the public one", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAP_STYLE_URL", "http://tiles.example.com/style.json");
    renderInPortuguese(<LeadMapCanvas layer={null} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("O endereço do mapa base configurado é inválido.");
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
    expect(maps.loadStyle).not.toHaveBeenCalled();
  });

  it("zooms with in-house buttons instead of the library control", async () => {
    renderInPortuguese(<LeadMapCanvas layer={null} />);
    const map = await loadedMap();
    expect(map.controls).toEqual([]);
    const zoom = screen.getByRole("group", { name: "Zoom" });
    fireEvent.click(within(zoom).getByRole("button", { name: "Aproximar" }));
    fireEvent.click(within(zoom).getByRole("button", { name: "Afastar" }));
    expect(map.zooms).toEqual(["in", "out"]);
  });

  it("marks its frame so the library chrome takes the product tokens", async () => {
    const { container } = renderInPortuguese(<LeadMapCanvas layer={null} />);
    await loadedMap();
    expect(container.querySelector(".vz-map")).not.toBeNull();
  });

  it("ignores dot, cluster and bairro clicks while an area is being drawn", async () => {
    const onPointClick = vi.fn();
    const onPointShiftClick = vi.fn();
    const onDistrictClick = vi.fn();
    const districts = [{ pair: "sp/se", cityKey: "sp", districtKey: "se", name: "Sé", lat: -23.55, lng: -46.63, count: 4 }];
    renderInPortuguese(
      <LeadMapCanvas
        layer={points}
        districts={districts}
        onPointClick={onPointClick}
        onPointShiftClick={onPointShiftClick}
        onDistrictClick={onDistrictClick}
        onAreaDrawn={vi.fn()}
      />,
    );
    const map = await loadedMap();
    const clickEverything = () =>
      act(() => {
        map.fire("click", LEAD_MAP_LAYERS.dots, { features: [{ properties: { id: "p2" } }], originalEvent: { shiftKey: false }, point: { x: 1, y: 1 } });
        map.fire("click", LEAD_MAP_LAYERS.dots, { features: [{ properties: { id: "p2" } }], originalEvent: { shiftKey: true }, point: { x: 1, y: 1 } });
        map.fire("click", LEAD_MAP_LAYERS.clusters, {
          features: [{ properties: { cluster_id: 7 }, geometry: { type: "Point", coordinates: [-46.6, -23.5] } }],
        });
        map.fire("click", LEAD_MAP_LAYERS.districts, { features: [{ properties: { key: "sp:se" } }] });
      });
    fireEvent.click(screen.getByRole("button", { name: "start drawing" }));
    clickEverything();
    await act(async () => {
      await Promise.resolve();
    });
    expect(onPointClick).not.toHaveBeenCalled();
    expect(onPointShiftClick).not.toHaveBeenCalled();
    expect(onDistrictClick).not.toHaveBeenCalled();
    expect(map.eased).toEqual([]);
    expect(map.sources.get(LEAD_MAP_SOURCES.points)?.getClusterExpansionZoom).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "stop drawing" }));
    clickEverything();
    expect(onPointClick).toHaveBeenCalledTimes(1);
    expect(onPointShiftClick).toHaveBeenCalledTimes(1);
    expect(onDistrictClick).toHaveBeenCalledWith(districts[0]);
    await waitFor(() => expect(map.eased).toHaveLength(1));
  });

  it("opens on Brazil with the attribution kept and a localized label", async () => {
    renderInPortuguese(<LeadMapCanvas layer={null} />);
    const map = await loadedMap();
    expect(maps.loadStyle).toHaveBeenCalledWith("https://tiles.openfreemap.org/styles/positron");
    expect(map.options.bounds).toEqual([[-74.1, -33.8], [-28.8, 5.3]]);
    expect(map.options.attributionControl).toEqual({ compact: true });
    expect((map.options.locale as Record<string, string>)["Map.Title"]).toBe("Mapa de leads");
  });

  it("opens on the located leads, padded clear of the panel, and on Brazil when they spread past it", async () => {
    const saoPaulo = { south: -23.9, west: -46.9, north: -23.3, east: -46.3 };
    const padding = { top: 56, right: 336, bottom: 24, left: 64 };
    const { unmount } = renderInPortuguese(<LeadMapCanvas layer={null} bounds={saoPaulo} fitPadding={padding} />);
    const map = await loadedMap();
    expect(map.options.bounds).toEqual([[-46.9, -23.9], [-46.3, -23.3]]);
    expect(map.options.fitBoundsOptions).toMatchObject({ padding });
    unmount();
    renderInPortuguese(<LeadMapCanvas layer={null} bounds={{ south: -23.9, west: -46.9, north: 38.7, east: -9.1 }} />);
    await waitFor(() => expect(maps.instances).toHaveLength(2));
    const wide = await loadedMap();
    expect(wide.options.bounds).toEqual([[-74.1, -33.8], [-28.8, 5.3]]);
  });

  it("drops the panel padding on a phone, where the panel is a bottom sheet", async () => {
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(375);
    try {
      renderInPortuguese(<LeadMapCanvas layer={null} bounds={{ south: -23.9, west: -46.9, north: -23.3, east: -46.3 }} fitPadding={{ top: 56, right: 336, bottom: 24, left: 64 }} />);
      const map = await loadedMap();
      expect(map.options.fitBoundsOptions).toMatchObject({ padding: 32 });
    } finally {
      width.mockRestore();
    }
  });

  it("labels the basemap in the language of the page", async () => {
    renderInPortuguese(<LeadMapCanvas layer={null} />);
    const map = await loadedMap();
    const style = map.options.style as { layers: Array<{ id: string; layout?: Record<string, unknown> }> };
    const field = JSON.stringify(style.layers.find((layer) => layer.id === "label_city")?.layout?.["text-field"]);
    expect(field).toContain('["has","name:pt"]');
    expect(field).not.toContain("name_en");
  });

  it("recolours the basemap from the tokens before the first paint", async () => {
    renderInPortuguese(<LeadMapCanvas layer={null} />);
    const map = await loadedMap();
    const style = map.options.style as typeof baseStyle;
    expect(style.layers[0].paint["background-color"]).toBe("hsl(200, 24%, 97%)");
    expect(baseStyle.layers[0].paint["background-color"]).toBe("#fff");
  });

  it("adds every source and layer, keeping heat and bairros under the labels", async () => {
    renderInPortuguese(<LeadMapCanvas layer={null} />);
    const map = await loadedMap();
    expect([...map.sources.keys()]).toEqual(Object.values(LEAD_MAP_SOURCES));
    expect(map.layers.map((layer) => layer.spec.id)).toEqual(Object.values(LEAD_MAP_LAYERS));
    const before = Object.fromEntries(map.layers.map((layer) => [layer.spec.id, layer.before]));
    expect(before[LEAD_MAP_LAYERS.heat]).toBe("label_city");
    expect(before[LEAD_MAP_LAYERS.districts]).toBe("label_city");
    expect(before[LEAD_MAP_LAYERS.dots]).toBeUndefined();
  });

  it("feeds the points and shows the dot layers in Pontos", async () => {
    renderInPortuguese(<LeadMapCanvas layer={points} mode="points" />);
    const map = await loadedMap();
    await waitFor(() => expect((map.sources.get(LEAD_MAP_SOURCES.points)?.data as { features: unknown[] })?.features).toHaveLength(2));
    expect(map.layout[LEAD_MAP_LAYERS.dots]).toEqual({ visibility: "visible" });
    expect(map.layout[LEAD_MAP_LAYERS.clusters]).toEqual({ visibility: "visible" });
    expect(map.layout[LEAD_MAP_LAYERS.heat]).toEqual({ visibility: "none" });
  });

  const cells: MapLayerResponse = {
    kind: "cells",
    cellSizeDegrees: 0.1,
    cells: [
      { ix: -467, iy: -236, placement: "on_map", count: 5, lat: -23.55, lng: -46.65 },
      { ix: -467, iy: -236, placement: "approximate", count: 2, lat: -23.56, lng: -46.66 },
    ],
  };

  it("feeds the heat with precise cells only and hides the approximate leads in Calor", async () => {
    renderInPortuguese(<LeadMapCanvas layer={cells} mode="heat" />);
    const map = await loadedMap();
    await waitFor(() => expect(map.layout[LEAD_MAP_LAYERS.heat]).toEqual({ visibility: "visible" }));
    expect(map.layout[LEAD_MAP_LAYERS.clusters]).toEqual({ visibility: "none" });
    expect(map.layout[LEAD_MAP_LAYERS.approximate]).toEqual({ visibility: "none" });
    expect((map.sources.get(LEAD_MAP_SOURCES.heat)?.data as { features: unknown[] }).features).toHaveLength(1);
    await waitFor(() => expect(map.paint).toContainEqual([LEAD_MAP_LAYERS.heat, "heatmap-weight", ["interpolate", ["linear"], ["sqrt", ["get", "count"]], 0, 0, Math.sqrt(5), 1]]));
  });

  it("draws cells as bubbles in Pontos, precise and approximate apart, and zooms into one on click", async () => {
    renderInPortuguese(<LeadMapCanvas layer={cells} mode="points" />);
    const map = await loadedMap();
    await waitFor(() => expect((map.sources.get(LEAD_MAP_SOURCES.points)?.data as { features: unknown[] })?.features).toHaveLength(1));
    expect((map.sources.get(LEAD_MAP_SOURCES.approximate)?.data as { features: unknown[] }).features).toHaveLength(1);
    act(() =>
      map.fire("click", LEAD_MAP_LAYERS.approximateClusters, {
        features: [{ properties: { group: true, people: 2 }, geometry: { type: "Point", coordinates: [-46.66, -23.56] } }],
        originalEvent: { shiftKey: false },
        point: { x: 1, y: 1 },
      }),
    );
    expect(map.eased).toEqual([{ center: [-46.66, -23.56], zoom: 12.2 }]);
  });

  it("dots only the selected leads over the heat", async () => {
    renderInPortuguese(<LeadMapCanvas layer={points} mode="heat" selectedPointIds={["p1"]} />);
    const map = await loadedMap();
    await waitFor(() =>
      expect(map.filters[LEAD_MAP_LAYERS.dots]).toEqual([
        "all",
        ["!", ["any", [">", ["get", "people"], 1], ["==", ["get", "group"], true]]],
        ["in", ["get", "id"], ["literal", ["p1"]]],
      ]),
    );
    expect(map.filters[LEAD_MAP_LAYERS.dotHalo]).toEqual(map.filters[LEAD_MAP_LAYERS.dots]);
  });

  it("opens the peek of several people at one position from their bubble", async () => {
    const onPointClick = vi.fn();
    renderInPortuguese(<LeadMapCanvas layer={points} mode="points" onPointClick={onPointClick} />);
    const map = await loadedMap();
    act(() =>
      map.fire("click", LEAD_MAP_LAYERS.clusters, {
        features: [{ properties: { id: "p2", people: 2 }, geometry: { type: "Point", coordinates: [-46.64, -23.56] } }],
        originalEvent: { shiftKey: false },
        point: { x: 5, y: 6 },
      }),
    );
    expect(onPointClick).toHaveBeenCalledWith(points.kind === "points" ? points.points[1] : null, { x: 5, y: 6 });
    expect(map.eased).toEqual([]);
  });

  it("draws approximate points apart from the clustered precise ones and opens their peek", async () => {
    const onPointClick = vi.fn();
    const onPointShiftClick = vi.fn();
    renderInPortuguese(<LeadMapCanvas layer={points} onPointClick={onPointClick} onPointShiftClick={onPointShiftClick} />);
    const map = await loadedMap();
    await waitFor(() => expect((map.sources.get(LEAD_MAP_SOURCES.approximate)?.data as { features: unknown[] })?.features).toHaveLength(1));
    expect((map.sources.get(LEAD_MAP_SOURCES.points)?.data as { features: unknown[] }).features).toHaveLength(2);
    expect(map.layout[LEAD_MAP_LAYERS.approximate]).toEqual({ visibility: "visible" });
    const approximate = points.kind === "points" ? points.points[2] : null;
    const click = (shiftKey: boolean) =>
      map.fire("click", LEAD_MAP_LAYERS.approximate, { features: [{ properties: { id: approximate?.id } }], originalEvent: { shiftKey }, point: { x: 10, y: 20 } });
    act(() => click(false));
    expect(onPointClick).toHaveBeenCalledWith(approximate, { x: 10, y: 20 });
    act(() => click(true));
    expect(onPointShiftClick).toHaveBeenCalledWith(approximate);
  });

  it("opens only the precise dot when it sits over an approximate ring", async () => {
    const onPointClick = vi.fn();
    renderInPortuguese(<LeadMapCanvas layer={points} onPointClick={onPointClick} />);
    const map = await loadedMap();
    map.rendered[LEAD_MAP_LAYERS.dots] = [{ properties: { id: "p2" } }];
    const approximate = points.kind === "points" ? points.points[2] : null;
    act(() => map.fire("click", LEAD_MAP_LAYERS.approximate, { features: [{ properties: { id: approximate?.id } }], originalEvent: { shiftKey: false }, point: { x: 10, y: 20 } }));
    expect(onPointClick).not.toHaveBeenCalled();
  });

  it("rings a selected approximate point", async () => {
    renderInPortuguese(<LeadMapCanvas layer={points} selectedPointIds={["approximate:-23.56,-46.64"]} />);
    const map = await loadedMap();
    await waitFor(() =>
      expect(map.filters[LEAD_MAP_LAYERS.approximateSelected]).toEqual([
        "all",
        ["all", ["!", ["has", "point_count"]], ["!=", ["get", "group"], true]],
        ["in", ["get", "id"], ["literal", ["approximate:-23.56,-46.64"]]],
      ]),
    );
  });

  it("emits the tile-snapped viewport once the map settles", async () => {
    const onViewportChange = vi.fn();
    renderInPortuguese(<LeadMapCanvas layer={null} onViewportChange={onViewportChange} />);
    await loadedMap();
    await waitFor(() => expect(onViewportChange).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(onViewportChange.mock.calls[0][0]).toMatchObject({ zoom: 10, key: "10/378:380/580:581" });
  });

  it("opens a dot on click and adds it to the selection on shift-click", async () => {
    const onPointClick = vi.fn();
    const onPointShiftClick = vi.fn();
    renderInPortuguese(<LeadMapCanvas layer={points} onPointClick={onPointClick} onPointShiftClick={onPointShiftClick} />);
    const map = await loadedMap();
    const click = (shiftKey: boolean) =>
      map.fire("click", LEAD_MAP_LAYERS.dots, {
        features: [{ properties: { id: "p2" } }],
        originalEvent: { shiftKey },
        point: { x: 40, y: 60 },
      });
    act(() => click(false));
    expect(onPointClick).toHaveBeenCalledWith(points.kind === "points" ? points.points[1] : null, { x: 40, y: 60 });
    act(() => click(true));
    expect(onPointShiftClick).toHaveBeenCalledWith(points.kind === "points" ? points.points[1] : null);
    expect(onPointClick).toHaveBeenCalledTimes(1);
  });

  it("ignores a click on a dot it does not know", async () => {
    const onPointClick = vi.fn();
    renderInPortuguese(<LeadMapCanvas layer={points} onPointClick={onPointClick} />);
    const map = await loadedMap();
    act(() => map.fire("click", LEAD_MAP_LAYERS.dots, { features: [{ properties: { id: "ghost" } }], originalEvent: { shiftKey: false }, point: { x: 0, y: 0 } }));
    expect(onPointClick).not.toHaveBeenCalled();
  });

  it("zooms into a cluster on click", async () => {
    renderInPortuguese(<LeadMapCanvas layer={points} />);
    const map = await loadedMap();
    act(() =>
      map.fire("click", LEAD_MAP_LAYERS.clusters, {
        features: [{ properties: { cluster_id: 7 }, geometry: { type: "Point", coordinates: [-46.6, -23.5] } }],
      }),
    );
    await waitFor(() => expect(map.eased).toEqual([{ center: [-46.6, -23.5], zoom: 14 }]));
  });

  it("rings the selected dots", async () => {
    renderInPortuguese(<LeadMapCanvas layer={points} mode="points" selectedPointIds={["p1"]} />);
    const map = await loadedMap();
    await waitFor(() =>
      expect(map.filters[LEAD_MAP_LAYERS.selected]).toEqual([
        "all",
        ["all", ["!", ["has", "point_count"]], ["!=", ["get", "group"], true]],
        ["in", ["get", "id"], ["literal", ["p1"]]],
      ]),
    );
  });

  it("rings every precise lead when a drawn area holds the filter", async () => {
    renderInPortuguese(<LeadMapCanvas layer={points} mode="points" allSelected />);
    const map = await loadedMap();
    await waitFor(() => expect(map.filters[LEAD_MAP_LAYERS.selected]).toEqual(["!", ["any", [">", ["get", "people"], 1], ["==", ["get", "group"], true]]]));
  });

  it("fills every area it is given and marks the corners with the handle image", async () => {
    const areas = [
      { kind: "circle" as const, center: { lat: -23.55, lng: -46.65 }, radiusM: 800 },
      { kind: "polygon" as const, ring: [{ lat: -23.6, lng: -46.7 }, { lat: -23.6, lng: -46.6 }, { lat: -23.5, lng: -46.65 }] },
    ];
    renderInPortuguese(<LeadMapCanvas layer={null} areas={areas} />);
    const map = await loadedMap();
    await waitFor(() => expect((map.sources.get(LEAD_MAP_SOURCES.area)?.data as { features: unknown[] }).features).toHaveLength(2));
    expect((map.sources.get(LEAD_MAP_SOURCES.areaHandles)?.data as { features: unknown[] }).features).toHaveLength(3);
    expect(map.images.has(AREA_HANDLE_IMAGE)).toBe(true);
  });

  it("repaints the basemap when the theme changes", async () => {
    renderInPortuguese(<LeadMapCanvas layer={null} />);
    const map = await loadedMap();
    map.paint.length = 0;
    act(() => {
      document.documentElement.style.setProperty("--card", "210 12% 9%");
      document.documentElement.className = "dark";
    });
    await waitFor(() => expect(map.paint).toContainEqual(["background", "background-color", "hsl(210, 12%, 9%)"]));
  });

  it("goes to a searched place: fits its bounds, or flies to its point at the zoom asked", async () => {
    const { rerender } = renderInPortuguese(<LeadMapCanvas layer={null} />);
    const map = await loadedMap();
    rerender(<LeadMapCanvas layer={null} goTo={{ key: 1, bounds: { south: -6.4, west: -35.6, north: -6.2, east: -35.4 } }} />);
    await waitFor(() => expect(map.fitted).toContainEqual([[-35.6, -6.4], [-35.4, -6.2]]));
    rerender(<LeadMapCanvas layer={null} goTo={{ key: 2, center: { lat: -6.31, lng: -35.48 }, zoom: 15 }} />);
    await waitFor(() => expect(map.flown).toEqual([{ center: [-35.48, -6.31], zoom: 15 }]));
    rerender(<LeadMapCanvas layer={null} goTo={{ key: 2, center: { lat: -6.31, lng: -35.48 }, zoom: 15 }} />);
    expect(map.flown).toHaveLength(1);
    rerender(<LeadMapCanvas layer={null} goTo={{ key: 3, center: { lat: -6.31, lng: -35.48 }, zoom: 15 }} />);
    await waitFor(() => expect(map.flown).toHaveLength(2));
  });

  it("marks the searched place and tells the page when the person starts to pan", async () => {
    const onUserPan = vi.fn();
    renderInPortuguese(<LeadMapCanvas layer={null} placeMarker={{ kind: "point", at: { lat: -6.31, lng: -35.48 } }} onUserPan={onUserPan} />);
    const map = await loadedMap();
    await waitFor(() => expect((map.sources.get(LEAD_MAP_SOURCES.place)?.data as { features: unknown[] })?.features).toHaveLength(1));
    act(() => map.fire("dragstart"));
    expect(onUserPan).toHaveBeenCalledTimes(1);
  });

  it("stacks the draw and zoom controls in one column and puts the page tools to its right", async () => {
    renderInPortuguese(<LeadMapCanvas layer={null} onAreaDrawn={vi.fn()} tools={<div data-testid="place-tools" />} />);
    await loadedMap();
    const tools = screen.getByTestId("place-tools");
    const draw = screen.getByTestId("area-draw-control");
    const zoom = screen.getByRole("group", { name: "Zoom" });
    expect(draw.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(draw.parentElement).toBe(zoom.parentElement);
  });

  it("offers the draw tools only when the page listens for areas", async () => {
    const { rerender } = renderInPortuguese(<LeadMapCanvas layer={null} />);
    await loadedMap();
    expect(screen.queryByTestId("area-draw-control")).not.toBeInTheDocument();
    rerender(<LeadMapCanvas layer={null} onAreaDrawn={vi.fn()} />);
    expect(screen.getByTestId("area-draw-control")).toBeInTheDocument();
  });

  it("shows an error with retry when the basemap style fails", async () => {
    maps.loadStyle.mockRejectedValueOnce(new Error("offline"));
    renderInPortuguese(<LeadMapCanvas layer={null} />);
    expect(await screen.findByText("Não foi possível carregar o mapa base.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(maps.instances.length).toBe(1));
  });

  it("points MapLibre at the worker served from our own origin before creating the map", async () => {
    renderInPortuguese(<LeadMapCanvas layer={null} />);
    await waitFor(() => expect(maps.instances.length).toBe(1));
    expect(maps.setWorkerUrl).toHaveBeenCalledWith("/maplibre/maplibre-gl-worker.mjs?v=6.13.0");
  });

  it("shows the failure instead of an endless loader when the map cannot start", async () => {
    renderInPortuguese(<LeadMapCanvas layer={null} />);
    await waitFor(() => expect(maps.instances.length).toBe(1));
    act(() => maps.instances[0].fire("error", { error: new Error("Worker failed to load. Check that the worker URL is correct") }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Seu navegador não conseguiu desenhar o mapa.");
    expect(maps.instances[0].removed).toBe(true);
  });

  it("logs the cause of a fatal start and names it on the failure", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      renderInPortuguese(<LeadMapCanvas layer={null} />);
      await waitFor(() => expect(maps.instances.length).toBe(1));
      const cause = new Error("layers.leads-heat.paint.heatmap-weight: bad expression");
      act(() => maps.instances[0].fire("error", { error: cause }));
      expect(await screen.findByRole("alert")).toHaveAttribute("data-map-failure", "start_error");
      expect(logged).toHaveBeenCalledWith(expect.stringContaining("start_error"), cause);
    } finally {
      logged.mockRestore();
    }
  });

  it("logs and names a map that cannot even be created", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const cause = new Error("Failed to initialize WebGL");
    maps.createError = cause;
    try {
      renderInPortuguese(<LeadMapCanvas layer={null} />);
      expect(await screen.findByRole("alert")).toHaveAttribute("data-map-failure", "create_failed");
      expect(logged).toHaveBeenCalledWith(expect.stringContaining("create_failed"), cause);
    } finally {
      maps.createError = null;
      logged.mockRestore();
    }
  });

  it("names a basemap style that could not be loaded", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const cause = new Error("offline");
    maps.loadStyle.mockRejectedValueOnce(cause);
    try {
      renderInPortuguese(<LeadMapCanvas layer={null} />);
      expect(await screen.findByRole("alert")).toHaveAttribute("data-map-failure", "style_unavailable");
      expect(logged).toHaveBeenCalledWith(expect.stringContaining("style_unavailable"), cause);
    } finally {
      logged.mockRestore();
    }
  });

  it("keeps loading when only a style resource is missing", async () => {
    renderInPortuguese(<LeadMapCanvas layer={null} />);
    await waitFor(() => expect(maps.instances.length).toBe(1));
    act(() => maps.instances[0].fire("error", { error: Object.assign(new Error("Not Found"), { status: 404, url: "https://tiles.example/sprite.json" }) }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    act(() => maps.instances[0].fire("load"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("gives up with the failure when the map never finishes loading", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderInPortuguese(<LeadMapCanvas layer={null} />);
      await waitFor(() => expect(maps.instances.length).toBe(1));
      act(() => vi.advanceTimersByTime(19_000));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
      act(() => vi.advanceTimersByTime(1_000));
      expect(screen.getByRole("alert")).toHaveTextContent("Seu navegador não conseguiu desenhar o mapa.");
      expect(screen.getByRole("alert")).toHaveAttribute("data-map-failure", "load_timeout");
      expect(logged).toHaveBeenCalledWith(expect.stringContaining("load_timeout"), expect.anything());
      logged.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("never gives up on a map that waits in a background tab, and counts the time again once the tab is shown", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    try {
      renderInPortuguese(<LeadMapCanvas layer={null} />);
      await waitFor(() => expect(maps.instances.length).toBe(1));
      act(() => vi.advanceTimersByTime(120_000));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(maps.instances[0].removed).toBe(false);
      visibility.mockReturnValue("visible");
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      act(() => vi.advanceTimersByTime(19_000));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      act(() => maps.instances[0].fire("load"));
      act(() => vi.advanceTimersByTime(60_000));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      visibility.mockRestore();
      vi.useRealTimers();
    }
  });

  it("gives up on a map that still cannot load once its tab has been shown for the whole wait", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      renderInPortuguese(<LeadMapCanvas layer={null} />);
      await waitFor(() => expect(maps.instances.length).toBe(1));
      act(() => vi.advanceTimersByTime(15_000));
      visibility.mockReturnValue("visible");
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      act(() => vi.advanceTimersByTime(10_000));
      visibility.mockReturnValue("hidden");
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      act(() => vi.advanceTimersByTime(60_000));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      visibility.mockReturnValue("visible");
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      act(() => vi.advanceTimersByTime(20_000));
      expect(screen.getByRole("alert")).toHaveAttribute("data-map-failure", "load_timeout");
    } finally {
      logged.mockRestore();
      visibility.mockRestore();
      vi.useRealTimers();
    }
  });

  it("does not give up on a map that loaded in time", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderInPortuguese(<LeadMapCanvas layer={null} />);
      await waitFor(() => expect(maps.instances.length).toBe(1));
      act(() => maps.instances[0].fire("load"));
      act(() => vi.advanceTimersByTime(60_000));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("sizes the MapLibre container in flow, since the library forces it to position relative", async () => {
    renderInPortuguese(<LeadMapCanvas layer={null} />);
    await waitFor(() => expect(maps.instances.length).toBe(1));
    const element = maps.instances[0].options.container as HTMLElement;
    expect(element.className.split(" ")).toEqual(expect.arrayContaining(["h-full", "w-full"]));
    expect(element.className).not.toMatch(/absolute|inset-0/);
  });

  it("removes the map when it unmounts", async () => {
    const { unmount } = renderInPortuguese(<LeadMapCanvas layer={null} />);
    const map = await loadedMap();
    unmount();
    expect(map.removed).toBe(true);
  });
});
