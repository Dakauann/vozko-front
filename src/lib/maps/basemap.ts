import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

import type { BasemapPalette, BasemapRole } from "./palette";

export type LayerRole = Exclude<BasemapRole, "halo"> | "hidden";

export interface StylePatch {
  layerId: string;
  kind: "paint" | "layout";
  property: string;
  value: unknown;
}

export interface PatchableMap {
  getLayer(id: string): unknown;
  setPaintProperty(layerId: string, name: string, value: unknown): unknown;
  setLayoutProperty(layerId: string, name: string, value: unknown): unknown;
}

export const DEFAULT_LABEL_FONT = ["Noto Sans Regular"];
export const DEFAULT_BOLD_FONT = ["Noto Sans Bold"];
const DEFAULT_LABEL_LANGUAGE = "pt";
const LANGUAGE_CODE = /^[a-z]{2,3}$/;

const WATER = new Set(["water", "waterway", "physical_line"]);
const LANDCOVER = new Set(["park", "landcover", "landuse", "natural"]);
const BUILDING = new Set(["building", "buildings"]);
const LAND = new Set(["earth"]);
const BOUNDARY = new Set(["boundary", "boundaries"]);
const ROADS = new Set(["transportation", "aeroway", "roads", "transit"]);
const PLACES = new Set(["place", "places"]);

type LooseLayer = {
  id: string;
  type: string;
  "source-layer"?: string;
  layout?: Record<string, unknown>;
};

function lineRole(layer: LooseLayer, sourceLayer: string): LayerRole | null {
  if (WATER.has(sourceLayer)) return "water";
  if (BOUNDARY.has(sourceLayer)) return "boundary";
  if (!ROADS.has(sourceLayer)) return null;
  if (layer.id.includes("rail")) return "rail";
  if (layer.id.includes("casing")) return "roadCasing";
  return "road";
}

function fillRole(sourceLayer: string): LayerRole | null {
  if (WATER.has(sourceLayer)) return "water";
  if (LANDCOVER.has(sourceLayer)) return "landcover";
  if (BUILDING.has(sourceLayer)) return "building";
  if (LAND.has(sourceLayer) || ROADS.has(sourceLayer)) return "land";
  return null;
}

function symbolRole(layer: LooseLayer, sourceLayer: string): LayerRole {
  if (sourceLayer === "transportation_name" && layer.layout?.["icon-image"] !== undefined) return "hidden";
  if (PLACES.has(sourceLayer)) return "placeLabel";
  return "label";
}

export function basemapRole(spec: LayerSpecification): LayerRole | null {
  const layer = spec as unknown as LooseLayer;
  const sourceLayer = layer["source-layer"] ?? "";
  switch (layer.type) {
    case "background":
      return "land";
    case "raster":
      return "hidden";
    case "fill":
      return fillRole(sourceLayer);
    case "line":
      return lineRole(layer, sourceLayer);
    case "symbol":
      return symbolRole(layer, sourceLayer);
    default:
      return null;
  }
}

function patchesFor(spec: LayerSpecification, role: LayerRole, palette: BasemapPalette): StylePatch[] {
  const layer = spec as unknown as LooseLayer;
  const paint = (property: string, value: unknown): StylePatch => ({ layerId: layer.id, kind: "paint", property, value });
  if (role === "hidden") return [{ layerId: layer.id, kind: "layout", property: "visibility", value: "none" }];
  switch (layer.type) {
    case "background":
      return [paint("background-color", palette[role])];
    case "fill":
      return role === "building"
        ? [paint("fill-color", palette.building), paint("fill-outline-color", palette.roadCasing)]
        : [paint("fill-color", palette[role])];
    case "line":
      return [paint("line-color", palette[role])];
    case "symbol": {
      const patches = [paint("text-color", palette[role]), paint("text-halo-color", palette.halo)];
      if (layer.layout?.["icon-image"] !== undefined) patches.push(paint("icon-opacity", 0));
      return patches;
    }
    default:
      return [];
  }
}

export function basemapPatches(layers: LayerSpecification[], palette: BasemapPalette): StylePatch[] {
  return layers.flatMap((layer) => {
    const role = basemapRole(layer);
    return role ? patchesFor(layer, role, palette) : [];
  });
}

export function applyPatchesToStyle(style: StyleSpecification, patches: StylePatch[]): StyleSpecification {
  const copy = JSON.parse(JSON.stringify(style)) as StyleSpecification;
  const layers = new Map(copy.layers.map((layer) => [layer.id, layer as unknown as Record<string, Record<string, unknown> | undefined>]));
  for (const patch of patches) {
    const layer = layers.get(patch.layerId);
    if (!layer) continue;
    const group = layer[patch.kind] ?? {};
    group[patch.property] = patch.value;
    layer[patch.kind] = group;
  }
  return copy;
}

export function applyPatchesToMap(map: PatchableMap, patches: StylePatch[]): void {
  for (const patch of patches) {
    if (!map.getLayer(patch.layerId)) continue;
    if (patch.kind === "paint") map.setPaintProperty(patch.layerId, patch.property, patch.value);
    else map.setLayoutProperty(patch.layerId, patch.property, patch.value);
  }
}

function textFonts(layers: LayerSpecification[]): string[][] {
  return layers
    .map((layer) => (layer as unknown as LooseLayer).layout?.["text-font"])
    .filter((font): font is string[] => Array.isArray(font) && font.every((name) => typeof name === "string"));
}

export function labelFont(layers: LayerSpecification[]): string[] {
  const fonts = textFonts(layers);
  return fonts.find((font) => font.some((name) => name.includes("Regular"))) ?? fonts[0] ?? DEFAULT_LABEL_FONT;
}

export function labelBoldFont(layers: LayerSpecification[]): string[] {
  return textFonts(layers).find((font) => font.some((name) => name.includes("Bold"))) ?? DEFAULT_BOLD_FONT;
}

const DISAMBIGUATION = " (";

function localizedName(property: string): unknown[] {
  const cut = ["index-of", DISAMBIGUATION, ["var", "localized"]];
  return [
    "case",
    ["has", property],
    ["let", "localized", ["to-string", ["get", property]], ["case", [">", cut, 0], ["slice", ["var", "localized"], 0, cut], ["var", "localized"]]],
    ["coalesce", ["get", "name:latin"], ["get", "name"]],
  ];
}

function namesPlace(textField: unknown): boolean {
  return textField !== undefined && JSON.stringify(textField).includes("name");
}

export function labelLanguagePatches(layers: LayerSpecification[], language: string): StylePatch[] {
  const code = LANGUAGE_CODE.test(language) ? language : DEFAULT_LABEL_LANGUAGE;
  const value = localizedName(`name:${code}`);
  return layers.flatMap((spec) => {
    const layer = spec as unknown as LooseLayer;
    if (layer.type !== "symbol" || !namesPlace(layer.layout?.["text-field"])) return [];
    return [{ layerId: layer.id, kind: "layout", property: "text-field", value }];
  });
}

export function layerPaintPatches(layers: LayerSpecification[]): StylePatch[] {
  return layers.flatMap((spec) => {
    const layer = spec as unknown as { id: string; paint?: Record<string, unknown> };
    return Object.entries(layer.paint ?? {}).map(([property, value]): StylePatch => ({ layerId: layer.id, kind: "paint", property, value }));
  });
}
