import { describe, expect, it } from "vitest";

import { SectionError } from "@/lib/analytics/section-query";
import { MapContractError } from "@/lib/maps/contracts";
import { decodeFilterParam, emptyCrmFilter } from "@/lib/crm/board";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import { LEAD_FILTER_FIELD, readBoolean, readSet, withSet } from "@/lib/leads/filters";
import { snapViewport } from "@/lib/maps/tiles";
import type { GeoSummary } from "@/lib/maps/types";

import {
  LEAD_VIEWS,
  addressPositions,
  areaIdsOf,
  bboxParam,
  chosenColourField,
  colourFieldsOf,
  colourLegend,
  defaultLayerMode,
  leadMapColorOf,
  leadMapLayerOf,
  sameFullAddress,
  withLeadMapParam,
  LEAD_MAP_COLOR_PARAM,
  LEAD_MAP_LAYER_PARAM,
  NO_COLOUR,
  isSameLeadMapSection,
  leadMapAvailability,
  leadMapHref,
  leadMapKey,
  leadMapLayerPath,
  leadMapPointPath,
  leadMapSectionPath,
  nothingOnMap,
  offMapRows,
  parseMapPeek,
  peekPlacement,
  pickedLeadIds,
  pointBounds,
  withPick,
  withoutPick,
  withDistrictPairs,
  withDrawnArea,
  withoutAddressFilter,
  addressRequestSelection,
  centeredPeek,
  focusPoint,
  leadMapFocusOf,
  leftOutListFilter,
  offMapFilter,
  parseMapLeftOut,
  withoutLeadMapFocus,
  withoutArea,
  approximatePlace,
  visibleByPlacement,
} from "./map-view";

const filter = withSet(emptyCrmFilter, LEAD_FILTER_FIELD.city, ["sp:sao paulo"]);

function query(path: string) {
  return new URLSearchParams(path.split("?")[1] ?? "");
}

const summary: GeoSummary = {
  total: 7942,
  onMap: 5214,
  approximate: 1611,
  withoutAddress: 1117,
  notFound: 214,
  pending: 96,
  quotaExceeded: 0,
  refused: 0,
};

const classification: CustomFieldDefinition = {
  id: "f1",
  workspaceId: "ws1",
  objectType: "lead",
  key: "interesse",
  label: "Interesse",
  type: "select",
  options: ["Matriculado", "Interessado", "Desistiu"],
  optionTones: { Matriculado: "chart-2", Interessado: "chart-3" },
  required: false,
  sensitive: false,
  role: "classification",
  position: 1,
  readable: true,
  createdAt: "",
  updatedAt: "",
};

describe("lead views", () => {
  it("offers the table and the map, table first", () => {
    expect(LEAD_VIEWS).toEqual(["table", "map"]);
  });
});

describe("map section paths", () => {
  it("sends the filter and the search of GET /leads to a section", () => {
    const path = leadMapSectionPath("summary", { filter, q: " maria " });
    expect(path.startsWith("/leads/map/summary?")).toBe(true);
    expect(decodeFilterParam(query(path).get("filter"))).toEqual(filter);
    expect(query(path).get("q")).toBe("maria");
  });

  it("asks for a bare section without a query string when nothing narrows it", () => {
    expect(leadMapSectionPath("viewport", { filter: emptyCrmFilter })).toBe("/leads/map/viewport");
  });

  it("writes the box west, south, east, north", () => {
    expect(bboxParam({ south: -23.7, west: -46.8, north: -23.4, east: -46.4 })).toBe("-46.8,-23.7,-46.4,-23.4");
  });

  it("asks for the layer of the tile-snapped window with its zoom and colour", () => {
    const viewport = snapViewport({ bbox: { south: -23.6, west: -46.7, north: -23.5, east: -46.6 }, zoom: 12.7 });
    if (!viewport) throw new Error("viewport");
    const path = leadMapLayerPath({ filter }, { viewport, colorBy: "interesse" });
    const params = query(path);
    expect(path.startsWith("/leads/map/layer?")).toBe(true);
    expect(params.get("bbox")).toBe(bboxParam(viewport.bbox));
    expect(params.get("zoom")).toBe("12");
    expect(params.get("colorBy")).toBe("interesse");
    expect(decodeFilterParam(params.get("filter"))).toEqual(filter);
  });

  it("leaves the colour out when nothing colours the dots", () => {
    const viewport = snapViewport({ bbox: { south: -23.6, west: -46.7, north: -23.5, east: -46.6 }, zoom: 12 });
    if (!viewport) throw new Error("viewport");
    expect(query(leadMapLayerPath({ filter }, { viewport })).has("colorBy")).toBe(false);
  });

  it("asks for the people at one position", () => {
    const params = query(leadMapPointPath({ filter, q: "ana" }, { lat: -23.5614, lng: -46.6559, placement: "on_map" }));
    expect(params.get("placement")).toBe("on_map");
    expect(query(leadMapPointPath({ filter }, { lat: -6.31, lng: -35.48, placement: "approximate" })).get("placement")).toBe("approximate");
    expect(params.get("lat")).toBe("-23.5614");
    expect(params.get("lng")).toBe("-46.6559");
    expect(params.get("q")).toBe("ana");
  });
});

