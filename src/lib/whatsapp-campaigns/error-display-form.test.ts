import deMessages from "@/i18n/messages/de.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import ptMessages from "@/i18n/messages/pt.json";
import {
    WHATSAPP_CAMPAIGN_INTERNAL_ERROR_CODES,
    resolveWhatsAppCampaignErrorDisplay,
} from "@/lib/whatsapp-campaigns/error-display";
import { describe, expect, it } from "vitest";

type MetaErrors = Record<string, string>;

function metaErrors(messages: { whatsappCampaignsPage: { detail: { metaErrors: MetaErrors } } }): MetaErrors {
    return messages.whatsappCampaignsPage.detail.metaErrors;
}

describe("form not sendable entry failure", () => {
    const code = WHATSAPP_CAMPAIGN_INTERNAL_ERROR_CODES.formNotSendable;

    it("uses the code the backend writes on the entry", () => {
        expect(code).toBe(900011);
    });

    it("is labelled in every locale", () => {
        for (const messages of [ptMessages, enMessages, esMessages, deMessages]) {
            expect(metaErrors(messages)[String(code)]).toBeTruthy();
        }
        expect(metaErrors(ptMessages)[String(code)]).toBe("Formulário não liberado para envio");
    });

    it("shows the label instead of the raw backend message", () => {
        const pt = metaErrors(ptMessages);
        const result = resolveWhatsAppCampaignErrorDisplay({
            errorCode: code,
            errorMessage: "form publication not sendable",
            hasTranslation: (key) => key === `detail.metaErrors.${code}`,
            translate: () => pt[String(code)],
            unknownMessage: "Unknown API error",
        });

        expect(result).toEqual({ show: true, code, description: pt[String(code)] });
    });
});
