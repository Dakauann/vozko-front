import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import {
    DEFAULT_AUTHORS_PERIOD,
    PERIOD_PRESETS,
    isPeriodReady,
    periodRange,
    type Period,
} from "@/lib/audience/period";

/**
 * The period decides which of the server's two ranking implementations runs,
 * so getting `all` wrong is not a cosmetic bug: it silently moves every reader
 * onto the expensive path.
 */
describe("period", () => {
    it("sends no range for all time", () => {
        expect(periodRange({ preset: "all" })).toEqual({});
    });

    it("opens the ranking on all time", () => {
        // The lifetime projection is indexed; the windowed path regroups the
        // comments. The default has to be the cheap one.
        expect(DEFAULT_AUTHORS_PERIOD.preset).toBe("all");
        expect(periodRange(DEFAULT_AUTHORS_PERIOD)).toEqual({});
    });

    it("bounds the presets from local midnight, with no end", () => {
        for (const preset of ["today", "7", "30", "90"] as const) {
            const range = periodRange({ preset });
            expect(range.from, preset).toBeTruthy();
            // No `to`: "os últimos 30 dias" runs up to now, and pinning an end
            // would hide a comment analysed while the page was open.
            expect(range.to, preset).toBeUndefined();

            const from = new Date(range.from!);
            expect(from.getHours(), `${preset} starts at local midnight`).toBe(0);
            expect(from.getMinutes()).toBe(0);
        }
    });

    it("orders the presets by how far back they reach", () => {
        const days = (p: Period) => new Date(periodRange(p).from!).valueOf();
        expect(days({ preset: "today" })).toBeGreaterThan(days({ preset: "7" }));
        expect(days({ preset: "7" })).toBeGreaterThan(days({ preset: "30" }));
        expect(days({ preset: "30" })).toBeGreaterThan(days({ preset: "90" }));
    });

    it("includes the whole final day of a custom range", () => {
        // The server treats `to` as exclusive, so a range ending on the 30th
        // must be sent as "before the 31st" or the 30th vanishes.
        const range = periodRange({ preset: "custom", from: "2026-09-01", to: "2026-09-30" });
        const to = new Date(range.to!);
        expect(to.getDate()).toBe(1);
        expect(to.getMonth()).toBe(9); // October, zero-indexed
    });

    it("holds back an unusable custom range", () => {
        expect(isPeriodReady({ preset: "custom" })).toBe(false);
        expect(isPeriodReady({ preset: "custom", from: "2026-09-01" })).toBe(false);
        expect(isPeriodReady({ preset: "custom", from: "2026-09-30", to: "2026-09-01" })).toBe(false);
        expect(isPeriodReady({ preset: "custom", from: "2026-09-01", to: "2026-09-30" })).toBe(true);
        expect(isPeriodReady({ preset: "30" })).toBe(true);
    });

    it("labels every preset in all four locales", () => {
        const catalogs: Record<string, Record<string, unknown>> = { pt, en, es, de };
        for (const [locale, catalog] of Object.entries(catalogs)) {
            const labels = (
                (catalog.audience as Record<string, unknown>).period as
                    | { presets?: Record<string, string> }
                    | undefined
            )?.presets;
            expect(labels, locale).toBeDefined();
            for (const preset of PERIOD_PRESETS) {
                expect(labels?.[preset], `${locale}.period.presets.${preset}`).toBeTruthy();
            }
        }
    });
});
