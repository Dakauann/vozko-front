import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import type { AlertChannel, AlertMetric } from "@/lib/audience/types";

const METRICS: AlertMetric[] = [
    "comment_severity",
    "high_severity_count",
    "hostile_count",
    "comment_volume",
    "acceptance_score",
];

const CHANNELS: AlertChannel[] = ["official", "unofficial"];

describe("alert rule labels", () => {
    const catalogs: Record<string, Record<string, unknown>> = { pt, en, es, de };

    it("names and explains every metric in all four locales", () => {
        for (const [locale, catalog] of Object.entries(catalogs)) {
            const alerts = (catalog.audience as Record<string, unknown>).alerts as
                | { metricNames?: Record<string, string>; metrics?: Record<string, string>; channels?: Record<string, string> }
                | undefined;
            expect(alerts, locale).toBeDefined();
            for (const metric of METRICS) {
                expect(alerts?.metricNames?.[metric], `${locale}.alerts.metricNames.${metric}`).toBeTruthy();
                expect(alerts?.metrics?.[metric], `${locale}.alerts.metrics.${metric}`).toBeTruthy();
            }
            for (const channel of CHANNELS) {
                expect(alerts?.channels?.[channel], `${locale}.alerts.channels.${channel}`).toBeTruthy();
            }
        }
    });

    it("says the official channel costs money", () => {
        const alerts = (pt.audience as Record<string, unknown>).alerts as { officialHint?: string };
        expect(alerts.officialHint).toBeTruthy();
        expect(alerts.officialHint?.toLowerCase()).toContain("saldo");
    });

    it("states the safety floors", () => {
        const alerts = (pt.audience as Record<string, unknown>).alerts as { limitsHint?: string };
        expect(alerts.limitsHint).toBeTruthy();
        expect(alerts.limitsHint).toContain("{cooldown}");
        expect(alerts.limitsHint).toContain("{perDay}");
    });

    it("offers alerts as a section", () => {
        for (const [locale, catalog] of Object.entries(catalogs)) {
            const sections = (catalog.audience as Record<string, unknown>).sections as Record<string, string>;
            expect(sections?.alerts, `${locale}.sections.alerts`).toBeTruthy();
        }
    });
});
