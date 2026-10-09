import { describe, expect, it } from "vitest";

import { LEAD_FILTER_FIELD, emptyLeadFilter, readSet, withSet } from "@/lib/leads/filters";
import {
  LEAD_SEARCH_DEBOUNCE_MS,
  committedLeadSearch,
  leadSearchOptions,
  withPickedPlace,
  type LeadPlaceOption,
  type LeadSearchOption,
} from "@/lib/leads/search";

function placeOf(options: LeadSearchOption[], kind: LeadPlaceOption["kind"]): LeadPlaceOption {
  const option = options.find((candidate): candidate is LeadPlaceOption => candidate.kind === kind);
  if (!option) throw new Error(`no ${kind} option`);
  return option;
}

const PLACES = {
  cities: [{ cityKey: "rn:natal", city: "Natal", state: "RN", count: 900 }],
  districts: [
    { pair: "rn:natal/santo antonio", cityKey: "rn:natal", districtKey: "santo antonio", district: "Santo Antônio", city: "Natal", state: "RN", count: 2 },
  ],
};

describe("lead search", () => {
  it("waits 300 ms and sends only a trimmed search of two characters or more", () => {
    expect(LEAD_SEARCH_DEBOUNCE_MS).toBe(300);
    expect(committedLeadSearch("  Santo  Antonio ")).toBe("Santo  Antonio");
    expect(committedLeadSearch(" a ")).toBe("");
    expect(committedLeadSearch("ab")).toBe("ab");
    expect(committedLeadSearch("")).toBe("");
  });

  it("offers the plain search first, then bairros, then cities", () => {
    const options = leadSearchOptions("santo", PLACES);
    expect(options.map((option) => option.kind)).toEqual(["leads", "district", "city"]);
    expect(options[0]).toMatchObject({ kind: "leads", query: "santo" });
    expect(options[1]).toMatchObject({ kind: "district", value: "rn:natal/santo antonio", name: "Santo Antônio", context: "Natal", count: 2 });
    expect(options[2]).toMatchObject({ kind: "city", value: "rn:natal", name: "Natal", context: "RN", count: 900 });
  });

  it("offers only the plain search without places or below two characters", () => {
    expect(leadSearchOptions("santo", null).map((option) => option.kind)).toEqual(["leads"]);
    expect(leadSearchOptions("s", PLACES)).toEqual([]);
  });

  it("applies a picked bairro or city as its filter chip without dropping the others", () => {
    const withCity = withSet(emptyLeadFilter, LEAD_FILTER_FIELD.city, ["sp:barueri"]);
    const options = leadSearchOptions("santo", PLACES);
    const district = placeOf(options, "district");
    const city = placeOf(options, "city");
    const picked = withPickedPlace(withCity, district);
    expect(readSet(picked, LEAD_FILTER_FIELD.district)).toEqual(["rn:natal/santo antonio"]);
    expect(readSet(picked, LEAD_FILTER_FIELD.city)).toEqual(["sp:barueri"]);
    const again = withPickedPlace(withPickedPlace(picked, city), city);
    expect(readSet(again, LEAD_FILTER_FIELD.city)).toEqual(["sp:barueri", "rn:natal"]);
  });
});
