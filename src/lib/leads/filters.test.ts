import { describe, expect, it } from "vitest";

import {
    decodeFilterParam,
    encodeFilterParam,
    isEmptyCrmFilter,
} from "@/lib/crm/board";
import {
    LEAD_FILTER_FIELD,
    LEAD_FILTER_FIELDS,
    LEAD_FILTER_GROUP_ORDER,
    activeLeadPredicates,
    countLeadFilters,
    emptyLeadFilter,
    readBoolean,
    readBound,
    readPresence,
    readSet,
    readText,
    toggleInSet,
    withBoolean,
    withBound,
    withPresence,
    withSet,
    withText,
    type LeadFilter,
} from "@/lib/leads/filters";

// The filter model decides WHICH leads an operator sees. A wrong predicate here
// does not throw, it silently answers a different question — so these cover the
// distinctions that are easy to collapse.

describe("text predicates", () => {
    it("round-trips and clears on empty input", () => {
        const withValue = withText(emptyLeadFilter, LEAD_FILTER_FIELD.name, "ana");
        expect(readText(withValue, LEAD_FILTER_FIELD.name)).toBe("ana");

        const cleared = withText(withValue, LEAD_FILTER_FIELD.name, "   ");
        expect(readText(cleared, LEAD_FILTER_FIELD.name)).toBe("");
        expect(isEmptyCrmFilter(cleared)).toBe(true);
    });

    it("replaces rather than accumulates as the operator types", () => {
        let filter: LeadFilter = emptyLeadFilter;
        for (const value of ["a", "an", "ana"]) {
            filter = withText(filter, LEAD_FILTER_FIELD.name, value);
        }
        expect(countLeadFilters(filter)).toBe(1);
        expect(readText(filter, LEAD_FILTER_FIELD.name)).toBe("ana");
    });
});

describe("set predicates", () => {
    it("toggles values on and off", () => {
        let filter = toggleInSet(emptyLeadFilter, LEAD_FILTER_FIELD.channel, "telegram");
        filter = toggleInSet(filter, LEAD_FILTER_FIELD.channel, "instagram");
        expect(readSet(filter, LEAD_FILTER_FIELD.channel)).toEqual([
            "telegram",
            "instagram",
        ]);

        filter = toggleInSet(filter, LEAD_FILTER_FIELD.channel, "telegram");
        expect(readSet(filter, LEAD_FILTER_FIELD.channel)).toEqual(["instagram"]);
    });

    it("drops the predicate once the last value is removed", () => {
        const filter = toggleInSet(
            toggleInSet(emptyLeadFilter, LEAD_FILTER_FIELD.channel, "telegram"),
            LEAD_FILTER_FIELD.channel,
            "telegram",
        );
        expect(isEmptyCrmFilter(filter)).toBe(true);
    });

    it("clears explicitly", () => {
        const filter = withSet(
            toggleInSet(emptyLeadFilter, LEAD_FILTER_FIELD.memoryCategory, "deal"),
            LEAD_FILTER_FIELD.memoryCategory,
            [],
        );
        expect(readSet(filter, LEAD_FILTER_FIELD.memoryCategory)).toEqual([]);
    });
});

describe("tri-state booleans", () => {
    // "no opinion" and "false" are different questions. Collapsing them is how a
    // default-off toggle silently hides every blocked lead from the main list.
    it("distinguishes unset from false", () => {
        expect(readBoolean(emptyLeadFilter, LEAD_FILTER_FIELD.blocked)).toBeNull();

        const off = withBoolean(emptyLeadFilter, LEAD_FILTER_FIELD.blocked, false);
        expect(readBoolean(off, LEAD_FILTER_FIELD.blocked)).toBe(false);
        expect(isEmptyCrmFilter(off)).toBe(false);
    });

    it("never leaves both sides set when switching", () => {
        const on = withBoolean(emptyLeadFilter, LEAD_FILTER_FIELD.blocked, true);
        const flipped = withBoolean(on, LEAD_FILTER_FIELD.blocked, false);

        expect(countLeadFilters(flipped)).toBe(1);
        expect(readBoolean(flipped, LEAD_FILTER_FIELD.blocked)).toBe(false);
    });

    it("clears back to no opinion", () => {
        const cleared = withBoolean(
            withBoolean(emptyLeadFilter, LEAD_FILTER_FIELD.windowOpen, true),
            LEAD_FILTER_FIELD.windowOpen,
            null,
        );
        expect(readBoolean(cleared, LEAD_FILTER_FIELD.windowOpen)).toBeNull();
        expect(isEmptyCrmFilter(cleared)).toBe(true);
    });
});