describe("map section keys", () => {
  it("varies with the workspace, the section, the filter, the search and the window", () => {
    const base = leadMapKey("ws1", "layer", { filter }, "12/1:2/3:4", "interesse");
    expect(leadMapKey("ws2", "layer", { filter }, "12/1:2/3:4", "interesse")).not.toEqual(base);
    expect(leadMapKey("ws1", "summary", { filter })).not.toEqual(base);
    expect(leadMapKey("ws1", "layer", { filter: emptyCrmFilter }, "12/1:2/3:4", "interesse")).not.toEqual(base);
    expect(leadMapKey("ws1", "layer", { filter, q: "x" }, "12/1:2/3:4", "interesse")).not.toEqual(base);
    expect(leadMapKey("ws1", "layer", { filter }, "13/1:2/3:4", "interesse")).not.toEqual(base);
    expect(leadMapKey("ws1", "layer", { filter }, "12/1:2/3:4")).not.toEqual(base);
  });

  it("keeps the previous layer only while the same filter pans", () => {
    const before = leadMapKey("ws1", "layer", { filter }, "12/1:2/3:4", "");
    expect(isSameLeadMapSection(before, leadMapKey("ws1", "layer", { filter }, "13/2:3/4:5", ""))).toBe(true);
    expect(isSameLeadMapSection(before, leadMapKey("ws1", "layer", { filter: emptyCrmFilter }, "12/1:2/3:4", ""))).toBe(false);
    expect(isSameLeadMapSection(before, leadMapKey("ws1", "summary", { filter }))).toBe(false);
  });
});

describe("leadMapAvailability", () => {
  it("says the map is unavailable when the server has none", () => {
    expect(leadMapAvailability(new SectionError("off", 503, "lead_map_unavailable"))).toBe("unavailable");
    expect(leadMapAvailability(new SectionError("off", 503, "lead_areas_unavailable"))).toBe("unavailable");
  });

  it("keeps the map for any other failure, which shows its own error", () => {
    expect(leadMapAvailability(new SectionError("busy", 503))).toBe("ready");
    expect(leadMapAvailability(null)).toBe("ready");
  });
});

describe("drawn areas in the filter", () => {
  it("adds a drawn area to the area chip", () => {
    const added = withDrawnArea(filter, "a1");
    expect(areaIdsOf(added)).toEqual(["a1"]);
    expect(readSet(added, LEAD_FILTER_FIELD.city)).toEqual(["sp:sao paulo"]);
  });

  it("takes one area out of the filter and keeps the others", () => {
    const two = withDrawnArea(withDrawnArea(filter, "a1"), "a2");
    expect(areaIdsOf(withoutArea(two, "a1"))).toEqual(["a2"]);
    expect(readSet(withoutArea(two, "a1"), LEAD_FILTER_FIELD.city)).toEqual(["sp:sao paulo"]);
    expect(withoutArea(filter, "a1")).toEqual(filter);
  });

  it("does not add the same area twice", () => {
    expect(areaIdsOf(withDrawnArea(withDrawnArea(filter, "a1"), "a1"))).toEqual(["a1"]);
  });

  it("leaves the area limit to the server, which refuses the filter with its own code", () => {
    const ids = Array.from({ length: 25 }, (_, index) => `a${index}`);
    const full = withSet(filter, LEAD_FILTER_FIELD.area, ids);
    expect(areaIdsOf(withDrawnArea(full, "extra"))).toEqual([...ids, "extra"]);
  });
});

