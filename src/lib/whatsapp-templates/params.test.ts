import { describe, expect, it } from "vitest";

import { templateParamSlots } from "./params";
import type { WhatsAppTemplate } from "./types";

type SlotInput = Pick<
    WhatsAppTemplate,
    "components" | "parameterFormat" | "category"
>;

function template(partial: Partial<SlotInput>): SlotInput {
    return {
        components: [],
        parameterFormat: undefined,
        category: "MARKETING",
        ...partial,
    } as SlotInput;
}

describe("templateParamSlots", () => {
    it("reads body and header variables apart", () => {
        const slots = templateParamSlots(
            template({
                components: [
                    { type: "HEADER", format: "TEXT", text: "Pedido {{1}}" },
                    { type: "BODY", text: "Ola {{1}}, o pedido {{2}} saiu." },
                ],
            }),
        );

        expect(slots.body).toEqual(["1", "2"]);
        expect(slots.header).toEqual(["1"]);
    });

    it("reports no variables for a template that has none", () => {
        const slots = templateParamSlots(
            template({ components: [{ type: "BODY", text: "Recebemos o seu pedido." }] }),
        );

        expect(slots.body).toEqual([]);
    });

    // The rule three send surfaces depend on: the template picker, the outreach
    // dialog and the campaign wizard all ask this what to collect. WhatsApp owns
    // an authentication body and returns it without a placeholder, so counting
    // placeholders answers zero for a template that needs the one-time code.
    it("asks for the one-time code when an authentication body has no placeholder", () => {
        const slots = templateParamSlots(
            template({
                category: "AUTHENTICATION",
                components: [{ type: "BODY", text: "" }],
            }),
        );

        expect(slots.body).toEqual(["1"]);
    });

    it("does not invent a second slot when the authentication body does carry one", () => {
        const slots = templateParamSlots(
            template({
                category: "AUTHENTICATION",
                components: [{ type: "BODY", text: "{{1}} e o seu codigo." }],
            }),
        );

        expect(slots.body).toEqual(["1"]);
    });

    it("leaves every other category alone when the body is empty", () => {
        for (const category of ["MARKETING", "UTILITY"] as const) {
            const slots = templateParamSlots(
                template({ category, components: [{ type: "BODY", text: "" }] }),
            );
            expect(slots.body, category).toEqual([]);
        }
    });

    it("treats a missing template as having nothing to fill", () => {
        expect(templateParamSlots(null).body).toEqual([]);
        expect(templateParamSlots(undefined).body).toEqual([]);
    });

    it("detects named variables", () => {
        const slots = templateParamSlots(
            template({ components: [{ type: "BODY", text: "Ola {{nome}}" }] }),
        );

        expect(slots.body).toEqual(["nome"]);
        expect(slots.named).toBe(true);
    });

    it("does not call an authentication template named", () => {
        const slots = templateParamSlots(
            template({ category: "AUTHENTICATION", components: [{ type: "BODY", text: "" }] }),
        );

        expect(slots.named).toBe(false);
    });
});
