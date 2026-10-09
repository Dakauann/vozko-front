import { describe, expect, it } from "vitest";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import { expression } from "@maplibre/maplibre-gl-style-spec";

import { applyPatchesToMap, applyPatchesToStyle, basemapPatches, basemapRole, labelBoldFont, labelFont, labelLanguagePatches, layerPaintPatches } from "./basemap";
import type { BasemapPalette } from "./palette";

const palette: BasemapPalette = {
  land: "hsl(1, 1%, 1%)",
  landcover: "hsl(2, 2%, 2%)",
  water: "hsl(3, 3%, 3%)",
  building: "hsl(4, 4%, 4%)",
  road: "hsl(5, 5%, 5%)",
  roadCasing: "hsl(6, 6%, 6%)",
  rail: "hsl(7, 7%, 7%)",
  boundary: "hsl(8, 8%, 8%)",
  label: "hsl(9, 9%, 9%)",
  placeLabel: "hsl(10, 10%, 10%)",
  halo: "hsl(11, 11%, 11%)",
};

const layer = (spec: Record<string, unknown>) => spec as unknown as LayerSpecification;

const positronLayers = [
  layer({ id: "background", type: "background", paint: { "background-color": "rgb(242,243,240)" } }),
  layer({ id: "park", type: "fill", source: "openmaptiles", "source-layer": "park", paint: {} }),
  layer({ id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: {} }),
  layer({ id: "landuse_residential", type: "fill", source: "openmaptiles", "source-layer": "landuse", paint: {} }),
  layer({ id: "waterway", type: "line", source: "openmaptiles", "source-layer": "waterway", paint: {} }),
  layer({ id: "building", type: "fill", source: "openmaptiles", "source-layer": "building", paint: {} }),
  layer({ id: "highway_minor", type: "line", source: "openmaptiles", "source-layer": "transportation", paint: {} }),
  layer({ id: "highway_major_casing", type: "line", source: "openmaptiles", "source-layer": "transportation", paint: {} }),
  layer({ id: "road_area_pier", type: "fill", source: "openmaptiles", "source-layer": "transportation", paint: {} }),
  layer({ id: "railway_transit", type: "line", source: "openmaptiles", "source-layer": "transportation", filter: ["==", ["get", "class"], "transit"], paint: {} }),
  layer({ id: "aeroway-runway", type: "line", source: "openmaptiles", "source-layer": "aeroway", paint: {} }),
  layer({ id: "boundary_2", type: "line", source: "openmaptiles", "source-layer": "boundary", paint: {} }),
  layer({ id: "highway-name-minor", type: "symbol", source: "openmaptiles", "source-layer": "transportation_name", layout: { "text-font": ["Noto Sans Regular"] }, paint: {} }),
  layer({ id: "highway-shield-non-us", type: "symbol", source: "openmaptiles", "source-layer": "transportation_name", layout: { "icon-image": "road_{ref_length}" }, paint: {} }),
  layer({ id: "water_name_point_label", type: "symbol", source: "openmaptiles", "source-layer": "water_name", layout: {}, paint: {} }),
  layer({ id: "label_city", type: "symbol", source: "openmaptiles", "source-layer": "place", layout: { "icon-image": "circle_11_black", "text-font": ["Noto Sans Regular"] }, paint: {} }),
  layer({ id: "ne2_shaded", type: "raster", source: "ne2_shaded" }),
];

describe("basemapRole", () => {
  it.each([
    ["background", "land"],
    ["park", "landcover"],
    ["water", "water"],
    ["landuse_residential", "landcover"],
    ["waterway", "water"],
    ["building", "building"],
    ["highway_minor", "road"],
    ["highway_major_casing", "roadCasing"],
    ["road_area_pier", "land"],
    ["railway_transit", "rail"],
    ["aeroway-runway", "road"],
    ["boundary_2", "boundary"],
    ["highway-name-minor", "label"],
    ["highway-shield-non-us", "hidden"],
    ["water_name_point_label", "label"],
    ["label_city", "placeLabel"],
    ["ne2_shaded", "hidden"],
  ])("gives the OpenMapTiles layer %s the %s role", (id, role) => {
    expect(basemapRole(positronLayers.find((l) => l.id === id)!)).toBe(role);
  });

  it.each([
    [{ id: "earth", type: "fill", source: "protomaps", "source-layer": "earth" }, "land"],
    [{ id: "roads_minor", type: "line", source: "protomaps", "source-layer": "roads" }, "road"],
    [{ id: "boundaries", type: "line", source: "protomaps", "source-layer": "boundaries" }, "boundary"],
    [{ id: "buildings", type: "fill", source: "protomaps", "source-layer": "buildings" }, "building"],
    [{ id: "places_locality", type: "symbol", source: "protomaps", "source-layer": "places" }, "placeLabel"],
  ])("gives the Protomaps fallback layer %o the %s role", (spec, role) => {
    expect(basemapRole(layer(spec))).toBe(role);
  });

  it("leaves a layer it does not recognise alone", () => {
    expect(basemapRole(layer({ id: "x", type: "fill", source: "s", "source-layer": "mystery" }))).toBeNull();
    expect(basemapRole(layer({ id: "hill", type: "hillshade", source: "dem" }))).toBeNull();
  });
});