describe("bairro filters", () => {
  it("adds a bairro next to the ones already chosen", () => {
    const one = withDistrictPairs(emptyCrmFilter, ["3550308/centro"]);
    const two = withDistrictPairs(one, ["3550308/se", "3550308/centro"]);
    expect(readSet(two, LEAD_FILTER_FIELD.district)).toEqual(["3550308/centro", "3550308/se"]);
  });

  it("lists the leads without an address with the summary's own filter", () => {
    expect(readBoolean(withoutAddressFilter(filter), LEAD_FILTER_FIELD.hasAddress)).toBe(false);
  });
});

describe("off the map", () => {
  it("lists approximate, without address, not found and waiting, in that order", () => {
    expect(offMapRows(summary)).toEqual([
      { key: "approximate", count: 1611 },
      { key: "withoutAddress", count: 1117 },
      { key: "notFound", count: 214 },
      { key: "pending", count: 96 },
    ]);
  });

  it("adds the leads stopped by the geocoding limit only when there are any", () => {
    expect(offMapRows({ ...summary, quotaExceeded: 4 }).map((row) => row.key)).toContain("quotaExceeded");
  });

  it("adds the addresses the provider refused only when there are any, after the limit", () => {
    expect(offMapRows(summary).map((row) => row.key)).not.toContain("refused");
    expect(offMapRows({ ...summary, quotaExceeded: 4, refused: 2 }).slice(-2)).toEqual([
      { key: "quotaExceeded", count: 4 },
      { key: "refused", count: 2 },
    ]);
  });
});

describe("nothingOnMap", () => {
  it("is true on day one, with no position and no bairro point", () => {
    expect(nothingOnMap({ ...summary, onMap: 0 }, [])).toBe(true);
  });

  it("is false when a bairro circle can be drawn", () => {
    expect(nothingOnMap({ ...summary, onMap: 0 }, [{ pair: "1/c", cityKey: "1", districtKey: "c", name: "Centro", lat: -23.5, lng: -46.6, count: 3 }])).toBe(false);
  });

  it("is false when any lead pins a house", () => {
    expect(nothingOnMap(summary, [])).toBe(false);
  });

  it("waits for the counts before deciding", () => {
    expect(nothingOnMap(null, [])).toBe(false);
  });
});

describe("colour by", () => {
  const stage: CustomFieldDefinition = { ...classification, id: "f2", key: "etapa", label: "Etapa", role: undefined, position: 2 };
  const fields: CustomFieldDefinition[] = [
    stage,
    classification,
    { ...classification, id: "f3", key: "saude", label: "Saúde", sensitive: true, readable: false, role: undefined },
    { ...classification, id: "f4", key: "tags", label: "Tags", type: "multiselect", role: undefined },
    { ...classification, id: "f5", key: "nota", label: "Nota", type: "text", role: undefined },
  ];

  it("offers every readable lead select field, in field order, never a hidden sensitive one", () => {
    expect(colourFieldsOf(fields).map((field) => field.key)).toEqual(["interesse", "etapa"]);
  });

  it("colours by the classification until the person picks another field or none", () => {
    expect(chosenColourField(fields, null)?.key).toBe("interesse");
    expect(chosenColourField(fields, "etapa")?.key).toBe("etapa");
    expect(chosenColourField(fields, NO_COLOUR)).toBeUndefined();
  });

  it("refuses a field from the address that the viewer cannot colour by", () => {
    expect(chosenColourField(fields, "saude")).toBeUndefined();
    expect(chosenColourField(fields, "tags")).toBeUndefined();
    expect(chosenColourField(fields, "gone")).toBeUndefined();
  });

  it("colours by nothing when no readable classification exists", () => {
    expect(chosenColourField([stage], null)).toBeUndefined();
  });

  it("labels every option with its tone and count, and the rest as not informed", () => {
    const legend = colourLegend(classification, { Matriculado: 612, Interessado: 301, Desistiu: 88 }, 1204);
    expect(legend).toEqual([
      { key: "Matriculado", label: "Matriculado", count: 612, tone: "chart-2" },
      { key: "Interessado", label: "Interessado", count: 301, tone: "chart-3" },
      { key: "Desistiu", label: "Desistiu", count: 88, tone: "neutral" },
      { key: "", label: null, count: 203, tone: "neutral" },
    ]);
  });

  it("never counts a negative not informed", () => {
    const legend = colourLegend(classification, { Matriculado: 10 }, 5);
    expect(legend[legend.length - 1]).toEqual({ key: "", label: null, count: 0, tone: "neutral" });
  });
});

