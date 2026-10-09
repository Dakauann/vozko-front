import type { FeatureCollection, LineString, Point, Polygon } from "geojson";
import type { ExpressionSpecification, FilterSpecification, GeoJSONSourceSpecification, LayerSpecification } from "maplibre-gl";

import { areaOutline } from "./area";
import { HEAT_INTENSITY } from "./heat";
import { latToMercatorY } from "./tiles";
import type { MapPalette } from "./palette";
import { TONE_KEYS, type AreaShape, type DistrictCount, type MapLayerMode, type MapLayerResponse, type MapPlaceMarker } from "./types";

export const LEAD_MAP_SOURCES = {
  points: "leads-points",
  approximate: "leads-approximate",
  heat: "leads-heat",
  districts: "leads-districts",
  place: "leads-place",
  area: "leads-area",
  areaHandles: "leads-area-handles",
} as const;

export const LEAD_MAP_LAYERS = {
  heat: "leads-heat",
  districts: "leads-districts",
  districtCount: "leads-district-count",
  areaFill: "leads-area-fill",
  area: "leads-area",
  approximateClusters: "leads-approximate-clusters",
  approximateClusterCount: "leads-approximate-cluster-count",
  approximateHalo: "leads-approximate-halo",
  approximate: "leads-approximate",
  approximateSelected: "leads-approximate-selected",
  clusters: "leads-clusters",
  clusterCount: "leads-cluster-count",
  dotHalo: "leads-dot-halo",
  dots: "leads-dots",
  selected: "leads-selected",
  placeOutline: "leads-place-outline",
  placePoint: "leads-place-point",
  areaHandles: "leads-area-handles",
} as const;

export type LeadMapLayerId = (typeof LEAD_MAP_LAYERS)[keyof typeof LEAD_MAP_LAYERS];

export const AREA_HANDLE_IMAGE = "lead-map-area-handle";

export interface HeatPaint {
  weight: ExpressionSpecification | number;
  radius: ExpressionSpecification | number;
}

export interface DataLayerOptions {
  font: string[];
  boldFont: string[];
  maxDistrictCount: number;
  locale: string;
  coloured: boolean;
  heat: HeatPaint;
}

export interface MapSelection {
  ids: readonly string[];
  all: boolean;
}

export const CLUSTER_MAX_ZOOM = 13;
const CLUSTER_RADIUS = 24;
const CLUSTER_MIN_POINTS = 5;
const BUBBLE_SPACING_PX = 40;
const WORLD_PIXELS_AT_ZOOM_ZERO = 512;
const DEGREES_AROUND = 360;
const DOT_RADIUS = 3.4;
const HALO_RADIUS = 4.6;
const RING_STROKE = 1.6;
const HOLLOW_RADIUS = 2.6;
const SELECTED_RADIUS = 5.8;
const BUBBLE_RADIUS = 14;
const BUBBLE_STROKE = 2;
const SELECTED_BUBBLE_RADIUS = 17.8;
const BUBBLE_TEXT_SIZE = 11;
const APPROXIMATE_BESIDE: [number, number] = [12, -12];
const AREA_LINE_PX = 2;
const PLACE_LINE_PX = 1.5;
const HANDLE_SIZE = 9.6;
const HANDLE_STROKE = 1.6;
const TRANSPARENT = "rgba(0, 0, 0, 0)";
const DISTRICT_MIN_RADIUS = 6;
const DISTRICT_MAX_RADIUS = 28;
const DISTRICT_FLAT_RADIUS = 8;
const COLOURED_TONES = TONE_KEYS.filter((tone) => tone !== "neutral");

const BUBBLE: FilterSpecification = ["any", [">", ["get", "people"], 1], ["==", ["get", "group"], true]];
const SINGLE: FilterSpecification = ["!", BUBBLE] as FilterSpecification;
const LONE: FilterSpecification = ["all", ["!", ["has", "point_count"]], ["!=", ["get", "group"], true]];

function pickedBy(ids: readonly string[]): FilterSpecification {
  return ["in", ["get", "id"], ["literal", [...ids]]] as FilterSpecification;
}

