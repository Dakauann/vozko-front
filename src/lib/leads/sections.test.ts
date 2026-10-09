import { describe, expect, it } from "vitest";

import { decodeFilterParam } from "@/lib/crm/board";
import { emptyLeadFilter, toggleInSet, LEAD_FILTER_FIELD } from "@/lib/leads/filters";
import { leadsQueryString } from "@/lib/leads/query";
import { isSameLeadSection, leadSectionKey, leadSectionPath, leadSectionsKey } from "@/lib/leads/sections";

describe("lead sections", () => {
    it("asks each section by its own route with the list's filter and search", () => {
        const filter = toggleInSet(emptyLeadFilter, LEAD_FILTER_FIELD.city, "sp:barueri");
        const path = leadSectionPath("places", { filter, q: "  ana " });
        const [route, query] = path.split("?");
        const params = new URLSearchParams(query);

        expect(route).toBe("/leads/sections/places");
        expect(decodeFilterParam(params.get("filter"))).toEqual(filter);
        expect(params.get("q")).toBe("ana");
        expect(params.has("page")).toBe(false);
        expect(params.has("sort")).toBe(false);
    });

    it("sends nothing extra for the whole workspace", () => {
        expect(leadSectionPath("summary", { filter: emptyLeadFilter })).toBe("/leads/sections/summary");
    });

    it("keys each section by workspace, section, filter and search", () => {
        const filter = toggleInSet(emptyLeadFilter, LEAD_FILTER_FIELD.city, "sp:barueri");
        const summary = leadSectionKey("ws1", "summary", { filter, q: "ana" });

        expect(summary.slice(0, 2)).toEqual(leadSectionsKey("ws1"));
        expect(summary).not.toEqual(leadSectionKey("ws2", "summary", { filter, q: "ana" }));
        expect(summary).not.toEqual(leadSectionKey("ws1", "facets", { filter, q: "ana" }));
        expect(summary).not.toEqual(leadSectionKey("ws1", "summary", { filter: emptyLeadFilter, q: "ana" }));
        expect(summary).toEqual(leadSectionKey("ws1", "summary", { filter, q: " ana " }));
    });

    it("asks the places section for suggestions with a trimmed place prefix", () => {
        const path = leadSectionPath("places", { filter: emptyLeadFilter, place: "  Santo Ant " });
        const params = new URLSearchParams(path.split("?")[1]);
        expect(params.get("place")).toBe("Santo Ant");
        expect(params.has("q")).toBe(false);
        expect(leadSectionPath("places", { filter: emptyLeadFilter, place: "  " })).toBe("/leads/sections/places");
    });

    it("keys place suggestions apart from the plain places section", () => {
        const plain = leadSectionKey("ws1", "places", { filter: emptyLeadFilter });
        const suggested = leadSectionKey("ws1", "places", { filter: emptyLeadFilter, place: "santo" });
        expect(suggested).not.toEqual(plain);
        expect(suggested).toEqual(leadSectionKey("ws1", "places", { filter: emptyLeadFilter, place: " santo " }));
    });

    it("asks the facets for the values of the field that colours the map, keyed apart", () => {
        const path = leadSectionPath("facets", { filter: emptyLeadFilter, colorBy: " etapa " });
        expect(new URLSearchParams(path.split("?")[1]).get("colorBy")).toBe("etapa");
        expect(leadSectionPath("facets", { filter: emptyLeadFilter, colorBy: "" })).toBe("/leads/sections/facets");
        const plain = leadSectionKey("ws1", "facets", { filter: emptyLeadFilter });
        const coloured = leadSectionKey("ws1", "facets", { filter: emptyLeadFilter, colorBy: "etapa" });
        expect(coloured).not.toEqual(plain);
        expect(coloured).toEqual(leadSectionKey("ws1", "facets", { filter: emptyLeadFilter, colorBy: " etapa " }));
    });

    it("builds the list query the same way the sections do", () => {
        const filter = toggleInSet(emptyLeadFilter, LEAD_FILTER_FIELD.city, "sp:barueri");
        const params = new URLSearchParams(
            leadsQueryString({ filter, q: "ana", sorts: [{ key: "createdAt", direction: "desc" }], page: 2, pageSize: 200 }),
        );
        expect(decodeFilterParam(params.get("filter"))).toEqual(filter);
        expect(params.get("q")).toBe("ana");
        expect(params.get("sort")).toBe("createdAt:desc");
        expect(params.get("page")).toBe("2");
        expect(params.get("pageSize")).toBe("200");
    });
});

describe("section identity", () => {
    it("treats another filter of the same section as the same section", () => {
        const filter = toggleInSet(emptyLeadFilter, LEAD_FILTER_FIELD.city, "sp:barueri");
        const before = leadSectionKey("ws1", "summary", { filter: emptyLeadFilter });
        expect(isSameLeadSection(before, leadSectionKey("ws1", "summary", { filter, q: "ana" }))).toBe(true);
        expect(isSameLeadSection(before, leadSectionKey("ws1", "facets", { filter: emptyLeadFilter }))).toBe(false);
        expect(isSameLeadSection(before, leadSectionKey("ws2", "summary", { filter: emptyLeadFilter }))).toBe(false);
    });
});
