import { describe, expect, it } from "vitest";

import {
    isCompleteSendCapCode,
    parseSendCapLimit,
    sendCapUsageRatio,
} from "@/lib/balance/send-cap-types";

describe("parseSendCapLimit", () => {
    it.each([
        ["1000", 1000],
        [" 25 ", 25],
    ])("accepts the positive whole number %s", (raw, expected) => {
        expect(parseSendCapLimit(raw)).toBe(expected);
    });

    it.each(["", "0", "-5", "1.5", "1e3", "abc", "99999999999999999999"])(
        "rejects %s",
        (raw) => {
            expect(parseSendCapLimit(raw)).toBeNull();
        },
    );
});

describe("isCompleteSendCapCode", () => {
    it("needs exactly four digits", () => {
        expect(isCompleteSendCapCode("1234")).toBe(true);
        expect(isCompleteSendCapCode("123")).toBe(false);
        expect(isCompleteSendCapCode("12345")).toBe(false);
        expect(isCompleteSendCapCode("12a4")).toBe(false);
    });
});

describe("sendCapUsageRatio", () => {
    it("clamps to the bar width", () => {
        expect(sendCapUsageRatio({ used: 50, limit: 100 })).toBe(0.5);
        expect(sendCapUsageRatio({ used: 130, limit: 100 })).toBe(1);
        expect(sendCapUsageRatio({ used: -3, limit: 100 })).toBe(0);
    });
});