describe("map layer in the address", () => {
  it("reads the chosen layer and colour, ignoring unknown values", () => {
    expect(leadMapLayerOf(new URLSearchParams("layer=heat"))).toBe("heat");
    expect(leadMapLayerOf(new URLSearchParams("layer=districts"))).toBe("districts");
    expect(leadMapLayerOf(new URLSearchParams("layer=positions"))).toBeNull();
    expect(leadMapLayerOf(new URLSearchParams(""))).toBeNull();
    expect(leadMapColorOf(new URLSearchParams("color=etapa"))).toBe("etapa");
    expect(leadMapColorOf(new URLSearchParams("color=%20"))).toBeNull();
  });

  it("writes one parameter and keeps the rest", () => {
    const next = new URLSearchParams(withLeadMapParam(new URLSearchParams("view=map&focus=l1"), LEAD_MAP_LAYER_PARAM, "points"));
    expect(next.get("view")).toBe("map");
    expect(next.get("focus")).toBe("l1");
    expect(next.get("layer")).toBe("points");
    expect(new URLSearchParams(withLeadMapParam(next, LEAD_MAP_COLOR_PARAM, NO_COLOUR)).get("color")).toBe("none");
  });
});

describe("defaultLayerMode", () => {
  it("opens Por bairro when the server says too few leads pin a house", () => {
    expect(defaultLayerMode("districts", "points")).toBe("districts");
    expect(defaultLayerMode("districts", null)).toBe("districts");
  });

  it("opens Calor while the server answers cells and Pontos when it answers points", () => {
    expect(defaultLayerMode("positions", "cells")).toBe("heat");
    expect(defaultLayerMode("positions", "points")).toBe("points");
    expect(defaultLayerMode(undefined, null)).toBe("points");
  });
});

describe("sameFullAddress", () => {
  const at = (street: string, number: string, complement = "") => ({
    addresses: [{ id: "a", label: "home" as const, primary: true, geoStatus: "located" as const, street, number, complement, district: "Centro", city: "Natal", state: "RN" }],
  });

  it("is true when every lead there lives at the same street, number and complement", () => {
    expect(sameFullAddress([at("Rua das Acácias", "120"), at(" rua das acácias ", "120")])).toBe(true);
  });

  it("is false for a different number or complement, a missing number, or nobody", () => {
    expect(sameFullAddress([at("Rua das Acácias", "120"), at("Rua das Acácias", "122")])).toBe(false);
    expect(sameFullAddress([at("Rua das Acácias", "120", "apto 1"), at("Rua das Acácias", "120", "apto 2")])).toBe(false);
    expect(sameFullAddress([at("Rua das Acácias", ""), at("Rua das Acácias", "")])).toBe(false);
    expect(sameFullAddress([])).toBe(false);
    expect(sameFullAddress([{ addresses: [] }])).toBe(false);
  });
});

