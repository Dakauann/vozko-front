import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { AUTHOR_ROLES } from "@/lib/comment-analysis/types";

/**
 * The role taxonomy is closed on the server, so a label missing here would
 * render a raw slug like `public_servant` next to a real person's name. That
 * is worse than most untranslated strings: the chip is already a claim we are
 * being careful about, and a raw enum makes it look like leaked internals.
 */
describe("author role labels", () => {
    const catalogs: Record<string, Record<string, unknown>> = { pt, en, es, de };

    it("labels every role in all four locales", () => {
        for (const [locale, catalog] of Object.entries(catalogs)) {
            const roles = (catalog.commentAnalysis as Record<string, unknown>).roles as
                | { labels?: Record<string, string>; confidence?: Record<string, string> }
                | undefined;
            expect(roles, locale).toBeDefined();
            for (const role of AUTHOR_ROLES) {
                expect(roles?.labels?.[role], `${locale}.roles.labels.${role}`).toBeTruthy();
            }
            // The confidence wording is half of what makes the chip read as an
            // inference rather than a fact.
            for (const level of ["none", "low", "medium", "high"]) {
                expect(roles?.confidence?.[level], `${locale}.roles.confidence.${level}`).toBeTruthy();
            }
        }
    });

    it("keeps unknown in the taxonomy", () => {
        // `unknown` is a real answer, not a missing one: most commenters have
        // no public role and saying so is correct.
        expect(AUTHOR_ROLES).toContain("unknown");
    });
});
