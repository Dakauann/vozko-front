import { describe, expect, it } from "vitest";

import { emptyCrmFilter, parseFilterParam, type CrmFilter } from "@/lib/crm/board";
import { areaSelectionOf, withAreaSelection, withDrawnArea } from "@/lib/leads/map-view";

import { emptyAudienceDraft } from "./draft";
import {
  audienceAreaIdsOf,
  audienceMapSpecOf,
  mapTripHref,
  mapTripOf,
  returnedAreasOf,
  tripReturnHref,
  withReturnedAreas,
  MAP_TRIP_CHANNELS,
} from "./map-trip";

const CITY: CrmFilter = { groups: [{ conjunction: "and", predicates: [{ field: "city", operator: "in", values: ["sp"] }] }] } as CrmFilter;
const IN_AREA = withDrawnArea(CITY, "area-1");

function queryOf(href: string): URLSearchParams {
  return new URLSearchParams(href.split("?")[1] ?? "");
}

describe("the audience map trip", () => {
  it("reads the areas only from a counted leads filter", () => {
    expect(audienceAreaIdsOf(null)).toEqual([]);
    expect(audienceAreaIdsOf({ source: "list", listId: "list-1" })).toEqual([]);
    expect(audienceAreaIdsOf({ source: "leads", selection: { mode: "all_matching", filter: CITY } })).toEqual([]);
    expect(audienceAreaIdsOf({ source: "leads", selection: { mode: "all_matching", filter: withDrawnArea(IN_AREA, "area-2") } })).toEqual(["area-1", "area-2"]);
  });

  it("maps the counted selection without its variables", () => {
    const selection = { mode: "all_matching" as const, filter: IN_AREA, excludeIds: ["lead-9"] };
    expect(audienceMapSpecOf({ source: "leads", selection, variables: [{ key: "1", source: "lead.first_name" }] })).toEqual({ source: "leads", selection });
    expect(audienceMapSpecOf({ source: "list", listId: "list-1" })).toBeNull();
    expect(audienceMapSpecOf(null)).toBeNull();
  });

  it("opens the lead map on the draft filter and remembers the draft", () => {
    const href = mapTripHref({ channel: "unofficial", draftId: "draft-7" }, { filter: IN_AREA, search: " ana " });
    expect(href.startsWith("/dashboard/leads?")).toBe(true);
    const query = queryOf(href);
    expect(query.get("view")).toBe("map");
    expect(query.get("q")).toBe("ana");
    const opened = parseFilterParam(query.get("filter"));
    expect(opened.status === "valid" && areaSelectionOf(opened.filter)).toEqual({ ids: ["area-1"], exactOnly: false });
    expect(mapTripOf(query)).toEqual({ channel: "unofficial", draftId: "draft-7" });
  });

  it("refuses a trip it cannot return from", () => {
    expect(mapTripOf(new URLSearchParams("audienceChannel=carrier&audienceDraft=d1"))).toBeNull();
    expect(mapTripOf(new URLSearchParams("audienceChannel=email&audienceDraft=%20"))).toBeNull();
    expect(mapTripOf(new URLSearchParams("view=map"))).toBeNull();
  });

  it.each([
    ["whatsapp", "/dashboard/whatsapp-campaigns/new", "draft"],
    ["unofficial", "/dashboard/unofficial-whatsapp-campaigns/new", "draft"],
    ["email", "/dashboard/email/campaigns/new", "campaign"],
  ] as const)("returns a %s trip to the same draft and audience step with the chosen areas", (channel, path, draftParam) => {
    const href = tripReturnHref({ channel, draftId: "draft-7" }, { ids: ["area-2", "area-3", "area-2"], exactOnly: true });
    expect(href.split("?")[0]).toBe(path);
    const query = queryOf(href);
    expect(query.get(draftParam)).toBe("draft-7");
    expect(query.get("step")).toBe("audience");
    expect(returnedAreasOf(query)).toEqual({ ids: ["area-2", "area-3"], exactOnly: true });
    const plain = queryOf(tripReturnHref({ channel, draftId: "draft-7" }, null));
    expect(plain.get("step")).toBe("audience");
    expect(returnedAreasOf(plain)).toBeNull();
  });

  it("covers every wizard that has an audience step", () => {
    expect([...MAP_TRIP_CHANNELS].sort()).toEqual(["email", "unofficial", "whatsapp"]);
  });

  it("returns an emptied selection as no areas", () => {
    const query = queryOf(tripReturnHref({ channel: "email", draftId: "c1" }, { ids: [], exactOnly: true }));
    expect(returnedAreasOf(query)).toEqual({ ids: [], exactOnly: false });
  });

  it("replaces only the areas of the draft and keeps the rest of its filter", () => {
    const draft = { ...emptyAudienceDraft("whatsapp"), filter: IN_AREA, search: "ana", excludeIds: ["lead-9"] };
    const back = withReturnedAreas(draft, { ids: ["area-2"], exactOnly: false });
    expect(back.source).toBe("leads");
    expect(back.pick).toBe("filter");
    expect(back.search).toBe("ana");
    expect(back.excludeIds).toEqual(["lead-9"]);
    expect(areaSelectionOf(back.filter)).toEqual({ ids: ["area-2"], exactOnly: false });
    expect(back.filter.groups.some((group) => group.predicates.some((predicate) => predicate.field === "city"))).toBe(true);
    expect(withReturnedAreas(draft, null)).toBe(draft);
    expect(withReturnedAreas({ ...draft, pick: "first_n", limit: 10 }, { ids: ["area-2"], exactOnly: true }).pick).toBe("first_n");
    expect(areaSelectionOf(withReturnedAreas(draft, { ids: [], exactOnly: false }).filter).ids).toEqual([]);
  });

  it("writes an area selection the map reads back", () => {
    expect(areaSelectionOf(withAreaSelection(emptyCrmFilter, { ids: ["a", "b", "a"], exactOnly: true }))).toEqual({ ids: ["a", "b"], exactOnly: true });
    expect(areaSelectionOf(withAreaSelection(IN_AREA, { ids: [], exactOnly: true }))).toEqual({ ids: [], exactOnly: false });
  });
});
