import { describe, expect, it } from "vitest";

import IntlMessageFormat from "intl-messageformat";
import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import {
    COMMENT_INTENTS,
    COMMENT_SENTIMENTS,
    COMMENT_STANCES,
    MODERATION_STATES,
    VERTICALS,
} from "@/lib/comment-analysis/types";

/**
 * Every string the audience dashboard shows exists in all four locales and
 * parses as ICU. Stored values are English slugs; a slug without a label in a
 * locale would reach the screen untranslated, so the enum tables are checked
 * against the TypeScript unions that produce them.
 */

const CATALOGS: Record<string, Record<string, unknown>> = { pt, en, de, es };

function flatten(value: unknown, prefix = ""): Array<[string, string]> {
    if (typeof value === "string") return [[prefix, value]];
    if (!value || typeof value !== "object") return [];
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        flatten(child, prefix ? `${prefix}.${key}` : key),
    );
}

function namespace(catalog: Record<string, unknown>, name: string): unknown {
    return catalog[name];
}

describe("commentAnalysis messages", () => {
    const reference = new Set(flatten(namespace(pt, "commentAnalysis")).map(([key]) => key));

    it("pt defines the namespace", () => {
        expect(reference.size).toBeGreaterThan(100);
    });

    for (const [locale, catalog] of Object.entries(CATALOGS)) {
        const ns = namespace(catalog, "commentAnalysis");

        it(`${locale}: has every key pt has, and no extras`, () => {
            const keys = new Set(flatten(ns).map(([key]) => key));
            const missing = [...reference].filter((k) => !keys.has(k));
            const extra = [...keys].filter((k) => !reference.has(k));
            expect(missing, `${locale} is missing ${missing.join(", ")}`).toEqual([]);
            expect(extra, `${locale} has extra ${extra.join(", ")}`).toEqual([]);
        });

        it(`${locale}: every message parses as ICU`, () => {
            for (const [key, message] of flatten(ns)) {
                expect(() => new IntlMessageFormat(message, locale), `${locale}.${key} is not valid ICU`).not.toThrow();
            }
        });

        it(`${locale}: every enum slug has a label`, () => {
            const enums = (ns as { enums: Record<string, Record<string, string>> }).enums;
            for (const s of COMMENT_STANCES) expect(enums.stance[s], `stance.${s}`).toBeTruthy();
            for (const s of COMMENT_SENTIMENTS) expect(enums.sentiment[s], `sentiment.${s}`).toBeTruthy();
            for (const s of COMMENT_INTENTS) expect(enums.intent[s], `intent.${s}`).toBeTruthy();
            for (const s of MODERATION_STATES) expect(enums.moderation[s], `moderation.${s}`).toBeTruthy();
            for (const s of VERTICALS) expect(enums.vertical[s], `vertical.${s}`).toBeTruthy();
        });

        it(`${locale}: the account page tab, the post tab, the nav entry and the permission labels exist`, () => {
            const instagram = namespace(catalog, "instagram") as {
                tabs: Record<string, string>;
                posts: Record<string, string>;
                composer: Record<string, string>;
            };
            expect(instagram.tabs.audience).toBeTruthy();
            expect(instagram.posts.tabAnalysis).toBeTruthy();
            // The composer arms a post's analysis before it exists.
            for (const key of ["analysisTitle", "analysisHint", "analysisAccountOff", "analysisLoading", "publishedButAnalysisFailed"]) {
                expect(instagram.composer[key], `composer.${key}`).toBeTruthy();
                expect(() => new IntlMessageFormat(instagram.composer[key], locale)).not.toThrow();
            }
            const sidebar = namespace(catalog, "sidebar") as { nav: Record<string, string> };
            expect(sidebar.nav.audience, "Métricas > Audiência nav label").toBeTruthy();
            const ws = namespace(catalog, "workspaceSettings") as {
                resources: Record<string, string>;
                resourceDescriptions: Record<string, string>;
            };
            expect(ws.resources.comment_analysis).toBeTruthy();
            expect(ws.resourceDescriptions.comment_analysis).toBeTruthy();
        });

        it(`${locale}: no em or en dashes in copy`, () => {
            for (const [key, message] of flatten(ns)) {
                expect(message, `${locale}.${key}`).not.toMatch(/[–—]/);
            }
        });
    }
});
