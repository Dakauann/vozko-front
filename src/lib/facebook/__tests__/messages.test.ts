import { describe, expect, it } from "vitest";

import IntlMessageFormat from "intl-messageformat";
import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { FACEBOOK_ERROR_CODES } from "@/lib/facebook/errors";
import { FACEBOOK_RULE_ACTIONS } from "@/lib/social/comment-rules";

const CATALOGS: Record<string, Record<string, unknown>> = { pt, en, de, es };

const DASHES = new RegExp("[\\u2013\\u2014]");

const PARITY_NAMESPACES = [
    "facebook",
    "instagram.comments",
    "instagram.commentRules",
    "crmConversation.meta",
    "conversationWindow",
    "audience.quickActions",
];

const REQUIRED_KEYS = [
    "sidebar.nav.facebook",
    "sidebar.nav.facebookPages",
    "sidebar.nav.connectFacebook",
    "sidebar.families.facebook",
    "workspaceSettings.resources.facebook_pages",
    "workspaceSettings.resourceDescriptions.facebook_pages",
    "liveChat.filterFacebook",
    "leadsPage.filters.options.channel.facebook",
    "metricsOps.common.facebook",
    "audience.channels.facebook",
    "aiChatPage.chart.values.facebook",
    "aiChatPage.actions.kinds.connect_facebook.title",
    "aiChatPage.actions.kinds.connect_facebook.description",
    "aiChatPage.actions.kinds.connect_facebook.cta",
    "conversationWindow.tier.humanAgent",
    "conversationWindow.tier.humanAgentNoDate",
    "conversationWindow.textLimit",
    "instagram.comments.privateReplyDeadlineUnknown",
    "audience.quickActions.privateReplyDialog.expired",
    "audience.quickActions.privateReplyDialog.deadlineUnknown",
];

const DYNAMIC_FACEBOOK_KEYS = [
    ...["pending", "connected", "token_revoked", "needs_role", "restricted", "disconnected", "routing_off"].map((s) => `status.${s}`),
    ...["messaging", "readPosts", "publish", "moderate", "comment", "subscribe", "humanAgent"].map((c) => `capability.${c}`),
    ...["invalid_state", "expired_state", "declined", "no_pages_granted", "grant_unverifiable", "connect_failed"].map(
        (r) => `connectError.${r}`,
    ),
    ...FACEBOOK_ERROR_CODES.map((code) => `errors.${code}`),
    ...[
        "messageRequired",
        "linkInvalid",
        "photoCount",
        "albumCount",
        "photoType",
        "photoTooLarge",
        "videoCount",
        "videoType",
        "videoTooLarge",
        "storyCount",
        "storyNoText",
        "titleOnlyVideo",
        "scheduleInvalid",
        "scheduleTooSoon",
        "scheduleTooFar",
        "scheduleNotSchedulable",
    ].map((p) => `composer.problem.${p}`),
    ...["text", "link", "photo", "album", "video", "reel", "story"].flatMap((k) => [`composer.kinds.${k}`, `composer.kindHint.${k}`]),
    ...[
        "menuNeedsGetStarted",
        "greetingTooLong",
        "tooManyIceBreakers",
        "iceBreakerIncomplete",
        "tooManyMenuItems",
        "menuTitleLength",
        "menuPayloadMissing",
        "menuLinkInvalid",
    ].map((p) => `profile.problem.${p}`),
    ...["queued", "uploading", "processing"].map((s) => `publishJob.status.${s}`),
    ...FACEBOOK_RULE_ACTIONS.flatMap((a) => [`commentRules.action.${a}`, `commentRules.hint.${a}`]),
    ...["reconnect", "notConnected", "missing", "noPermission"].map((g) => `gate.${g}`),
    ...["connected", "reconnected", "already_linked_elsewhere", "missing_task", "missing_permission"].map((o) => `connect.outcome.${o}`),
    ...["RECEIVED", "COMPLETED", "FAILED"].flatMap((s) => [`dataDeletion.status.${s}`, `dataDeletion.statusBody.${s}`]),
    ...["status", "link", "photo", "album", "video", "reel", "story", "shared", "visitor"].map((k) => `posts.kind.${k}`),
    ...["posts", "scheduled", "reels"].flatMap((tab) => [`posts.section.${tab}`, `posts.empty.${tab}`, `tabs.${tab}`]),
    ...["meta_business_suite", "external_app", "unknown"].map((v) => `sentVia.${v}`).map((k) => `../crmConversation.meta.${k}`),
];

function flatten(value: unknown, prefix = ""): Array<[string, string]> {
    if (typeof value === "string") return [[prefix, value]];
    if (!value || typeof value !== "object") return [];
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        flatten(child, prefix ? `${prefix}.${key}` : key),
    );
}

function at(catalog: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined), catalog);
}

function resolve(catalog: Record<string, unknown>, key: string): unknown {
    return key.startsWith("../") ? at(catalog, key.slice(3)) : at(catalog, `facebook.${key}`);
}

describe("Facebook channel messages", () => {
    for (const namespace of PARITY_NAMESPACES) {
        const reference = new Set(flatten(at(pt, namespace)).map(([key]) => key));

        it(`pt defines ${namespace}`, () => {
            expect(reference.size).toBeGreaterThan(0);
        });

        for (const [locale, catalog] of Object.entries(CATALOGS)) {
            it(`${locale}: ${namespace} has every key pt has, and no extras`, () => {
                const keys = new Set(flatten(at(catalog, namespace)).map(([key]) => key));
                const missing = [...reference].filter((k) => !keys.has(k));
                const extra = [...keys].filter((k) => !reference.has(k));
                expect(missing, `${locale} is missing ${missing.join(", ")}`).toEqual([]);
                expect(extra, `${locale} has extra ${extra.join(", ")}`).toEqual([]);
            });

            it(`${locale}: ${namespace} parses as ICU and has no em or en dashes`, () => {
                for (const [key, message] of flatten(at(catalog, namespace))) {
                    expect(() => new IntlMessageFormat(message, locale), `${locale}.${namespace}.${key}`).not.toThrow();
                    expect(message, `${locale}.${namespace}.${key}`).not.toMatch(DASHES);
                }
            });
        }
    }

    for (const [locale, catalog] of Object.entries(CATALOGS)) {
        it(`${locale}: defines every cross-app key the channel needs`, () => {
            for (const key of REQUIRED_KEYS) {
                const value = at(catalog, key);
                expect(typeof value, `${locale}.${key}`).toBe("string");
                expect(value as string, `${locale}.${key}`).not.toMatch(DASHES);
                expect(() => new IntlMessageFormat(value as string, locale), `${locale}.${key}`).not.toThrow();
            }
        });

        it(`${locale}: defines every key the Facebook screens build at runtime`, () => {
            for (const key of DYNAMIC_FACEBOOK_KEYS) {
                expect(typeof resolve(catalog, key), `${locale}.${key}`).toBe("string");
            }
        });
    }
});