describe("basemapPatches", () => {
  const patches = basemapPatches(positronLayers, palette);
  const patchFor = (layerId: string, property: string) =>
    patches.find((p) => p.layerId === layerId && p.property === property)?.value;

  it("paints land, water, landcover and buildings from the palette", () => {
    expect(patchFor("background", "background-color")).toBe(palette.land);
    expect(patchFor("water", "fill-color")).toBe(palette.water);
    expect(patchFor("waterway", "line-color")).toBe(palette.water);
    expect(patchFor("park", "fill-color")).toBe(palette.landcover);
    expect(patchFor("building", "fill-color")).toBe(palette.building);
    expect(patchFor("building", "fill-outline-color")).toBe(palette.roadCasing);
  });

  it("paints roads, casings, rails and boundaries", () => {
    expect(patchFor("highway_minor", "line-color")).toBe(palette.road);
    expect(patchFor("highway_major_casing", "line-color")).toBe(palette.roadCasing);
    expect(patchFor("railway_transit", "line-color")).toBe(palette.rail);
    expect(patchFor("boundary_2", "line-color")).toBe(palette.boundary);
    expect(patchFor("road_area_pier", "fill-color")).toBe(palette.land);
  });

  it("paints labels with a halo of the land colour and drops their sprite icons", () => {
    expect(patchFor("highway-name-minor", "text-color")).toBe(palette.label);
    expect(patchFor("highway-name-minor", "text-halo-color")).toBe(palette.halo);
    expect(patchFor("label_city", "text-color")).toBe(palette.placeLabel);
    expect(patchFor("label_city", "icon-opacity")).toBe(0);
    expect(patchFor("highway-name-minor", "icon-opacity")).toBeUndefined();
  });

  it("hides shields and raster relief", () => {
    expect(patches).toContainEqual({ layerId: "highway-shield-non-us", kind: "layout", property: "visibility", value: "none" });
    expect(patches).toContainEqual({ layerId: "ne2_shaded", kind: "layout", property: "visibility", value: "none" });
  });
});

