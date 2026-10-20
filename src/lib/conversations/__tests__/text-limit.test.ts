import { describe, expect, it } from "vitest";

import { offendingCharactersLabel, textLimitState } from "@/lib/conversations/text-limit";

const characters = (max: number) => ({ max, unit: "characters" as const });
const bytes = (max: number) => ({ max, unit: "bytes" as const });

describe("textLimitState", () => {
    it("says nothing when the channel has no limit", () => {
        expect(textLimitState("oi", null)).toBeNull();
    });

    it("counts characters the way the backend counts runes", () => {
        expect(textLimitState("😀😀", characters(2000))).toEqual({ count: 2, limit: 2000, unit: "characters", over: false, near: false, refused: false, offending: [] });
    });

    it("warns near the limit and blocks above it", () => {
        expect(textLimitState("a".repeat(1800), characters(2000))).toMatchObject({ near: true, over: false });
        expect(textLimitState("a".repeat(2000), characters(2000))).toMatchObject({ over: false });
        expect(textLimitState("a".repeat(2001), characters(2000))).toMatchObject({ over: true, refused: true });
    });

    it("counts UTF-8 bytes the way the backend counts len() on a byte limit", () => {
        expect(textLimitState("ação", bytes(1000))).toEqual({ count: 6, limit: 1000, unit: "bytes", over: false, near: false, refused: false, offending: [] });
        expect(textLimitState("😀", bytes(1000))).toMatchObject({ count: 4 });
    });

    it("blocks a text that fits in characters but not in bytes", () => {
        const accented = "é".repeat(600);
        expect(textLimitState(accented, characters(1000))).toMatchObject({ count: 600, over: false });
        expect(textLimitState(accented, bytes(1000))).toMatchObject({ count: 1200, over: true });
        expect(textLimitState("a".repeat(1000), bytes(1000))).toMatchObject({ over: false });
    });

    it("reports the characters a channel charset refuses, live, and blocks the send", () => {
        const mercadolivre = { max: 350, unit: "characters" as const, charset: "mercadolivre" as const };
        expect(textLimitState("Olá, tudo certo? 😀", mercadolivre)).toMatchObject({ over: false, refused: false, offending: [] });
        expect(textLimitState("Total 10€ “ok” €", mercadolivre)).toMatchObject({
            over: false,
            refused: true,
            count: 16,
            offending: [{ character: "€", occurrences: 2 }, { character: "“", occurrences: 1 }, { character: "”", occurrences: 1 }],
        });
    });

    it("labels refused characters so invisible ones can still be found", () => {
        expect(offendingCharactersLabel([{ character: "€", occurrences: 2 }, { character: "\u200D", occurrences: 1 }, { character: "\u0007", occurrences: 1 }, { character: "🫠", occurrences: 1 }])).toBe("€ U+200D U+0007 🫠");
    });

    it("checks no charset for channels without one", () => {
        expect(textLimitState("Total 10€", characters(2000))).toMatchObject({ over: false, offending: [] });
    });
});