describe("presence predicates", () => {
    it("maps has-any / has-none onto is_set / is_empty", () => {
        const has = withPresence(emptyLeadFilter, LEAD_FILTER_FIELD.memoryCategory, true);
        expect(has.groups[0].predicates[0].operator).toBe("is_set");
        expect(readPresence(has, LEAD_FILTER_FIELD.memoryCategory)).toBe(true);

        const none = withPresence(has, LEAD_FILTER_FIELD.memoryCategory, false);
        expect(none.groups[0].predicates[0].operator).toBe("is_empty");
        expect(countLeadFilters(none)).toBe(1);
    });
});

describe("range predicates", () => {
    it("holds both edges independently", () => {
        let filter = withBound(emptyLeadFilter, LEAD_FILTER_FIELD.age, "gte", "25");
        filter = withBound(filter, LEAD_FILTER_FIELD.age, "lte", "40");

        expect(readBound(filter, LEAD_FILTER_FIELD.age, "gte")).toBe("25");
        expect(readBound(filter, LEAD_FILTER_FIELD.age, "lte")).toBe("40");
        expect(countLeadFilters(filter)).toBe(2);

        filter = withBound(filter, LEAD_FILTER_FIELD.age, "gte", "");
        expect(readBound(filter, LEAD_FILTER_FIELD.age, "gte")).toBe("");
        expect(readBound(filter, LEAD_FILTER_FIELD.age, "lte")).toBe("40");
    });
});

describe("URL round trip", () => {
    // The URL is the state. A filter that cannot survive encode → decode is a
    // filter that resets on refresh and cannot be shared.
    it("survives encoding into a query parameter", () => {
        let filter = withText(emptyLeadFilter, LEAD_FILTER_FIELD.memoryText, "boleto & prazo");
        filter = toggleInSet(filter, LEAD_FILTER_FIELD.memoryCategory, "objection");
        filter = withBoolean(filter, LEAD_FILTER_FIELD.blocked, false);
        filter = withBound(filter, LEAD_FILTER_FIELD.age, "gte", "30");

        const decoded = decodeFilterParam(encodeFilterParam(filter));
        expect(decoded).toEqual(filter);
    });

    it("encodes an empty filter as nothing at all", () => {
        expect(encodeFilterParam(emptyLeadFilter)).toBe("");
    });

    it("degrades a hand-mangled parameter to the empty filter", () => {
        expect(isEmptyCrmFilter(decodeFilterParam("not-base64-or-json"))).toBe(true);
    });
});

describe("the field catalogue", () => {
    it("has no duplicate fields", () => {
        const fields = LEAD_FILTER_FIELDS.map((spec) => spec.field);
        expect(new Set(fields).size).toBe(fields.length);
    });

    it("puts every field in a rendered group", () => {
        for (const spec of LEAD_FILTER_FIELDS) {
            expect(LEAD_FILTER_GROUP_ORDER).toContain(spec.group);
        }
    });

    it("gives every enum field its options", () => {
        for (const spec of LEAD_FILTER_FIELDS) {
            if (spec.control === "enum") {
                expect(spec.options?.length ?? 0).toBeGreaterThan(0);
            }
        }
    });

    it("only attaches facet counts to fields whose values the server buckets", () => {
        for (const spec of LEAD_FILTER_FIELDS) {
            if (spec.facetKey) expect(spec.control).toBe("enum");
        }
    });
});

describe("active predicates", () => {
    // Chips ordered by insertion reshuffle themselves while the operator edits,
    // which makes them unreadable and hard to click. Catalogue order is stable.
    it("lists in catalogue order, not insertion order", () => {
        let filter = toggleInSet(emptyLeadFilter, LEAD_FILTER_FIELD.memoryCategory, "deal");
        filter = withText(filter, LEAD_FILTER_FIELD.name, "ana");
        filter = withBoolean(filter, LEAD_FILTER_FIELD.blocked, true);

        expect(activeLeadPredicates(filter).map((p) => p.field)).toEqual([
            LEAD_FILTER_FIELD.name,
            LEAD_FILTER_FIELD.blocked,
            LEAD_FILTER_FIELD.memoryCategory,
        ]);
    });
});
