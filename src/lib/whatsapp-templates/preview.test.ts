import { describe, expect, it } from "vitest";

import { fillVariables, toPreviewComponents } from "./preview";

describe("fillVariables", () => {
    it("uses the template's own examples, in order", () => {
        expect(fillVariables("Olá {{1}}, pedido {{2}}", ["Maria", "123"])).toBe("Olá Maria, pedido 123");
    });

    it("falls back to sample values when an example is missing", () => {
        expect(fillVariables("Olá {{1}}, pedido {{2}}", ["Maria"])).toBe("Olá Maria, pedido Smith");
        expect(fillVariables("Olá {{name}}", [])).toBe("Olá John");
    });
});

describe("toPreviewComponents", () => {
    it("maps stored Meta components to the preview, with body examples and header media", () => {
        const out = toPreviewComponents(
            [
                { type: "HEADER", format: "IMAGE", example: { header_handle: ["https://meta/handle"] } },
                { type: "BODY", text: "Olá {{1}}", example: { body_text: [["Maria"]] } },
                { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Quero reativar" }] },
            ],
            "https://files.test/banner.jpg",
        );
        expect(out[0].data.example).toBe("https://files.test/banner.jpg");
        expect(out[1].data.variableExamples).toEqual(["Maria"]);
        expect(out[2].data.buttons?.[0]).toMatchObject({ type: "QUICK_REPLY", text: "Quero reativar" });
    });

    it("keeps the Meta handle when there is no stored media", () => {
        const out = toPreviewComponents([{ type: "HEADER", format: "VIDEO", example: { header_handle: ["https://meta/h"] } }]);
        expect(out[0].data.example).toBe("https://meta/h");
    });
});
