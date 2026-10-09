import { describe, expect, it } from "vitest";

import {
  AREA_HANDLE_IMAGE,
  approximateFeatureCollection,
  areaFeatureCollection,
  areaHandleFeatureCollection,
  areaHandleImage,
  clusteredSourceOptions,
  dataLayers,
  districtsFeatureCollection,
  dotFilter,
  LEAD_MAP_LAYERS,
  LEAD_MAP_SOURCES,
  layerVisibility,
  placeFeatureCollection,
  pointsFeatureCollection,
  selectedApproximateFilter,
  selectedFilter,
  type DataLayerOptions,
} from "./layers";
import type { MapPalette } from "./palette";
import type { MapLayerResponse, MapPoint } from "./types";

const palette: MapPalette = {
  tones: {
    "chart-1": "hsl(206, 15%, 9%)",
    "chart-2": "hsl(231, 60%, 56%)",
    "chart-3": "hsl(43, 92%, 45%)",
    "chart-4": "hsl(199, 89%, 42%)",
    "chart-5": "hsl(321, 50%, 46%)",
    neutral: "hsl(206, 9%, 38%)",
  },
  surface: "hsl(0, 0%, 100%)",
  ink: "hsl(206, 15%, 9%)",
  mutedInk: "hsl(206, 9%, 38%)",
  edge: "hsl(205, 12%, 76%)",
  primary: "hsl(164, 100%, 38%)",
  primaryFill: "hsla(164, 100%, 38%, 0.07)",
  primaryHex: "#00c28e",
  primaryEdgeHex: "#009970",
  surfaceHex: "#ffffff",
  dot: "hsl(231, 60%, 56%)",
  clusterStroke: "hsla(231, 60%, 56%, 0.9)",
  heat: [
    { at: 0, color: "rgba(0, 0, 0, 0)" },
    { at: 0.04, color: "rgba(167, 177, 233, 0.1008)" },
    { at: 1, color: "rgba(41, 59, 163, 0.58)" },
  ],
  heatLegend: { from: "hsla(231, 60%, 76%, 0.35)", to: "hsla(231, 60%, 32%, 0.85)" },
  districtFill: "hsla(231, 60%, 56%, 0.28)",
  districtStroke: "hsl(231, 60%, 56%)",
  approximate: "hsl(32, 94%, 29%)",
};

const options: DataLayerOptions = {
  font: ["Noto Sans Regular"],
  boldFont: ["Noto Sans Bold"],
  maxDistrictCount: 400,
  locale: "pt-BR",
  coloured: true,
  heat: { weight: ["interpolate", ["linear"], ["get", "count"], 0, 0, 9, 1], radius: 26 },
};

type LooseLayer = { id: string; type: string; paint: Record<string, unknown>; layout?: Record<string, unknown>; filter?: unknown; source: string };

function layersOf(built: ReturnType<typeof dataLayers>) {
  return (id: string) => {
    const found = built.find((layer) => layer.id === id);
    if (!found) throw new Error(`missing layer ${id}`);
    return found as unknown as LooseLayer;
  };
}

const layers = dataLayers(palette, options);
const byId = layersOf(layers);
const plain = layersOf(dataLayers(palette, { ...options, coloured: false }));

const BUBBLE = ["any", [">", ["get", "people"], 1], ["==", ["get", "group"], true]];
const SINGLE = ["!", BUBBLE];
const LONE = ["all", ["!", ["has", "point_count"]], ["!=", ["get", "group"], true]];

const point: MapPoint = { id: "p1", lat: -23.55, lng: -46.63, precision: "street", placement: "on_map", tone: "chart-3", count: 2, leadIds: ["a", "b"] };
const near: MapPoint = { id: "approximate:-23.55,-46.63", lat: -23.55, lng: -46.63, precision: "district", placement: "approximate", tone: "neutral", count: 3, leadIds: ["c", "d", "e"] };
const cells: MapLayerResponse = {
  kind: "cells",
  cellSizeDegrees: 0.5,
  cells: [
    { ix: -94, iy: -48, placement: "on_map", count: 9, lat: -23.8, lng: -46.7 },
    { ix: -94, iy: -48, placement: "approximate", count: 4, lat: -23.75, lng: -46.72 },
  ],
};

