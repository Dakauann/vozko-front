import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import {
    AUTHOR_SORT_FIRST_DIRECTION,
    AUTHOR_SORT_KEYS,
    AUTHOR_TABLE_COLUMNS,
    DEFAULT_AUTHOR_SORT,
} from "@/lib/comment-analysis/types";

/**
 * The author ranking vocabulary is shared with the API, which REFUSES an
 * unknown sort key with a 400 rather than defaulting. So a key that exists here
 * and not there (or a column with no label) is not a cosmetic slip: it is a
 * table that errors the moment someone clicks its header.
 */
describe("author sort vocabulary", () => {
    it("gives every key a first direction", () => {
        for (const key of AUTHOR_SORT_KEYS) {
            expect(AUTHOR_SORT_FIRST_DIRECTION[key], key).toMatch(/^(asc|desc)$/);
        }
        expect(Object.keys(AUTHOR_SORT_FIRST_DIRECTION).sort()).toEqual([...AUTHOR_SORT_KEYS].sort());
    });

    it("defaults to a key the API knows", () => {
        expect(AUTHOR_SORT_KEYS).toContain(DEFAULT_AUTHOR_SORT.key);
        // Ascending reputation: the moderation table opens on who needs
        // attention, matching DefaultAuthorSort in the domain.
        expect(DEFAULT_AUTHOR_SORT).toEqual({ key: "reputation", direction: "asc" });
    });

    it("only puts orderable columns in the table", () => {
        for (const column of AUTHOR_TABLE_COLUMNS) {
            expect(AUTHOR_SORT_KEYS, column.key).toContain(column.key);
        }
    });

    it("labels every column in all four locales", () => {
        const catalogs: Record<string, Record<string, unknown>> = { pt, en, es, de };
        for (const [locale, catalog] of Object.entries(catalogs)) {
            const columns = (
                (catalog.commentAnalysis as Record<string, Record<string, unknown>> | undefined)
                    ?.authors as Record<string, unknown> | undefined
            )?.columns as Record<string, string> | undefined;
            expect(columns, locale).toBeDefined();
            for (const column of [...AUTHOR_TABLE_COLUMNS.map((c) => c.key), "author", "moderation"]) {
                expect(columns?.[column], `${locale}.columns.${column}`).toBeTruthy();
            }
        }
    });
});