export function dotFilter(mode: MapLayerMode, selection: MapSelection): FilterSpecification {
  if (mode !== "heat" || selection.all) return SINGLE;
  return ["all", SINGLE, pickedBy(selection.ids)] as FilterSpecification;
}

export function selectedFilter(selection: MapSelection, mode: MapLayerMode): FilterSpecification {
  if (mode === "heat") return dotFilter(mode, selection);
  if (selection.all) return SINGLE;
  return ["all", LONE, pickedBy(selection.ids)] as FilterSpecification;
}

export function selectedApproximateFilter(ids: readonly string[]): FilterSpecification {
  return ["all", LONE, pickedBy(ids)] as FilterSpecification;
}

function toneFill(palette: MapPalette): ExpressionSpecification {
  const pairs = COLOURED_TONES.flatMap((tone) => [tone, palette.tones[tone]]);
  return ["match", ["get", "tone"], ...pairs, palette.surface] as unknown as ExpressionSpecification;
}

function byTone(coloured: number, hollow: number): ExpressionSpecification {
  return ["match", ["get", "tone"], [...COLOURED_TONES], coloured, hollow] as unknown as ExpressionSpecification;
}

function dotPaint(palette: MapPalette, coloured: boolean) {
  if (!coloured) {
    return { "circle-radius": DOT_RADIUS, "circle-color": palette.dot, "circle-stroke-color": palette.mutedInk, "circle-stroke-width": 0 };
  }
  return {
    "circle-radius": byTone(DOT_RADIUS, HOLLOW_RADIUS),
    "circle-color": toneFill(palette),
    "circle-stroke-color": palette.mutedInk,
    "circle-stroke-width": byTone(0, RING_STROKE),
  };
}

function heatColor(palette: MapPalette): ExpressionSpecification {
  const stops = palette.heat.flatMap((stop) => [stop.at, stop.color]);
  return ["interpolate", ["linear"], ["heatmap-density"], ...stops] as unknown as ExpressionSpecification;
}

function districtRadius(maxCount: number): ExpressionSpecification | number {
  const top = Math.sqrt(Math.max(0, maxCount));
  if (top <= 1) return DISTRICT_FLAT_RADIUS;
  return ["interpolate", ["linear"], ["sqrt", ["get", "count"]], 1, DISTRICT_MIN_RADIUS, top, DISTRICT_MAX_RADIUS];
}

function countLabel(field: string, locale: string): ExpressionSpecification {
  return ["number-format", ["get", field], { locale }];
}

function halo(id: string, source: string, palette: MapPalette): LayerSpecification {
  return { id, type: "circle", source, filter: SINGLE, paint: { "circle-radius": HALO_RADIUS, "circle-color": palette.surface } };
}