describe("dataLayers", () => {
  it("stacks heat and bairros under the area, approximate leads under precise ones, and the area handles on top", () => {
    expect(layers.map((layer) => layer.id)).toEqual([
      LEAD_MAP_LAYERS.heat,
      LEAD_MAP_LAYERS.districts,
      LEAD_MAP_LAYERS.districtCount,
      LEAD_MAP_LAYERS.areaFill,
      LEAD_MAP_LAYERS.area,
      LEAD_MAP_LAYERS.approximateClusters,
      LEAD_MAP_LAYERS.approximateClusterCount,
      LEAD_MAP_LAYERS.approximateHalo,
      LEAD_MAP_LAYERS.approximate,
      LEAD_MAP_LAYERS.approximateSelected,
      LEAD_MAP_LAYERS.clusters,
      LEAD_MAP_LAYERS.clusterCount,
      LEAD_MAP_LAYERS.dotHalo,
      LEAD_MAP_LAYERS.dots,
      LEAD_MAP_LAYERS.selected,
      LEAD_MAP_LAYERS.placeOutline,
      LEAD_MAP_LAYERS.placePoint,
      LEAD_MAP_LAYERS.areaHandles,
    ]);
  });

  it("draws the heat as a MapLibre heatmap with the chart-2 ramp on the heatmap density", () => {
    const heat = byId(LEAD_MAP_LAYERS.heat);
    expect(heat.type).toBe("heatmap");
    expect(heat.source).toBe(LEAD_MAP_SOURCES.heat);
    expect(heat.paint["heatmap-color"]).toEqual([
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0, "rgba(0, 0, 0, 0)",
      0.04, "rgba(167, 177, 233, 0.1008)",
      1, "rgba(41, 59, 163, 0.58)",
    ]);
    expect(heat.paint["heatmap-weight"]).toEqual(options.heat.weight);
    expect(heat.paint["heatmap-radius"]).toBe(26);
    expect(heat.paint["heatmap-intensity"]).toBeCloseTo(Math.sqrt(2 * Math.PI));
  });

  it("draws one lead as the artifact dot: a 3.4 px tone fill on a 4.6 px card halo", () => {
    const halo = byId(LEAD_MAP_LAYERS.dotHalo);
    expect(halo.paint).toEqual({ "circle-radius": 4.6, "circle-color": palette.surface });
    const dots = byId(LEAD_MAP_LAYERS.dots);
    expect(dots.paint["circle-color"]).toEqual([
      "match",
      ["get", "tone"],
      "chart-1", palette.tones["chart-1"],
      "chart-2", palette.tones["chart-2"],
      "chart-3", palette.tones["chart-3"],
      "chart-4", palette.tones["chart-4"],
      "chart-5", palette.tones["chart-5"],
      palette.surface,
    ]);
    expect(dots.paint["circle-radius"]).toEqual(["match", ["get", "tone"], ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"], 3.4, 2.6]);
    expect(dots.paint["circle-stroke-width"]).toEqual(["match", ["get", "tone"], ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"], 0, 1.6]);
    expect(dots.paint["circle-stroke-color"]).toBe(palette.mutedInk);
  });

  it("draws every precise lead as a solid chart-2 dot when no field colours the map", () => {
    const dots = plain(LEAD_MAP_LAYERS.dots);
    expect(dots.paint["circle-color"]).toBe(palette.dot);
    expect(dots.paint["circle-radius"]).toBe(3.4);
    expect(dots.paint["circle-stroke-width"]).toBe(0);
  });

  it("rings a selected lead at 6.6 px in the primary colour, the only green on the map", () => {
    const selected = byId(LEAD_MAP_LAYERS.selected);
    expect(selected.paint["circle-radius"]).toEqual(["case", [">", ["get", "people"], 1], 17.8, 5.8]);
    expect(selected.paint["circle-color"]).toBe("rgba(0, 0, 0, 0)");
    expect(selected.paint["circle-stroke-color"]).toBe(palette.primary);
    expect(selected.paint["circle-stroke-width"]).toBe(1.6);
  });

  it("draws clusters as the artifact bubble: card fill, 2 px chart-2 ring, bold 11 px count in ink", () => {
    const clusters = byId(LEAD_MAP_LAYERS.clusters);
    expect(clusters.filter).toEqual(BUBBLE);
    expect(clusters.paint["circle-radius"]).toEqual(["step", ["get", "people"], 14, 1000, 17, 100000, 20]);
    expect(clusters.paint["circle-color"]).toBe(palette.surface);
    expect(clusters.paint["circle-stroke-color"]).toBe(palette.clusterStroke);
    expect(clusters.paint["circle-stroke-width"]).toBe(2);
    const count = byId(LEAD_MAP_LAYERS.clusterCount);
    expect(count.filter).toEqual(BUBBLE);
    expect(count.layout?.["text-field"]).toEqual(["number-format", ["get", "people"], { locale: "pt-BR" }]);
    expect(count.layout?.["text-font"]).toEqual(["Noto Sans Bold"]);
    expect(count.layout?.["text-size"]).toBe(11);
    expect(count.paint["text-color"]).toBe(palette.ink);
  });

  it("draws approximate leads with the dot geometry as a hollow warning ink ring, clustered in warning ink", () => {
    expect(byId(LEAD_MAP_LAYERS.approximateHalo).paint).toEqual({ "circle-radius": 4.6, "circle-color": palette.surface });
    const ring = byId(LEAD_MAP_LAYERS.approximate);
    expect(ring.source).toBe(LEAD_MAP_SOURCES.approximate);
    expect(ring.filter).toEqual(SINGLE);
    expect(ring.paint).toEqual({ "circle-radius": 2.6, "circle-color": palette.surface, "circle-stroke-color": palette.approximate, "circle-stroke-width": 1.6 });
    const clusters = byId(LEAD_MAP_LAYERS.approximateClusters);
    expect(clusters.source).toBe(LEAD_MAP_SOURCES.approximate);
    expect(clusters.paint["circle-stroke-color"]).toBe(palette.approximate);
    expect(clusters.paint["circle-color"]).toBe(palette.surface);
    expect(byId(LEAD_MAP_LAYERS.approximateClusterCount).layout?.["text-font"]).toEqual(["Noto Sans Bold"]);
  });

  it("sets approximate bubbles beside a precise bubble at the same spot instead of on top of it", () => {
    const clusters = byId(LEAD_MAP_LAYERS.approximateClusters);
    expect(clusters.paint["circle-translate"]).toEqual([12, -12]);
    const count = byId(LEAD_MAP_LAYERS.approximateClusterCount);
    expect(count.paint["text-translate"]).toEqual([12, -12]);
    expect(byId(LEAD_MAP_LAYERS.clusters).paint["circle-translate"]).toBeUndefined();
  });

  it("rings a selected approximate point like a selected dot", () => {
    const selected = byId(LEAD_MAP_LAYERS.approximateSelected);
    expect(selected.source).toBe(LEAD_MAP_SOURCES.approximate);
    expect(selected.paint["circle-stroke-color"]).toBe(palette.primary);
    expect(selected.filter).toEqual(["all", LONE, ["in", ["get", "id"], ["literal", []]]]);
  });

  it("fills a drawn area with the primary colour at 0.07, outlines it at 2 px and marks its corners with the handle image", () => {
    const fill = byId(LEAD_MAP_LAYERS.areaFill);
    expect(fill.type).toBe("fill");
    expect(fill.source).toBe(LEAD_MAP_SOURCES.area);
    expect(fill.paint["fill-color"]).toBe(palette.primaryFill);
    const line = byId(LEAD_MAP_LAYERS.area);
    expect(line.paint["line-color"]).toBe(palette.primary);
    expect(line.paint["line-width"]).toBe(2);
    const handles = byId(LEAD_MAP_LAYERS.areaHandles);
    expect(handles.source).toBe(LEAD_MAP_SOURCES.areaHandles);
    expect(handles.layout).toMatchObject({ "icon-image": AREA_HANDLE_IMAGE, "icon-allow-overlap": true, "icon-ignore-placement": true });
  });

  it("marks a searched place in ink, dashed for its outline and hollow for its point, never in the selection green", () => {
    const outline = byId(LEAD_MAP_LAYERS.placeOutline);
    expect(outline.source).toBe(LEAD_MAP_SOURCES.place);
    expect(outline.paint["line-color"]).toBe(palette.ink);
    expect(outline.paint["line-dasharray"]).toEqual([2, 2]);
    const mark = byId(LEAD_MAP_LAYERS.placePoint);
    expect(mark.paint["circle-color"]).toBe("rgba(0, 0, 0, 0)");
    expect(mark.paint["circle-stroke-color"]).toBe(palette.ink);
  });

  it("sizes bairro circles by the square root of their count, and keeps them readable when flat", () => {
    expect(byId(LEAD_MAP_LAYERS.districts).paint["circle-radius"]).toEqual(["interpolate", ["linear"], ["sqrt", ["get", "count"]], 1, 6, 20, 28]);
    const flat = layersOf(dataLayers(palette, { ...options, maxDistrictCount: 1 }));
    expect(flat(LEAD_MAP_LAYERS.districts).paint["circle-radius"]).toBe(8);
  });

  it("spends the brand green only on the selection and the drawn area", () => {
    const green = new Set<string>([LEAD_MAP_LAYERS.selected, LEAD_MAP_LAYERS.approximateSelected, LEAD_MAP_LAYERS.area, LEAD_MAP_LAYERS.areaFill]);
    for (const layer of layers) {
      const usesPrimary = JSON.stringify(layer).includes("164, 100%, 38%");
      expect(usesPrimary, layer.id).toBe(green.has(layer.id));
    }
  });
});

describe("filters", () => {
  it("draws single leads as dots in the points layer and only the selected ones over the heat", () => {
    expect(dotFilter("points", { ids: ["p1"], all: false })).toEqual(SINGLE);
    expect(dotFilter("heat", { ids: ["p1"], all: false })).toEqual(["all", SINGLE, ["in", ["get", "id"], ["literal", ["p1"]]]]);
    expect(dotFilter("heat", { ids: [], all: true })).toEqual(SINGLE);
  });

  it("rings the picked leads, or every single precise lead when a drawn area holds the filter", () => {
    expect(selectedFilter({ ids: ["p1", "p2"], all: false }, "points")).toEqual(["all", LONE, ["in", ["get", "id"], ["literal", ["p1", "p2"]]]]);
    expect(selectedFilter({ ids: [], all: true }, "points")).toEqual(SINGLE);
    expect(selectedFilter({ ids: ["p1"], all: false }, "heat")).toEqual(dotFilter("heat", { ids: ["p1"], all: false }));
  });

  it("rings picked approximate points only, never by area", () => {
    expect(selectedApproximateFilter(["a1"])).toEqual(["all", LONE, ["in", ["get", "id"], ["literal", ["a1"]]]]);
  });
});

describe("layerVisibility", () => {
  it("shows the heat and the selected dots in Calor", () => {
    const visible = layerVisibility("heat");
    expect(visible[LEAD_MAP_LAYERS.heat]).toBe("visible");
    expect(visible[LEAD_MAP_LAYERS.dots]).toBe("visible");
    expect(visible[LEAD_MAP_LAYERS.selected]).toBe("visible");
    expect(visible[LEAD_MAP_LAYERS.clusters]).toBe("none");
    expect(visible[LEAD_MAP_LAYERS.approximate]).toBe("none");
    expect(visible[LEAD_MAP_LAYERS.approximateClusters]).toBe("none");
    expect(visible[LEAD_MAP_LAYERS.districts]).toBe("none");
  });

  it("shows dots, clusters and the approximate rings in Pontos, never the heat", () => {
    const visible = layerVisibility("points");
    for (const id of [LEAD_MAP_LAYERS.clusters, LEAD_MAP_LAYERS.clusterCount, LEAD_MAP_LAYERS.dotHalo, LEAD_MAP_LAYERS.dots, LEAD_MAP_LAYERS.approximate, LEAD_MAP_LAYERS.approximateHalo, LEAD_MAP_LAYERS.approximateClusters, LEAD_MAP_LAYERS.approximateSelected]) {
      expect(visible[id], id).toBe("visible");
    }
    expect(visible[LEAD_MAP_LAYERS.heat]).toBe("none");
    expect(visible[LEAD_MAP_LAYERS.districts]).toBe("none");
  });

  it("shows only the bairro circles in Por bairro", () => {
    const visible = layerVisibility("districts");
    expect(visible[LEAD_MAP_LAYERS.districts]).toBe("visible");
    expect(visible[LEAD_MAP_LAYERS.districtCount]).toBe("visible");
    expect(visible[LEAD_MAP_LAYERS.dots]).toBe("none");
    expect(visible[LEAD_MAP_LAYERS.heat]).toBe("none");
    expect(visible[LEAD_MAP_LAYERS.approximate]).toBe("none");
  });

  it("always shows the drawn area and the searched place", () => {
    for (const mode of ["heat", "points", "districts"] as const) {
      const visible = layerVisibility(mode);
      expect(visible[LEAD_MAP_LAYERS.area]).toBe("visible");
      expect(visible[LEAD_MAP_LAYERS.areaFill]).toBe("visible");
      expect(visible[LEAD_MAP_LAYERS.areaHandles]).toBe("visible");
      expect(visible[LEAD_MAP_LAYERS.placeOutline]).toBe("visible");
    }
  });
});

describe("clusteredSourceOptions", () => {
  it("clusters by the people each feature holds", () => {
    expect(clusteredSourceOptions()).toMatchObject({ type: "geojson", cluster: true, clusterProperties: { people: ["+", ["get", "people"]] } });
  });

  it("leaves a few nearby leads as dots, the way the artifact draws a street, and bubbles only real crowds", () => {
    expect(clusteredSourceOptions()).toMatchObject({ clusterRadius: 24, clusterMinPoints: 5 });
  });
});

describe("feature collections", () => {
  it("keeps approximate points out of the precise source, with the fields the layers read", () => {
    expect(pointsFeatureCollection({ kind: "points", points: [point, near] })).toEqual({
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: { type: "Point", coordinates: [-46.63, -23.55] }, properties: { id: "p1", tone: "chart-3", people: 2 } }],
    });
  });

  it("turns precise cells into bubbles at their centre", () => {
    expect(pointsFeatureCollection(cells).features).toEqual([
      { type: "Feature", geometry: { type: "Point", coordinates: [-46.7, -23.8] }, properties: { id: "cell:-94,-48", group: true, people: 9 } },
    ]);
  });

  it("merges cells that sit closer than a bubble apart at the current zoom into the busiest one, keeping precise and approximate apart", () => {
    const fine: MapLayerResponse = {
      kind: "cells",
      cellSizeDegrees: 0.1,
      cells: [
        { ix: 0, iy: 0, placement: "on_map", count: 3, lat: 0.05, lng: 0.05 },
        { ix: 1, iy: 0, placement: "on_map", count: 1, lat: 0.05, lng: 0.15 },
        { ix: 2, iy: 0, placement: "on_map", count: 6, lat: 0.05, lng: 0.25 },
        { ix: 3, iy: 0, placement: "on_map", count: 5, lat: 0.05, lng: 0.35 },
        { ix: 10, iy: 0, placement: "on_map", count: 2, lat: 0.05, lng: 1.05 },
        { ix: 0, iy: 0, placement: "approximate", count: 2, lat: 0.05, lng: 0.05 },
      ],
    };
    const zoom = Math.log2((16 * 360) / (0.1 * 512));
    const merged = pointsFeatureCollection(fine, zoom).features;
    expect(merged.map((feature) => feature.properties)).toEqual([
      { id: "cell:2,0", group: true, people: 15 },
      { id: "cell:10,0", group: true, people: 2 },
    ]);
    expect(merged[0].geometry.coordinates).toEqual([0.25, 0.05]);
    expect(approximateFeatureCollection(fine, zoom).features.map((feature) => feature.properties)).toEqual([
      { id: "approximate-cell:0,0", group: true, people: 2 },
    ]);
    expect(pointsFeatureCollection(fine, zoom + 3).features).toHaveLength(5);
  });

  it("keeps precise leads out of the approximate source, points and cells alike", () => {
    expect(approximateFeatureCollection({ kind: "points", points: [point, near] }).features).toEqual([
      { type: "Feature", geometry: { type: "Point", coordinates: [-46.63, -23.55] }, properties: { id: near.id, people: 3 } },
    ]);
    expect(approximateFeatureCollection(cells).features).toEqual([
      { type: "Feature", geometry: { type: "Point", coordinates: [-46.72, -23.75] }, properties: { id: "approximate-cell:-94,-48", group: true, people: 4 } },
    ]);
    expect(approximateFeatureCollection(null).features).toEqual([]);
    expect(pointsFeatureCollection(null).features).toEqual([]);
  });

  it("places bairros at their point with their key and count", () => {
    const collection = districtsFeatureCollection([
      { pair: "3550308/pinheiros", cityKey: "3550308", districtKey: "pinheiros", name: "Pinheiros", lat: -23.56, lng: -46.69, count: 12 },
    ]);
    expect(collection.features[0].geometry).toEqual({ type: "Point", coordinates: [-46.69, -23.56] });
    expect(collection.features[0].properties).toEqual({ key: "3550308:pinheiros", name: "Pinheiros", count: 12 });
  });

  it("fills every area as a closed polygon, or nothing", () => {
    expect(areaFeatureCollection([]).features).toEqual([]);
    const collection = areaFeatureCollection([
      { kind: "circle", center: { lat: -23.55, lng: -46.65 }, radiusM: 500 },
      { kind: "rectangle", ring: [{ lat: -23.6, lng: -46.7 }, { lat: -23.6, lng: -46.6 }, { lat: -23.5, lng: -46.6 }, { lat: -23.5, lng: -46.7 }] },
    ]);
    expect(collection.features.map((feature) => feature.geometry.type)).toEqual(["Polygon", "Polygon"]);
    expect(collection.features.map((feature) => feature.properties?.kind)).toEqual(["circle", "rectangle"]);
    const ring = collection.features[1].geometry.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it("marks each corner of a polygon or rectangle once, and a circle not at all", () => {
    const handles = areaHandleFeatureCollection([
      { kind: "circle", center: { lat: -23.55, lng: -46.65 }, radiusM: 500 },
      { kind: "polygon", ring: [{ lat: -23.6, lng: -46.7 }, { lat: -23.6, lng: -46.6 }, { lat: -23.5, lng: -46.65 }] },
    ]);
    expect(handles.features.map((feature) => feature.geometry.coordinates)).toEqual([[-46.7, -23.6], [-46.6, -23.6], [-46.65, -23.5]]);
  });

  it("outlines the bounds of a searched place as a closed ring, or marks its point", () => {
    expect(placeFeatureCollection({ kind: "bounds", bounds: { south: -6.4, west: -35.6, north: -6.2, east: -35.4 } }).features[0].geometry).toEqual({
      type: "LineString",
      coordinates: [[-35.6, -6.4], [-35.4, -6.4], [-35.4, -6.2], [-35.6, -6.2], [-35.6, -6.4]],
    });
    expect(placeFeatureCollection({ kind: "point", at: { lat: -6.31, lng: -35.48 } }).features[0].geometry).toEqual({ type: "Point", coordinates: [-35.48, -6.31] });
    expect(placeFeatureCollection(null).features).toEqual([]);
  });
});

describe("areaHandleImage", () => {
  const pixel = (image: ReturnType<typeof areaHandleImage>, x: number, y: number) => Array.from(image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4));

  it("draws the artifact handle: an 8 px card square inside a 1.6 px primary edge stroke", () => {
    const image = areaHandleImage("#ffffff", "#009970", 1);
    expect(image.width).toBe(10);
    expect(image.height).toBe(10);
    expect(pixel(image, 0, 0)).toEqual([0, 153, 112, 255]);
    expect(pixel(image, 1, 5)).toEqual([0, 153, 112, 255]);
    expect(pixel(image, 5, 5)).toEqual([255, 255, 255, 255]);
    expect(pixel(image, 9, 9)).toEqual([0, 153, 112, 255]);
  });

  it("scales with the screen pixel ratio", () => {
    const image = areaHandleImage("#ffffff", "#009970", 2);
    expect(image.width).toBe(19);
    expect(pixel(image, 2, 9)).toEqual([0, 153, 112, 255]);
    expect(pixel(image, 3, 9)).toEqual([255, 255, 255, 255]);
  });
});