describe("parseMapPeek", () => {
  it("reads the people at a position", () => {
    const lead = { id: "l1", workspaceId: "ws1", number: "5511900010142", blocked: false, relativesCount: 0, referredCount: 0, version: 1 };
    expect(parseMapPeek({ total: 1, items: [lead] })).toEqual({ total: 1, items: [lead] });
  });

  it.each([
    ["no total", { items: [] }],
    ["items that are not a list", { total: 1, items: {} }],
    ["an item without id", { total: 1, items: [{ number: "1" }] }],
    ["more items than people", { total: 0, items: [{ id: "l1" }] }],
    ["an item that is not an object", { total: 1, items: ["l1"] }],
  ])("refuses %s", (_, raw) => {
    expect(() => parseMapPeek(raw)).toThrow(MapContractError);
  });
});

describe("peekPlacement", () => {
  it("opens the peek beside the dot", () => {
    expect(peekPlacement({ x: 100, y: 120 }, { width: 800, height: 520 }, { width: 240, height: 200 })).toEqual({ left: 112, top: 108 });
  });

  it("keeps the peek inside the map near the right and bottom edges", () => {
    expect(peekPlacement({ x: 780, y: 510 }, { width: 800, height: 520 }, { width: 240, height: 200 })).toEqual({ left: 528, top: 308 });
  });
});

describe("map picks", () => {
  it("adds the leads of a point and counts each person once", () => {
    const one = withPick({}, "p1", ["l1", "l2"]);
    const two = withPick(one, "p2", ["l2", "l3"]);
    expect(Object.keys(two)).toEqual(["p1", "p2"]);
    expect(pickedLeadIds(two)).toEqual(["l1", "l2", "l3"]);
  });

  it("takes a point out again", () => {
    const picks = withPick(withPick({}, "p1", ["l1"]), "p2", ["l2"]);
    expect(pickedLeadIds(withoutPick(picks, "p1"))).toEqual(["l2"]);
  });

  it("never stores a point without leads", () => {
    expect(withPick({}, "p1", [])).toEqual({});
  });
});

describe("pointBounds", () => {
  it("frames a bairro point with a small box around it", () => {
    const box = pointBounds({ lat: -23.5, lng: -46.6 });
    expect(box.south).toBeLessThan(-23.5);
    expect(box.north).toBeGreaterThan(-23.5);
    expect(box.west).toBeLessThan(-46.6);
    expect(box.east).toBeGreaterThan(-46.6);
    expect(box.north - box.south).toBeLessThan(0.05);
  });
});

describe("addressPositions", () => {
  it("keeps the position of every located address by its id", () => {
    expect(
      addressPositions([
        { id: "a1", label: "home", primary: true, geoStatus: "located", latitude: -23.56, longitude: -46.65, precision: "street" },
        { id: "a2", label: "work", primary: false, geoStatus: "pending" },
        { id: "a3", label: "other", primary: false, geoStatus: "located", latitude: 0, longitude: 0 },
      ]),
    ).toEqual({ a1: { lat: -23.56, lng: -46.65, precision: "street" }, a2: null, a3: null });
  });

  it("has nothing for a lead without addresses", () => {
    expect(addressPositions(undefined)).toEqual({});
  });
});

describe("leadMapHref", () => {
  it("opens the leads page on the map, focused on the lead", () => {
    const href = leadMapHref("lead-1");
    expect(href.split("?")[0]).toBe("/dashboard/leads");
    expect(Object.fromEntries(query(href))).toEqual({ view: "map", focus: "lead-1" });
  });

  it("keeps an odd lead id inside its own parameter", () => {
    expect(query(leadMapHref("a&view=table")).get("focus")).toBe("a&view=table");
    expect(query(leadMapHref("a&view=table")).get("view")).toBe("map");
  });
});