function bubbles(
  id: string,
  countId: string,
  source: string,
  stroke: string,
  palette: MapPalette,
  options: DataLayerOptions,
  beside?: [number, number],
): LayerSpecification[] {
  return [
    {
      id,
      type: "circle",
      source,
      filter: BUBBLE,
      paint: {
        "circle-radius": ["step", ["get", "people"], BUBBLE_RADIUS, 1000, 17, 100000, 20],
        "circle-color": palette.surface,
        "circle-stroke-color": stroke,
        "circle-stroke-width": BUBBLE_STROKE,
        ...(beside ? { "circle-translate": beside } : {}),
      },
    },
    {
      id: countId,
      type: "symbol",
      source,
      filter: BUBBLE,
      layout: {
        "text-field": countLabel("people", options.locale),
        "text-font": options.boldFont,
        "text-size": BUBBLE_TEXT_SIZE,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: { "text-color": palette.ink, ...(beside ? { "text-translate": beside } : {}) },
    },
  ];
}

function selectionRing(id: string, source: string, filter: FilterSpecification, palette: MapPalette): LayerSpecification {
  return {
    id,
    type: "circle",
    source,
    filter,
    paint: {
      "circle-radius": ["case", [">", ["get", "people"], 1], SELECTED_BUBBLE_RADIUS, SELECTED_RADIUS],
      "circle-color": TRANSPARENT,
      "circle-stroke-color": palette.primary,
      "circle-stroke-width": RING_STROKE,
    },
  };
}

export function dataLayers(palette: MapPalette, options: DataLayerOptions): LayerSpecification[] {
  const nobody: MapSelection = { ids: [], all: false };
  return [
    {
      id: LEAD_MAP_LAYERS.heat,
      type: "heatmap",
      source: LEAD_MAP_SOURCES.heat,
      paint: {
        "heatmap-color": heatColor(palette),
        "heatmap-weight": options.heat.weight,
        "heatmap-radius": options.heat.radius,
        "heatmap-intensity": HEAT_INTENSITY,
        "heatmap-opacity": 1,
      },
    },
    {
      id: LEAD_MAP_LAYERS.districts,
      type: "circle",
      source: LEAD_MAP_SOURCES.districts,
      paint: {
        "circle-radius": districtRadius(options.maxDistrictCount),
        "circle-color": palette.districtFill,
        "circle-stroke-color": palette.districtStroke,
        "circle-stroke-width": 1.5,
      },
    },
    {
      id: LEAD_MAP_LAYERS.districtCount,
      type: "symbol",
      source: LEAD_MAP_SOURCES.districts,
      layout: { "text-field": countLabel("count", options.locale), "text-font": options.font, "text-size": 11, "text-allow-overlap": false },
      paint: { "text-color": palette.ink, "text-halo-color": palette.surface, "text-halo-width": 1.5 },
    },
    {
      id: LEAD_MAP_LAYERS.areaFill,
      type: "fill",
      source: LEAD_MAP_SOURCES.area,
      paint: { "fill-color": palette.primaryFill },
    },
    {
      id: LEAD_MAP_LAYERS.area,
      type: "line",
      source: LEAD_MAP_SOURCES.area,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": palette.primary, "line-width": AREA_LINE_PX },
    },
    ...bubbles(
      LEAD_MAP_LAYERS.approximateClusters,
      LEAD_MAP_LAYERS.approximateClusterCount,
      LEAD_MAP_SOURCES.approximate,
      palette.approximate,
      palette,
      options,
      APPROXIMATE_BESIDE,
    ),
    halo(LEAD_MAP_LAYERS.approximateHalo, LEAD_MAP_SOURCES.approximate, palette),
    {
      id: LEAD_MAP_LAYERS.approximate,
      type: "circle",
      source: LEAD_MAP_SOURCES.approximate,
      filter: SINGLE,
      paint: {
        "circle-radius": HOLLOW_RADIUS,
        "circle-color": palette.surface,
        "circle-stroke-color": palette.approximate,
        "circle-stroke-width": RING_STROKE,
      },
    },
    selectionRing(LEAD_MAP_LAYERS.approximateSelected, LEAD_MAP_SOURCES.approximate, selectedApproximateFilter([]), palette),
    ...bubbles(LEAD_MAP_LAYERS.clusters, LEAD_MAP_LAYERS.clusterCount, LEAD_MAP_SOURCES.points, palette.clusterStroke, palette, options),
    halo(LEAD_MAP_LAYERS.dotHalo, LEAD_MAP_SOURCES.points, palette),
    {
      id: LEAD_MAP_LAYERS.dots,
      type: "circle",
      source: LEAD_MAP_SOURCES.points,
      filter: SINGLE,
      paint: dotPaint(palette, options.coloured),
    },
    selectionRing(LEAD_MAP_LAYERS.selected, LEAD_MAP_SOURCES.points, selectedFilter(nobody, "points"), palette),
    {
      id: LEAD_MAP_LAYERS.placeOutline,
      type: "line",
      source: LEAD_MAP_SOURCES.place,
      filter: ["==", ["geometry-type"], "LineString"],
      layout: { "line-join": "round" },
      paint: { "line-color": palette.ink, "line-width": PLACE_LINE_PX, "line-dasharray": [2, 2] },
    },
    {
      id: LEAD_MAP_LAYERS.placePoint,
      type: "circle",
      source: LEAD_MAP_SOURCES.place,
      filter: ["==", ["geometry-type"], "Point"],
      paint: { "circle-radius": 11, "circle-color": TRANSPARENT, "circle-stroke-color": palette.ink, "circle-stroke-width": PLACE_LINE_PX },
    },
    {
      id: LEAD_MAP_LAYERS.areaHandles,
      type: "symbol",
      source: LEAD_MAP_SOURCES.areaHandles,
      layout: { "icon-image": AREA_HANDLE_IMAGE, "icon-allow-overlap": true, "icon-ignore-placement": true },
    },
  ];
}

const HEAT_LAYERS: LeadMapLayerId[] = [LEAD_MAP_LAYERS.heat];

const SINGLE_DOT_LAYERS: LeadMapLayerId[] = [LEAD_MAP_LAYERS.dotHalo, LEAD_MAP_LAYERS.dots, LEAD_MAP_LAYERS.selected];

const POINT_ONLY_LAYERS: LeadMapLayerId[] = [
  LEAD_MAP_LAYERS.clusters,
  LEAD_MAP_LAYERS.clusterCount,
  LEAD_MAP_LAYERS.approximateClusters,
  LEAD_MAP_LAYERS.approximateClusterCount,
  LEAD_MAP_LAYERS.approximateHalo,
  LEAD_MAP_LAYERS.approximate,
  LEAD_MAP_LAYERS.approximateSelected,
];

const DISTRICT_LAYERS: LeadMapLayerId[] = [LEAD_MAP_LAYERS.districts, LEAD_MAP_LAYERS.districtCount];

export function layerVisibility(mode: MapLayerMode): Record<LeadMapLayerId, "visible" | "none"> {
  const visibility = {} as Record<LeadMapLayerId, "visible" | "none">;
  for (const id of Object.values(LEAD_MAP_LAYERS)) visibility[id] = "visible";
  const hide = (ids: LeadMapLayerId[], hidden: boolean) => {
    for (const id of ids) visibility[id] = hidden ? "none" : "visible";
  };
  hide(HEAT_LAYERS, mode !== "heat");
  hide(SINGLE_DOT_LAYERS, mode === "districts");
  hide(POINT_ONLY_LAYERS, mode !== "points");
  hide(DISTRICT_LAYERS, mode !== "districts");
  return visibility;
}

export function clusteredSourceOptions(): Omit<GeoJSONSourceSpecification, "data"> {
  return {
    type: "geojson",
    cluster: true,
    clusterMaxZoom: CLUSTER_MAX_ZOOM,
    clusterRadius: CLUSTER_RADIUS,
    clusterMinPoints: CLUSTER_MIN_POINTS,
    clusterProperties: { people: ["+", ["get", "people"]] },
  };
}

type Placement = "on_map" | "approximate";

const CELL_ID_PREFIX: Record<Placement, string> = { on_map: "cell", approximate: "approximate-cell" };

interface CellBubble {
  ix: number;
  iy: number;
  people: number;
  lat: number;
  lng: number;
  x: number;
  y: number;
}

type BubbleCell = { ix: number; iy: number; count: number; lat: number; lng: number };

function screenPoint(lat: number, lng: number, zoom: number): [number, number] {
  const world = WORLD_PIXELS_AT_ZOOM_ZERO * 2 ** zoom;
  return [((lng + DEGREES_AROUND / 2) / DEGREES_AROUND) * world, ((Math.PI - latToMercatorY(lat)) / (2 * Math.PI)) * world];
}

const NEIGHBOUR_BUCKETS = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => [dx, dy] as const));

