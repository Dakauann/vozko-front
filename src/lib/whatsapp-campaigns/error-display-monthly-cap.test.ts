import enMessages from "@/i18n/messages/en.json";
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

describe("monthly send cap entry failure", () => {
    const code = WHATSAPP_CAMPAIGN_INTERNAL_ERROR_CODES.monthlySendCapReached;

    it("uses the code the backend writes on the entry", () => {
        expect(code).toBe(900009);
    });

    it("is translated in every locale and points the user to the administration", () => {
        expect(metaErrors(ptMessages)[String(code)]).toMatch(/administração/);
        expect(metaErrors(enMessages)[String(code)]).toMatch(/administration/);
    });

    it("shows the translation instead of the raw backend message", () => {
        const pt = metaErrors(ptMessages);
        const result = resolveWhatsAppCampaignErrorDisplay({
            errorCode: code,
            errorMessage: "monthly template send cap reached",
            hasTranslation: (key) => key === `detail.metaErrors.${code}`,
            translate: () => pt[String(code)],
            unknownMessage: "Unknown API error",
        });

        expect(result).toEqual({ show: true, code, description: pt[String(code)] });
    });
});
