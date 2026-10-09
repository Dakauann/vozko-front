import { describe, expect, it } from "vitest";

import {
    LEAD_FILTER_FIELD,
    emptyLeadFilter,
    readBoolean,
    readSet,
    toggleInSet,
} from "@/lib/leads/filters";
import type { LeadSummarySection } from "@/lib/leads/sections";
import { summaryTiles, toggleSummaryTile } from "@/lib/leads/summary-tiles";

const summary = (overrides: Partial<LeadSummarySection> = {}): LeadSummarySection => ({
    total: 7942,
    withAddress: 6825,
    onMap: 5214,
    approximate: 1611,
    withoutAddress: 1117,
    birthdaysToday: 14,
    blocked: 18,
    windowOpen: 312,
    ...overrides,
});

const reader = { readsAddresses: true };

describe("summary tiles", () => {
    it("shows the plan's tiles in order", () => {
        expect(summaryTiles(summary(), emptyLeadFilter, reader).map((tile) => tile.id)).toEqual([
            "total",
            "onMap",
            "approximate",
            "withoutAddress",
            "birthdaysToday",
            "blocked",
            "windowOpen",
        ]);
    });

    it("hides a tile that is zero but always keeps the total", () => {
        const tiles = summaryTiles(
            summary({ total: 0, onMap: 0, approximate: 0, withoutAddress: 0, birthdaysToday: 0, blocked: 0, windowOpen: 0 }),
            emptyLeadFilter,
            reader,
        );
        expect(tiles.map((tile) => tile.id)).toEqual(["total"]);
    });

    it("keeps an applied tile visible even when its count is zero", () => {
        const filter = toggleSummaryTile(emptyLeadFilter, "blocked");
        const tiles = summaryTiles(summary({ blocked: 0 }), filter, reader);
        expect(tiles.find((tile) => tile.id === "blocked")).toMatchObject({ count: 0, applied: true });
    });

    it("never makes the total a filter", () => {
        const [total] = summaryTiles(summary(), emptyLeadFilter, reader);
        expect(total.interactive).toBe(false);
    });

    it("lists the leads on the map or approximate with the placement filter the counts come from", () => {
        const base = toggleInSet(emptyLeadFilter, LEAD_FILTER_FIELD.city, "sp:barueri");
        const tiles = summaryTiles(summary(), emptyLeadFilter, reader);
        expect(tiles.find((tile) => tile.id === "onMap")?.interactive).toBe(true);
        expect(tiles.find((tile) => tile.id === "approximate")?.interactive).toBe(true);
        const onMap = toggleSummaryTile(base, "onMap");
        expect(readSet(onMap, LEAD_FILTER_FIELD.geoPlacement)).toEqual(["on_map"]);
        expect(readSet(onMap, LEAD_FILTER_FIELD.city)).toEqual(["sp:barueri"]);
        expect(readSet(toggleSummaryTile(base, "approximate"), LEAD_FILTER_FIELD.geoPlacement)).toEqual(["approximate"]);
        expect(summaryTiles(summary(), onMap, reader).find((tile) => tile.id === "onMap")?.applied).toBe(true);
        expect(toggleSummaryTile(onMap, "onMap")).toEqual(base);
    });

    it("keeps the placement tiles as plain counts for a viewer who cannot read addresses", () => {
        const tiles = summaryTiles(summary(), emptyLeadFilter, { readsAddresses: false });
        expect(tiles.find((tile) => tile.id === "onMap")?.interactive).toBe(false);
        expect(tiles.find((tile) => tile.id === "approximate")?.interactive).toBe(false);
        expect(tiles.find((tile) => tile.id === "withoutAddress")?.interactive).toBe(true);
    });

    it("applies each tile's filter on top of the current one", () => {
        const base = toggleInSet(emptyLeadFilter, LEAD_FILTER_FIELD.city, "sp:barueri");

        expect(readBoolean(toggleSummaryTile(base, "withoutAddress"), LEAD_FILTER_FIELD.hasAddress)).toBe(false);
        expect(readSet(toggleSummaryTile(base, "birthdaysToday"), LEAD_FILTER_FIELD.birthday)).toEqual(["today"]);
        expect(readBoolean(toggleSummaryTile(base, "blocked"), LEAD_FILTER_FIELD.blocked)).toBe(true);
        expect(readBoolean(toggleSummaryTile(base, "windowOpen"), LEAD_FILTER_FIELD.windowOpen)).toBe(true);
        expect(readSet(toggleSummaryTile(base, "windowOpen"), LEAD_FILTER_FIELD.city)).toEqual(["sp:barueri"]);
    });

    it("removes the tile's filter when it is applied again", () => {
        const base = toggleInSet(emptyLeadFilter, LEAD_FILTER_FIELD.city, "sp:barueri");
        const on = toggleSummaryTile(base, "birthdaysToday");
        expect(toggleSummaryTile(on, "birthdaysToday")).toEqual(base);

        const blocked = toggleSummaryTile(base, "blocked");
        expect(summaryTiles(summary(), blocked, reader).find((t) => t.id === "blocked")?.applied).toBe(true);
        expect(toggleSummaryTile(blocked, "blocked")).toEqual(base);
    });
});
