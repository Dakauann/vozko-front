import { describe, expect, it } from "vitest";

import { auditChangeOf } from "./audit";

const entry = {
    oldPriceMicros: 16_667,
    newPriceMicros: 16_667,
    oldCostMicros: 0,
    newCostMicros: 4_000,
};

describe("auditChangeOf", () => {
    it("reads a cost change when only the cost moved", () => {
        expect(auditChangeOf(entry)).toEqual({ kind: "cost", oldMicros: 0, newMicros: 4_000 });
    });

    it("reads a price change otherwise", () => {
        expect(auditChangeOf({ ...entry, newPriceMicros: 20_000, newCostMicros: 0 })).toEqual({
            kind: "price",
            oldMicros: 16_667,
            newMicros: 20_000,
        });
    });

    it("treats entries written before costs were audited as price changes", () => {
        expect(
            auditChangeOf({ oldPriceMicros: 1, newPriceMicros: 2, oldCostMicros: undefined, newCostMicros: undefined }),
        ).toEqual({ kind: "price", oldMicros: 1, newMicros: 2 });
    });
});
