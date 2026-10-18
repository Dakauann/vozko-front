import { describe, expect, it } from "vitest";

import { fillVariables } from "./preview";

describe("fillVariables", () => {
    it("uses the template's own examples, in order", () => {
        expect(fillVariables("Olá {{1}}, pedido {{2}}", ["Maria", "123"])).toBe("Olá Maria, pedido 123");
    });

    it("falls back to sample values when an example is missing", () => {
        expect(fillVariables("Olá {{1}}, pedido {{2}}", ["Maria"])).toBe("Olá Maria, pedido Smith");
        expect(fillVariables("Olá {{name}}", [])).toBe("Olá John");
    });
});
