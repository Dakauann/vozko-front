import { describe, expect, it } from "vitest";

import {
    emptyCrmFilter,
    filterTarget,
    hasFilterPredicate,
    keyedFilterField,
    predicateAddress,
    readFilterValues,
    removeFilterPredicate,
    withFilterPredicate,
} from "@/lib/crm/board";

describe("keyed filter addresses", () => {
    it("splits a keyed address into its field and key", () => {
        expect(filterTarget(keyedFilterField("custom", "interesse"))).toEqual({ field: "custom", key: "interesse" });
        expect(filterTarget("city")).toEqual({ field: "city" });
    });

    it("writes the key on the predicate instead of the address", () => {
        const filter = withFilterPredicate(emptyCrmFilter, keyedFilterField("custom", "interesse"), "in", ["Positivo"]);
        expect(filter.groups[0].predicates).toEqual([
            { field: "custom", key: "interesse", operator: "in", values: ["Positivo"] },
        ]);
    });

    it("keeps two custom fields apart", () => {
        let filter = withFilterPredicate(emptyCrmFilter, keyedFilterField("custom", "interesse"), "in", ["Positivo"]);
        filter = withFilterPredicate(filter, keyedFilterField("custom", "escola"), "in", ["Prisma"]);

        expect(readFilterValues(filter, keyedFilterField("custom", "interesse"), "in")).toEqual(["Positivo"]);
        expect(readFilterValues(filter, keyedFilterField("custom", "escola"), "in")).toEqual(["Prisma"]);
        expect(hasFilterPredicate(filter, keyedFilterField("custom", "escola"), "in")).toBe(true);

        const removed = removeFilterPredicate(filter, keyedFilterField("custom", "interesse"));
        expect(readFilterValues(removed, keyedFilterField("custom", "interesse"), "in")).toEqual([]);
        expect(readFilterValues(removed, keyedFilterField("custom", "escola"), "in")).toEqual(["Prisma"]);
    });

    it("never matches a keyed predicate through its bare field", () => {
        const filter = withFilterPredicate(emptyCrmFilter, keyedFilterField("custom", "interesse"), "in", ["Positivo"]);
        expect(readFilterValues(filter, "custom", "in")).toEqual([]);
    });

    it("gives every predicate the address its control was built with", () => {
        expect(predicateAddress({ field: "custom", key: "interesse", operator: "in", values: [] })).toBe(
            keyedFilterField("custom", "interesse"),
        );
        expect(predicateAddress({ field: "city", operator: "in", values: [] })).toBe("city");
    });
});