function bucketOf(x: number, y: number): [number, number] {
  return [Math.floor(x / BUBBLE_SPACING_PX), Math.floor(y / BUBBLE_SPACING_PX)];
}

function bubbleNear(buckets: ReadonlyMap<string, CellBubble[]>, x: number, y: number): CellBubble | undefined {
  const [bx, by] = bucketOf(x, y);
  for (const [dx, dy] of NEIGHBOUR_BUCKETS) {
    const near = buckets.get(`${bx + dx},${by + dy}`)?.find((bubble) => Math.hypot(bubble.x - x, bubble.y - y) < BUBBLE_SPACING_PX);
    if (near) return near;
  }
  return undefined;
}

function cellBubbles(cells: readonly BubbleCell[], zoom: number | undefined): CellBubble[] {
  const busiestFirst = [...cells].sort((a, b) => b.count - a.count || a.ix - b.ix || a.iy - b.iy);
  const merges = zoom !== undefined && Number.isFinite(zoom);
  const bubbles: CellBubble[] = [];
  const buckets = new Map<string, CellBubble[]>();
  for (const cell of busiestFirst) {
    const [x, y] = merges ? screenPoint(cell.lat, cell.lng, zoom) : [Number.NaN, Number.NaN];
    const near = merges ? bubbleNear(buckets, x, y) : undefined;
    if (near) {
      near.people += cell.count;
      continue;
    }
    const bubble: CellBubble = { ix: cell.ix, iy: cell.iy, people: cell.count, lat: cell.lat, lng: cell.lng, x, y };
    bubbles.push(bubble);
    if (merges) {
      const key = bucketOf(x, y).join(",");
      buckets.set(key, [...(buckets.get(key) ?? []), bubble]);
    }
  }
  return bubbles;
}

