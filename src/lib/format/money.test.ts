import { describe, expect, it } from "vitest";

import { formatCentsAsBrl } from "./money";

describe("formatCentsAsBrl", () => {
    it("formats cents as reais in the reader's locale", () => {
        expect(formatCentsAsBrl(50_300, "pt").replace(/\s/g, " ")).toBe("R$ 503,00");
        expect(formatCentsAsBrl(503, "en")).toBe("R$5.03");
    });
});
