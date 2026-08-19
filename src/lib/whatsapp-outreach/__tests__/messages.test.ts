import { describe, expect, it } from "vitest";

import IntlMessageFormat from "intl-messageformat";
import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { UTILITY_STARTERS } from "@/lib/whatsapp-outreach/types";
import { exchangeRateFromMicros, formatMicrosAsBrl, microsToBrl } from "@/lib/pricing/currency";

/**
 * These messages are ICU, and ICU reads a bare `{` as the start of an argument.
 * A starter body that says "Olá, {{1}}!" therefore fails to parse, and next-intl
 * reports that failure by rendering the key path — so the operator sees
 * `whatsappOutreach.create.starters.followUp.body` in the field where the message
 * was supposed to be. It shipped that way once; these tests are why it cannot
 * again.
 */

const CATALOGS: Record<string, Record<string, unknown>> = { pt, en, de, es };

function flatten(value: unknown, prefix = ""): Array<[string, string]> {
    if (typeof value === "string") return [[prefix, value]];
    if (!value || typeof value !== "object") return [];
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        flatten(child, prefix ? `${prefix}.${key}` : key),
    );
}

describe("whatsappOutreach messages", () => {
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
        const namespace = (catalog as { whatsappOutreach?: unknown }).whatsappOutreach;

        it(`${locale}: every message parses as ICU`, () => {
            expect(namespace).toBeDefined();
            for (const [key, message] of flatten(namespace)) {
                expect(
                    () => new IntlMessageFormat(message, locale),
                    `${locale}.${key} is not valid ICU`,
                ).not.toThrow();
            }
        });

        it(`${locale}: starter bodies render their placeholders literally`, () => {
            for (const starter of UTILITY_STARTERS) {
                const path = starter.bodyKey.split(".");
                let node: unknown = namespace;
                for (const segment of path) {
                    node = (node as Record<string, unknown>)?.[segment];
                }
                expect(typeof node, `${locale}: ${starter.bodyKey} is missing`).toBe("string");

                const rendered = new IntlMessageFormat(node as string, locale).format() as string;
                for (let i = 1; i <= starter.variableCount; i += 1) {
                    // The operator has to SEE the placeholder to know what they are
                    // filling in, and Meta has to receive it verbatim.
                    expect(rendered).toContain(`{{${i}}}`);
                }
                expect(rendered).not.toContain("whatsappOutreach");
            }
        });
    }

    it("all locales carry the same keys", () => {
        const reference = flatten((pt as { whatsappOutreach: unknown }).whatsappOutreach)
            .map(([key]) => key)
            .sort();
        for (const [locale, catalog] of Object.entries(CATALOGS)) {
            const keys = flatten((catalog as { whatsappOutreach: unknown }).whatsappOutreach)
                .map(([key]) => key)
                .sort();
            expect(keys, `${locale} diverges from pt`).toEqual(reference);
        }
    });
});

describe("price display", () => {
    /**
     * The regression this guards: prices are USD micros, balances are shown in
     * BRL, and dividing micros by a million and printing "R$" quoted about a
     * fifth of the real cost on the one screen whose job is to get consent to
     * spend.
     */
    it("converts USD micros to BRL with the configured rate", () => {
        // A UTILITY template at $0.016667, with the rate at 5.50 BRL/USD.
        expect(microsToBrl(16_667, 5.5)).toBeCloseTo(0.0917, 4);
    });

    it("refuses to guess when the rate is unknown", () => {
        expect(microsToBrl(16_667, null)).toBeNull();
        expect(formatMicrosAsBrl(16_667, null)).toBeNull();
    });

    it("reads the rate from its own micros representation", () => {
        expect(exchangeRateFromMicros(5_500_000)).toBe(5.5);
        expect(exchangeRateFromMicros(0)).toBeNull();
        expect(exchangeRateFromMicros(undefined)).toBeNull();
    });

    it("formats a converted price as BRL", () => {
        const label = formatMicrosAsBrl(16_667, 5.5);
        expect(label).toContain("R$");
        // Not the unconverted 0,02 the dialog used to show.
        expect(label).not.toContain("0,02");
    });
});
