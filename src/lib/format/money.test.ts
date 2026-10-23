import { describe, expect, it } from "vitest";

import { formatCentsAsBrl, formatMicrosToMoney, visibleFractionDigits } from "./money";

describe("visibleFractionDigits", () => {
    it("keeps the usual digits when the amount reads as itself", () => {
        expect(visibleFractionDigits(2.97, 2)).toBe(2);
        expect(visibleFractionDigits(0, 2)).toBe(2);
    });

    it("adds digits, up to four, so a non zero amount never reads as zero", () => {
        expect(visibleFractionDigits(0.0035, 2)).toBe(4);
        expect(visibleFractionDigits(0.007, 2)).toBe(2);
        expect(visibleFractionDigits(0.004, 2)).toBe(4);
    });

    it("adds digits, up to four, so an amount reads apart from the one it is compared to", () => {
        expect(visibleFractionDigits(499.9965, 2, 500)).toBe(4);
        expect(visibleFractionDigits(497.03, 2, 500)).toBe(2);
    });
});

describe("formatMicrosToMoney", () => {
    it("never shows a cost below one centavo as zero", () => {
        expect(formatMicrosToMoney(700, 5, "pt").replace(/\s/g, " ")).toBe("R$ 0,0035");
        expect(formatMicrosToMoney(1_000_000, 5, "pt").replace(/\s/g, " ")).toBe("R$ 5,00");
    });
});

describe("formatCentsAsBrl", () => {
    it("formats cents as reais in the reader's locale", () => {
        expect(formatCentsAsBrl(50_300, "pt").replace(/\s/g, " ")).toBe("R$ 503,00");
        expect(formatCentsAsBrl(503, "en")).toBe("R$5.03");
    });
});
