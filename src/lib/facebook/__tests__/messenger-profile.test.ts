import { describe, expect, it } from "vitest";

import {
    MAX_GREETING_CHARS,
    MAX_ICE_BREAKERS,
    MAX_MENU_ITEMS,
    MAX_MENU_TITLE_CHARS,
    emptyMessengerProfile,
    greetingFor,
    iceBreakersFor,
    isProfileLocale,
    menuFor,
    normalizeMessengerProfile,
    profileLocales,
    profileProblems,
    withGreeting,
    withIceBreakers,
    withMenu,
} from "@/lib/facebook/messenger-profile";
import type { MessengerMenuItem, MessengerProfile } from "@/lib/facebook/types";

function profile(overrides: Partial<MessengerProfile> = {}): MessengerProfile {
    return { ...emptyMessengerProfile(), ...overrides };
}

const postback = (title: string): MessengerMenuItem => ({ type: "postback", title, payload: "P" });

describe("messenger profile limits", () => {
    it("mirrors the backend limits", () => {
        expect(MAX_ICE_BREAKERS).toBe(4);
        expect(MAX_MENU_ITEMS).toBe(20);
        expect(MAX_MENU_TITLE_CHARS).toBe(30);
        expect(MAX_GREETING_CHARS).toBe(160);
    });
});

describe("profileProblems", () => {
    it("accepts an empty profile", () => {
        expect(profileProblems(profile())).toEqual([]);
    });

    it("refuses a persistent menu without Get Started", () => {
        const p = profile({ persistentMenu: [{ locale: "default", composerInputDisabled: false, items: [postback("Menu")] }] });
        expect(profileProblems(p)).toContain("menuNeedsGetStarted");
        expect(profileProblems({ ...p, getStarted: { payload: "GET_STARTED" } })).toEqual([]);
    });

    it("refuses more than 4 ice breakers and incomplete ones", () => {
        const items = Array.from({ length: 5 }, (_, i) => ({ question: `Q${i}`, payload: `P${i}` }));
        expect(profileProblems(profile({ iceBreakers: [{ locale: "default", items }] }))).toContain("tooManyIceBreakers");
        expect(
            profileProblems(profile({ iceBreakers: [{ locale: "default", items: [{ question: " ", payload: "P" }] }] })),
        ).toContain("iceBreakerIncomplete");
    });

    it("refuses more than 20 menu items and titles over 30 characters", () => {
        const many = Array.from({ length: 21 }, (_, i) => postback(`Item ${i}`));
        const base = { getStarted: { payload: "GET_STARTED" } };
        expect(
            profileProblems(profile({ ...base, persistentMenu: [{ locale: "default", composerInputDisabled: false, items: many }] })),
        ).toContain("tooManyMenuItems");
        expect(
            profileProblems(
                profile({ ...base, persistentMenu: [{ locale: "default", composerInputDisabled: false, items: [postback("x".repeat(31))] }] }),
            ),
        ).toContain("menuTitleLength");
        expect(
            profileProblems(
                profile({ ...base, persistentMenu: [{ locale: "default", composerInputDisabled: false, items: [postback("x".repeat(30))] }] }),
            ),
        ).toEqual([]);
    });

    it("needs https links on web menu items", () => {
        const base = { getStarted: { payload: "GET_STARTED" } };
        const item: MessengerMenuItem = { type: "web_url", title: "Site", url: "http://x.test" };
        expect(
            profileProblems(profile({ ...base, persistentMenu: [{ locale: "default", composerInputDisabled: false, items: [item] }] })),
        ).toContain("menuLinkInvalid");
    });

    it("counts greeting characters, not bytes", () => {
        expect(profileProblems(profile({ greeting: [{ locale: "default", text: "é".repeat(160) }] }))).toEqual([]);
        expect(profileProblems(profile({ greeting: [{ locale: "default", text: "é".repeat(161) }] }))).toContain("greetingTooLong");
    });
});

describe("per-locale editing", () => {
    it("lists default first and every locale in use", () => {
        const p = profile({
            greeting: [{ locale: "en_US", text: "Hi" }],
            iceBreakers: [{ locale: "default", items: [] }],
            persistentMenu: [{ locale: "es_ES", composerInputDisabled: false, items: [] }],
        });
        expect(profileLocales(p)).toEqual(["default", "en_US", "es_ES"]);
        expect(profileLocales(profile())).toEqual(["default"]);
    });

    it("sets and clears a greeting without touching other locales", () => {
        const base = profile({ greeting: [{ locale: "en_US", text: "Hi" }] });
        const next = withGreeting(base, "default", "Olá");
        expect(greetingFor(next, "default")).toBe("Olá");
        expect(greetingFor(next, "en_US")).toBe("Hi");
        expect(withGreeting(next, "default", "  ").greeting).toEqual([{ locale: "en_US", text: "Hi" }]);
    });

    it("replaces ice breakers of one locale and drops the set when empty", () => {
        const next = withIceBreakers(profile(), "default", [{ question: "Preço?", payload: "PRICE" }]);
        expect(iceBreakersFor(next, "default")).toEqual([{ question: "Preço?", payload: "PRICE" }]);
        expect(withIceBreakers(next, "default", []).iceBreakers).toEqual([]);
    });

    it("replaces the menu of one locale and removes it with null", () => {
        const menu = { locale: "default", composerInputDisabled: true, items: [postback("Menu")] };
        const next = withMenu(profile(), "default", menu);
        expect(menuFor(next, "default")).toEqual(menu);
        expect(withMenu(next, "default", null).persistentMenu).toEqual([]);
    });

    it("accepts Meta locale codes only", () => {
        expect(isProfileLocale("pt_BR")).toBe(true);
        expect(isProfileLocale("default")).toBe(true);
        expect(isProfileLocale("pt-BR")).toBe(false);
        expect(isProfileLocale("")).toBe(false);
    });
});

describe("normalizeMessengerProfile", () => {
    it("turns missing sections into empty ones", () => {
        expect(normalizeMessengerProfile({ greeting: null, getStarted: undefined } as unknown as Partial<MessengerProfile>)).toEqual(
            emptyMessengerProfile(),
        );
    });
});