describe("applyPatchesToStyle", () => {
  const style = {
    version: 8,
    sources: { openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    layers: positronLayers,
  } as unknown as StyleSpecification;

  it("recolours a copy and leaves the loaded style untouched", () => {
    const recoloured = applyPatchesToStyle(style, basemapPatches(style.layers, palette));
    const background = recoloured.layers.find((l) => l.id === "background") as { paint: Record<string, unknown> };
    expect(background.paint["background-color"]).toBe(palette.land);
    const original = style.layers.find((l) => l.id === "background") as { paint: Record<string, unknown> };
    expect(original.paint["background-color"]).toBe("rgb(242,243,240)");
  });

  it("keeps the sources, so the tile attribution stays", () => {
    const recoloured = applyPatchesToStyle(style, basemapPatches(style.layers, palette));
    expect(recoloured.sources).toEqual(style.sources);
    expect(recoloured.glyphs).toBe(style.glyphs);
  });
});

describe("labelFont", () => {
  it("reuses the regular font the basemap already serves", () => {
    expect(labelFont(positronLayers)).toEqual(["Noto Sans Regular"]);
  });

  it("falls back to Noto Sans Regular when the style names no font", () => {
    expect(labelFont([])).toEqual(["Noto Sans Regular"]);
  });
});

describe("labelBoldFont", () => {
  it("reuses the bold font the basemap serves for the counts in the bubbles", () => {
    const styled = [layer({ id: "label_city", type: "symbol", layout: { "text-font": ["Noto Sans Bold"] } }), ...positronLayers];
    expect(labelBoldFont(styled)).toEqual(["Noto Sans Bold"]);
  });

  it("falls back to Noto Sans Bold when the style names none", () => {
    expect(labelBoldFont(positronLayers)).toEqual(["Noto Sans Bold"]);
  });
});

describe("labelLanguagePatches", () => {
  const nameField = ["case", ["has", "name:nonlatin"], ["concat", ["get", "name:latin"], " ", ["get", "name:nonlatin"]], ["coalesce", ["get", "name_en"], ["get", "name"]]];
  const named = [
    layer({ id: "label_country_1", type: "symbol", "source-layer": "place", layout: { "text-field": nameField } }),
    layer({ id: "highway-name-minor", type: "symbol", "source-layer": "transportation_name", layout: { "text-field": "{name:latin}" } }),
    layer({ id: "highway-shield-non-us", type: "symbol", "source-layer": "transportation_name", layout: { "text-field": ["to-string", ["get", "ref"]] } }),
    layer({ id: "water", type: "fill", "source-layer": "water", paint: {} }),
  ];

  const label = (language: string, properties: Record<string, string>) => {
    const compiled = expression.createExpression(labelLanguagePatches(named, language)[0].value, { type: "string" } as never);
    if (compiled.result !== "success") throw new Error("the label expression does not compile");
    return compiled.value.evaluate({ zoom: 10 }, { type: 1, properties } as never);
  };

  it("rewrites the text of every named place layer, and only those", () => {
    expect(labelLanguagePatches(named, "pt").map((patch) => [patch.layerId, patch.kind, patch.property])).toEqual([
      ["label_country_1", "layout", "text-field"],
      ["highway-name-minor", "layout", "text-field"],
    ]);
  });

  it("labels in the language of the viewer, then the latin name, then the local name", () => {
    expect(label("pt", { "name:pt": "Alemanha", "name:latin": "Deutschland", name: "Deutschland" })).toBe("Alemanha");
    expect(label("pt", { "name:latin": "Pinheiros", name: "Pinheiros" })).toBe("Pinheiros");
    expect(label("pt", { name: "Natal" })).toBe("Natal");
    expect(label("de", { "name:de": "Brasilien", "name:pt": "Brasil" })).toBe("Brasilien");
  });

  it("drops the disambiguation OpenStreetMap keeps in parentheses", () => {
    expect(label("pt", { "name:pt": "Sumaré (bairro de São Paulo)", name: "Sumaré" })).toBe("Sumaré");
  });

  it("keeps road shields on their reference number", () => {
    expect(labelLanguagePatches(named, "de").map((patch) => patch.layerId)).not.toContain("highway-shield-non-us");
  });

  it("refuses a language that is not a plain code by labelling in Portuguese", () => {
    expect(labelLanguagePatches(named, "pt-BR")[0].value).toEqual(labelLanguagePatches(named, "pt")[0].value);
    expect(labelLanguagePatches(named, "x\"]")[0].value).toEqual(labelLanguagePatches(named, "pt")[0].value);
  });
});

describe("layerPaintPatches", () => {
  it("re-applies every paint property of the data layers, so a theme change repaints them", () => {
    const layers = [
      layer({ id: "dots", type: "circle", source: "points", paint: { "circle-color": "red", "circle-stroke-width": 2 } }),
      layer({ id: "area", type: "line", source: "area" }),
    ];
    expect(layerPaintPatches(layers)).toEqual([
      { layerId: "dots", kind: "paint", property: "circle-color", value: "red" },
      { layerId: "dots", kind: "paint", property: "circle-stroke-width", value: 2 },
    ]);
  });
});

describe("applyPatchesToMap", () => {
  it("skips layers the map does not have and routes paint and layout separately", () => {
    const calls: string[] = [];
    const map = {
      getLayer: (id: string) => (id === "missing" ? undefined : { id }),
      setPaintProperty: (id: string, name: string) => calls.push(`paint ${id} ${name}`),
      setLayoutProperty: (id: string, name: string) => calls.push(`layout ${id} ${name}`),
    };
    applyPatchesToMap(map, [
      { layerId: "water", kind: "paint", property: "fill-color", value: "x" },
      { layerId: "missing", kind: "paint", property: "fill-color", value: "x" },
      { layerId: "shield", kind: "layout", property: "visibility", value: "none" },
    ]);
    expect(calls).toEqual(["paint water fill-color", "layout shield visibility"]);
  });
});
