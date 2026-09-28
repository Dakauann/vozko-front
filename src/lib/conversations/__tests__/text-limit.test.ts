import { describe, expect, it } from "vitest";

import { textLimitState } from "@/lib/conversations/text-limit";

describe("textLimitState", () => {
    it("says nothing when the channel has no limit", () => {
        expect(textLimitState("oi", null)).toBeNull();
    });

    it("counts characters the way the backend counts runes", () => {
        expect(textLimitState("😀😀", 2000)).toEqual({ count: 2, limit: 2000, over: false, near: false });
    });

    it("warns near the limit and blocks above it", () => {
        expect(textLimitState("a".repeat(1800), 2000)).toMatchObject({ near: true, over: false });
        expect(textLimitState("a".repeat(2000), 2000)).toMatchObject({ over: false });
        expect(textLimitState("a".repeat(2001), 2000)).toMatchObject({ over: true });
    });
});
