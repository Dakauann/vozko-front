import { describe, expect, it } from "vitest";

import IntlMessageFormat from "intl-messageformat";
import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { IDENTITY_MODES, INTAKE_RULES, WEBCHAT_ERROR_CODES, WIDGET_POSITIONS } from "@/lib/webchat/types";

const CATALOGS: Record<string, Record<string, unknown>> = { pt, en, de, es };

const DASHES = new RegExp("[\\u2013\\u2014]");

const CHANNEL_NAME = "WebChat";

const REQUIRED_KEYS = [
    "sidebar.nav.webchat",
    "sidebar.nav.webchatWidgets",
    "sidebar.nav.createWebchat",
    "sidebar.families.webchat",
    "workspaceSettings.resources.webchat_widgets",
    "workspaceSettings.resourceDescriptions.webchat_widgets",
    "liveChat.filterWebchat",
    "leadsPage.filters.options.channel.webchat",
    "metricsOps.common.webchat",
    "audience.channels.webchat",
    "aiChatPage.chart.values.webchat",
    "aiChatPage.actions.kinds.create_webchat.title",
    "aiChatPage.actions.kinds.create_webchat.description",
    "aiChatPage.actions.kinds.create_webchat.cta",
];

const DYNAMIC_KEYS = [
    ...WEBCHAT_ERROR_CODES.map((code) => `errors.${code}`),
    ...WIDGET_POSITIONS.map((position) => `appearance.positions.${position}`),
    ...INTAKE_RULES.map((rule) => `intake.rules.${rule}`),
    ...IDENTITY_MODES.flatMap((mode) => [`identity.modes.${mode}.label`, `identity.modes.${mode}.hint`]),
    ...["active", "paused"].map((status) => `status.${status}`),
    ...["invalid", "insecure", "duplicate"].map((issue) => `origins.issue.${issue}`),
    ...["intakeName", "intakeEmail", "intakePhone"].map((field) => `intake.fields.${field}`),
    ...["launcherLabel", "teamName", "assistantName", "welcomeTitle", "welcomeMessage"].flatMap((field) => [
        `appearance.${field}.label`,
        `appearance.${field}.hint`,
    ]),
];

const REMOVED_KEYS = ["liveChat.filterSupport", "dashboard.sidebar.support"];

function flatten(value: unknown, prefix = ""): Array<[string, string]> {
    if (typeof value === "string") return [[prefix, value]];
    if (!value || typeof value !== "object") return [];
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        flatten(child, prefix ? `${prefix}.${key}` : key),
    );
}

function at(catalog: Record<string, unknown>, path: string): unknown {
    return path
        .split(".")
        .reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined), catalog);
}

describe("Website chat messages", () => {
    const reference = new Set(flatten(at(pt, "webchat")).map(([key]) => key));

    it("pt defines the webchat namespace", () => {
        expect(reference.size).toBeGreaterThan(0);
    });

    for (const [locale, catalog] of Object.entries(CATALOGS)) {
        it(`${locale}: webchat has every key pt has, and no extras`, () => {
            const keys = new Set(flatten(at(catalog, "webchat")).map(([key]) => key));
            const missing = [...reference].filter((k) => !keys.has(k));
            const extra = [...keys].filter((k) => !reference.has(k));
            expect(missing, `${locale} is missing ${missing.join(", ")}`).toEqual([]);
            expect(extra, `${locale} has extra ${extra.join(", ")}`).toEqual([]);
        });

        it(`${locale}: webchat parses as ICU and has no em or en dashes`, () => {
            for (const [key, message] of flatten(at(catalog, "webchat"))) {
                expect(() => new IntlMessageFormat(message, locale), `${locale}.webchat.${key}`).not.toThrow();
                expect(message, `${locale}.webchat.${key}`).not.toMatch(DASHES);
            }
        });

        it(`${locale}: defines every cross-app key the channel needs`, () => {
            for (const key of REQUIRED_KEYS) {
                const value = at(catalog, key);
                expect(typeof value, `${locale}.${key}`).toBe("string");
                expect(value as string, `${locale}.${key}`).not.toMatch(DASHES);
            }
        });

        it(`${locale}: defines every key the webchat screens build at runtime`, () => {
            for (const key of DYNAMIC_KEYS) {
                expect(typeof at(catalog, `webchat.${key}`), `${locale}.webchat.${key}`).toBe("string");
            }
        });

        it(`${locale}: names the channel the agreed way`, () => {
            expect(at(catalog, "webchat.page.title")).toBe(CHANNEL_NAME);
            expect(at(catalog, "liveChat.filterWebchat")).toBe(CHANNEL_NAME);
            expect(at(catalog, "sidebar.families.webchat")).toBe(CHANNEL_NAME);
        });

        it(`${locale}: no longer carries the legacy support inbox keys`, () => {
            for (const key of REMOVED_KEYS) {
                expect(at(catalog, key), `${locale}.${key}`).toBeUndefined();
            }
        });
    }
});