function placedFeatures(layer: MapLayerResponse | null, placement: Placement, zoom: number | undefined): FeatureCollection<Point> {
  if (!layer) return { type: "FeatureCollection", features: [] };
  if (layer.kind === "points") {
    return {
      type: "FeatureCollection",
      features: layer.points
        .filter((point) => point.placement === placement)
        .map((point) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [point.lng, point.lat] },
          properties: placement === "on_map" ? { id: point.id, tone: point.tone, people: point.count } : { id: point.id, people: point.count },
        })),
    };
  }
  return {
    type: "FeatureCollection",
    features: cellBubbles(layer.cells.filter((cell) => cell.placement === placement), zoom).map((bubble) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [bubble.lng, bubble.lat] },
      properties: { id: `${CELL_ID_PREFIX[placement]}:${bubble.ix},${bubble.iy}`, group: true, people: bubble.people },
    })),
  };
}

export function pointsFeatureCollection(layer: MapLayerResponse | null, zoom?: number): FeatureCollection<Point> {
  return placedFeatures(layer, "on_map", zoom);
}

export function approximateFeatureCollection(layer: MapLayerResponse | null, zoom?: number): FeatureCollection<Point> {
  return placedFeatures(layer, "approximate", zoom);
}

export function districtKey(district: Pick<DistrictCount, "cityKey" | "districtKey">): string {
  return `${district.cityKey}:${district.districtKey}`;
}

export function districtsFeatureCollection(districts: DistrictCount[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: districts.map((district) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [district.lng, district.lat] },
      properties: { key: districtKey(district), name: district.name, count: district.count },
    })),
  };
}

export function placeFeatureCollection(marker: MapPlaceMarker | null): FeatureCollection<LineString | Point> {
  if (!marker) return { type: "FeatureCollection", features: [] };
  if (marker.kind === "point") {
    return {
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: { type: "Point", coordinates: [marker.at.lng, marker.at.lat] }, properties: {} }],
    };
  }
  const { south, west, north, east } = marker.bounds;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates: [[west, south], [east, south], [east, north], [west, north], [west, south]] },
        properties: {},
      },
    ],
  };
}

export function areaFeatureCollection(areas: readonly AreaShape[]): FeatureCollection<Polygon> {
  return {
    type: "FeatureCollection",
    features: areas.map((area) => ({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [areaOutline(area)] },
      properties: { kind: area.kind },
    })),
  };
}

export function areaHandleFeatureCollection(areas: readonly AreaShape[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: areas.flatMap((area) =>
      area.kind === "circle"
        ? []
        : area.ring.map((corner) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [corner.lng, corner.lat] },
            properties: {},
          })),
    ),
  };
}

export interface HandleImage {
  width: number;
  height: number;
  data: Uint8Array;
}

function hexChannels(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number];
}

export function areaHandleImage(fillHex: string, strokeHex: string, pixelRatio: number): HandleImage {
  const size = Math.round(HANDLE_SIZE * pixelRatio);
  const band = Math.max(1, Math.round(HANDLE_STROKE * pixelRatio));
  const fill = hexChannels(fillHex);
  const stroke = hexChannels(strokeHex);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const edge = x < band || y < band || x >= size - band || y >= size - band;
      const [r, g, b] = edge ? stroke : fill;
      const at = (y * size + x) * 4;
      data[at] = r;
      data[at + 1] = g;
      data[at + 2] = b;
      data[at + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}
