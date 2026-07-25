// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
    dollarsToMicros,
    microsToDollars,
} from "./pricing-helpers";

describe("microsToDollars", () => {
    it("converts zero", () => {
        expect(microsToDollars(0)).toBe("0");
    });

    it("converts whole-dollar amounts", () => {
        expect(microsToDollars(180_000_000)).toBe("180");
    });

    it("converts fractional dollar amounts", () => {
        expect(microsToDollars(6_800)).toBe("0.0068");
    });

    it("converts sub-cent amounts", () => {
        expect(microsToDollars(330_000)).toBe("0.33");
    });

    it("strips trailing zeros after decimal", () => {
        expect(microsToDollars(5_000_000)).toBe("5");
    });

    it("preserves necessary precision", () => {
        expect(microsToDollars(16_667)).toBe("0.016667");
    });

    it("converts exchange-rate amount (6_000_000 -> 6)", () => {
        expect(microsToDollars(6_000_000)).toBe("6");
    });
});

describe("dollarsToMicros", () => {
    it("converts zero", () => {
        expect(dollarsToMicros("0")).toBe(0);
    });

    it("converts whole-dollar amounts", () => {
        expect(dollarsToMicros("180")).toBe(180_000_000);
    });

    it("converts fractional dollar amounts", () => {
        expect(dollarsToMicros("0.0068")).toBe(6_800);
    });

    it("converts sub-cent amounts", () => {
        expect(dollarsToMicros("0.33")).toBe(330_000);
    });

    it("handles comma as decimal separator", () => {
        expect(dollarsToMicros("0,33")).toBe(330_000);
    });

    it("returns 0 for invalid input", () => {
        expect(dollarsToMicros("abc")).toBe(0);
        expect(dollarsToMicros("")).toBe(0);
    });

    it("returns 0 for negative input", () => {
        expect(dollarsToMicros("-5")).toBe(0);
    });

    it("rounds to nearest micro", () => {
        expect(dollarsToMicros("0.016667")).toBe(16_667);
    });
});

describe("round-trip micros -> dollars -> micros", () => {
    const testCases = [
        { label: "TTS multilingual cost", micros: 180_000_000 },
        { label: "TTS turbo cost", micros: 90_000_000 },
        { label: "STT scribe cost", micros: 330_000 },
        { label: "STT realtime cost", micros: 460_000 },
        { label: "WhatsApp utility cost", micros: 6_800 },
        { label: "WhatsApp utility price", micros: 16_667 },
        { label: "WhatsApp marketing cost", micros: 62_500 },
        { label: "WhatsApp marketing price", micros: 66_667 },
        { label: "Telephony cost", micros: 4_167 },
        { label: "Telephony price", micros: 8_333 },
        { label: "Exchange rate", micros: 6_000_000 },
        { label: "Zero", micros: 0 },
    ];

    for (const { label, micros } of testCases) {
        it(`preserves ${label} (${micros})`, () => {
            const dollars = microsToDollars(micros);
            const backToMicros = dollarsToMicros(dollars);
            expect(backToMicros).toBe(micros);
        });
    }
});