describe("the map focus", () => {
  it("reads the lead the map opens on", () => {
    expect(leadMapFocusOf(query(leadMapHref("lead-1")))).toBe("lead-1");
    expect(leadMapFocusOf(new URLSearchParams("view=map&focus=%20"))).toBeNull();
    expect(leadMapFocusOf(new URLSearchParams("view=map"))).toBeNull();
  });

  it("drops only the focus from the address", () => {
    expect(withoutLeadMapFocus(new URLSearchParams("view=map&focus=lead-1&q=maria"))).toBe("view=map&q=maria");
  });

  it("places the focused lead on its primary address", () => {
    const lead = {
      id: "lead-1",
      addresses: [
        { id: "a2", label: "work" as const, primary: false, geoStatus: "located" as const, latitude: -23.1, longitude: -46.1, precision: "street" as const },
        { id: "a1", label: "home" as const, primary: true, geoStatus: "located" as const, latitude: -23.56, longitude: -46.65, precision: "exact" as const },
      ],
    };
    expect(focusPoint(lead)).toEqual({ id: "-23.56,-46.65", lat: -23.56, lng: -46.65, precision: "exact", placement: "on_map", tone: "neutral", count: 1, leadIds: ["lead-1"] });
  });

  it("places a lead with an approximate primary address on its approximate point", () => {
    const lead = {
      id: "lead-2",
      addresses: [{ id: "a1", label: "home" as const, primary: true, geoStatus: "located" as const, latitude: -6.3104, longitude: -35.4793, precision: "district" as const, district: "Centro" }],
    };
    expect(focusPoint(lead)).toEqual({
      id: "approximate:-6.3104,-35.4793",
      lat: -6.3104,
      lng: -35.4793,
      precision: "district",
      placement: "approximate",
      tone: "neutral",
      count: 1,
      leadIds: ["lead-2"],
    });
  });

  it("has no point for a lead whose primary address is not located", () => {
    expect(focusPoint({ id: "lead-1", addresses: [{ id: "a1", label: "home", primary: true, geoStatus: "pending" }] })).toBeNull();
    expect(focusPoint({ id: "lead-1", addresses: [{ id: "a2", label: "work", primary: false, geoStatus: "located", latitude: -23.1, longitude: -46.1 }] })).toBeNull();
    expect(focusPoint({ id: "lead-1" })).toBeNull();
  });

  it("centres the peek inside the map", () => {
    expect(centeredPeek({ width: 800, height: 520 }, { width: 256, height: 240 })).toEqual({ left: 272, top: 140 });
    expect(centeredPeek({ width: 0, height: 0 }, { width: 256, height: 240 })).toEqual({ left: 12, top: 12 });
  });
});

describe("off the map links", () => {
  it("lists each off-map count with the placement filter the summary counted it with", () => {
    expect(readSet(offMapFilter(filter, "approximate"), LEAD_FILTER_FIELD.geoPlacement)).toEqual(["approximate"]);
    expect(readSet(offMapFilter(filter, "notFound"), LEAD_FILTER_FIELD.geoPlacement)).toEqual(["not_found"]);
    expect(readSet(offMapFilter(filter, "pending"), LEAD_FILTER_FIELD.geoPlacement)).toEqual(["pending"]);
    expect(readSet(offMapFilter(filter, "quotaExceeded"), LEAD_FILTER_FIELD.geoPlacement)).toEqual(["quota_exceeded"]);
    expect(readSet(offMapFilter(filter, "refused"), LEAD_FILTER_FIELD.geoPlacement)).toEqual(["refused"]);
    expect(readSet(offMapFilter(filter, "refused"), LEAD_FILTER_FIELD.city)).toEqual(["sp:sao paulo"]);
  });

  it("lists the leads without an address with the summary's own filter", () => {
    const listed = offMapFilter(filter, "withoutAddress");
    expect(readBoolean(listed, LEAD_FILTER_FIELD.hasAddress)).toBe(false);
    expect(readSet(listed, LEAD_FILTER_FIELD.geoPlacement)).toEqual([]);
  });
});

describe("visibleByPlacement", () => {
  it("counts the people drawn on the map apart from the approximate ones", () => {
    const at = { lat: -23.5, lng: -46.6, tone: "neutral" as const, leadIds: [] };
    expect(
      visibleByPlacement({
        kind: "points",
        points: [
          { ...at, id: "a", precision: "street", placement: "on_map", count: 4 },
          { ...at, id: "approximate:a", precision: "district", placement: "approximate", count: 3 },
        ],
      }),
    ).toEqual({ onMap: 4, approximate: 3 });
    expect(
      visibleByPlacement({
        kind: "cells",
        cellSizeDegrees: 0.1,
        cells: [
          { ix: 1, iy: 1, placement: "on_map", count: 90, lat: -23.5, lng: -46.6 },
          { ix: 1, iy: 1, placement: "approximate", count: 7, lat: -23.5, lng: -46.6 },
        ],
      }),
    ).toEqual({ onMap: 90, approximate: 7 });
    expect(visibleByPlacement(null)).toBeNull();
  });
});

