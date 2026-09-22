import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { AUTHOR_ROLES } from "@/lib/audience/types";

describe("author role labels", () => {
    const catalogs: Record<string, Record<string, unknown>> = { pt, en, es, de };

    it("labels every role in all four locales", () => {
        for (const [locale, catalog] of Object.entries(catalogs)) {
            const roles = (catalog.audience as Record<string, unknown>).roles as
                | { labels?: Record<string, string>; confidence?: Record<string, string> }
                | undefined;
            expect(roles, locale).toBeDefined();
            for (const role of AUTHOR_ROLES) {
                expect(roles?.labels?.[role], `${locale}.roles.labels.${role}`).toBeTruthy();
            }
            for (const level of ["none", "low", "medium", "high"]) {
                expect(roles?.confidence?.[level], `${locale}.roles.confidence.${level}`).toBeTruthy();
            }
        }
    });

    it("keeps unknown in the taxonomy", () => {
        expect(AUTHOR_ROLES).toContain("unknown");
    });
});
