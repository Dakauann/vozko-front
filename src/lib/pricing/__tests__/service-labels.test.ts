import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

const CATALOGS = { pt, en, de, es } as const;

const NAMESPACES = {
    pricing: (c: (typeof CATALOGS)[keyof typeof CATALOGS]) => c.pricing.services,
    adminPlans: (c: (typeof CATALOGS)[keyof typeof CATALOGS]) =>
        c.adminPlans.pricing.services,
    plansPage: (c: (typeof CATALOGS)[keyof typeof CATALOGS]) =>
        c.plansPage.pricing.services,
} as const;

function keysOf(obj: Record<string, unknown>) {
    return Object.keys(obj).sort();
}

describe("pricing service labels", () => {
    const reference = keysOf(NAMESPACES.adminPlans(pt));

    it("covers the same services in every namespace and locale", () => {
        for (const [locale, catalog] of Object.entries(CATALOGS)) {
            for (const [namespace, pick] of Object.entries(NAMESPACES)) {
                expect(
                    keysOf(pick(catalog as (typeof CATALOGS)[keyof typeof CATALOGS])),
                    `${locale}.${namespace}.pricing.services renders the raw service id for the missing keys`,
                ).toEqual(reference);
            }
        }
    });

    it("never leaves a label empty", () => {
        for (const [locale, catalog] of Object.entries(CATALOGS)) {
            for (const [namespace, pick] of Object.entries(NAMESPACES)) {
                const labels = pick(
                    catalog as (typeof CATALOGS)[keyof typeof CATALOGS],
                ) as Record<string, string>;
                for (const [service, label] of Object.entries(labels)) {
                    expect(
                        label.trim(),
                        `${locale}.${namespace}.pricing.services.${service} is blank`,
                    ).not.toBe("");
                }
            }
        }
    });
});