describe("approximatePlace", () => {
  it("names the reference point an approximate position stands on", () => {
    expect(approximatePlace({ precision: "district", district: " Centro ", city: "Santo Antônio" })).toEqual({ kind: "district", name: "Centro" });
    expect(approximatePlace({ precision: "postal_code", zipCode: "59255000" })).toEqual({ kind: "postal_code", name: "59255-000" });
    expect(approximatePlace({ precision: "city", city: "Santo Antônio" })).toEqual({ kind: "city", name: "Santo Antônio" });
  });

  it("names nothing when the reference has no name", () => {
    expect(approximatePlace({ precision: "district", district: " " })).toEqual({ kind: "district", name: null });
    expect(approximatePlace(undefined)).toBeNull();
    expect(approximatePlace({ precision: "street", district: "Centro" })).toBeNull();
  });
});

describe("the address request", () => {
  it("sends to every lead of the filter and search that has no address", () => {
    const selection = addressRequestSelection(filter, "maria");
    expect(selection.mode).toBe("all_matching");
    expect(readBoolean(selection.filter!, LEAD_FILTER_FIELD.hasAddress)).toBe(false);
    expect(readSet(selection.filter!, LEAD_FILTER_FIELD.city)).toEqual(["sp:sao paulo"]);
    expect(JSON.stringify(selection.filter)).toContain("maria");
  });
});

describe("the leads left out of an area", () => {
  const listed = {
    groups: [{ conjunction: "and", predicates: [{ field: "area_approximate", operator: "in", values: ["a1"] }] }],
  };
  const answer = {
    total: 9,
    filter: listed,
    districts: [{ pair: "sp:sao paulo/se", cityKey: "sp:sao paulo", districtKey: "se", name: "Sé", city: "São Paulo", state: "SP", count: 6 }],
  };

  it("reads the count, the bairros and the filter that lists them", () => {
    expect(parseMapLeftOut(answer)).toEqual(answer);
  });

  it("reads an answer without an area as nothing left out and no list", () => {
    expect(parseMapLeftOut({ total: 0, districts: [] })).toEqual({ total: 0, filter: null, districts: [] });
  });

  it("reads a group sent without a conjunction as the server reads it", () => {
    const loose = { ...answer, filter: { groups: [{ predicates: listed.groups[0].predicates }] } };
    expect(parseMapLeftOut(loose).filter?.groups[0].conjunction).toBe("or");
  });

  it("refuses an answer it cannot trust", () => {
    expect(() => parseMapLeftOut({ ...answer, total: -1 })).toThrow(MapContractError);
    expect(() => parseMapLeftOut({ ...answer, districts: [{ ...answer.districts[0], pair: "" }] })).toThrow(MapContractError);
    expect(() => parseMapLeftOut({ ...answer, filter: { groups: [{ conjunction: "xor", predicates: [] }] } })).toThrow(MapContractError);
  });

  it("lists every left-out lead, or the ones of one bairro, with the server's filter", () => {
    const left = parseMapLeftOut(answer);
    expect(leftOutListFilter(left)).toEqual(listed);
    const bairro = leftOutListFilter(left, "sp:sao paulo/se");
    expect(readSet(bairro!, LEAD_FILTER_FIELD.district)).toEqual(["sp:sao paulo/se"]);
    expect(readSet(bairro!, "area_approximate")).toEqual(["a1"]);
  });

  it("asks for the left-out section with the map's own filter and search", () => {
    const path = leadMapSectionPath("left-out", { filter, q: "maria" });
    expect(path.split("?")[0]).toBe("/leads/map/left-out");
    expect(query(path).get("q")).toBe("maria");
    expect(decodeFilterParam(query(path).get("filter"))).toEqual(filter);
  });

  it("has no list when the server sent no filter", () => {
    expect(leftOutListFilter({ total: 0, filter: null, districts: [] })).toBeNull();
  });
});
