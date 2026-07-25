import {
    WHATSAPP_CAMPAIGN_INTERNAL_ERROR_CODES,
    resolveWhatsAppCampaignErrorDisplay,
} from "@/lib/whatsapp-campaigns/error-display";
import { describe, expect, it } from "vitest";

const translations = new Map<string, string>([
    ["detail.metaErrors.0", "Unknown API error"],
    ["detail.metaErrors.131042", "Business eligibility payment issue"],
    [
        `detail.metaErrors.${WHATSAPP_CAMPAIGN_INTERNAL_ERROR_CODES.whatsappClientUnavailable}`,
        "Could not resolve this campaign's WhatsApp client",
    ],
]);

describe("resolveWhatsAppCampaignErrorDisplay", () => {
    it("shows message-only failures even when no error code exists", () => {
        const result = resolveWhatsAppCampaignErrorDisplay({
            errorMessage: "Provider rejected the request payload",
            hasTranslation: (key) => translations.has(key),
            translate: (key) => translations.get(key) ?? key,
            unknownMessage: "Unknown API error",
        });

        expect(result).toEqual({
            show: true,
            code: null,
            description: "Provider rejected the request payload",
        });
    });

    it("maps legacy internal sender failures to dedicated translation keys", () => {
        const result = resolveWhatsAppCampaignErrorDisplay({
            errorCode: 3,
            errorMessage: "Could not resolve WhatsApp client",
            hasTranslation: (key) => translations.has(key),
            translate: (key) => translations.get(key) ?? key,
            unknownMessage: "Unknown API error",
        });

        expect(result).toEqual({
            show: true,
            code: WHATSAPP_CAMPAIGN_INTERNAL_ERROR_CODES.whatsappClientUnavailable,
            description: "Could not resolve this campaign's WhatsApp client",
        });
    });

    it("prefers translated Meta descriptions for known codes", () => {
        const result = resolveWhatsAppCampaignErrorDisplay({
            errorCode: 131042,
            errorMessage: "(#131042) Business eligibility payment issue",
            hasTranslation: (key) => translations.has(key),
            translate: (key) => translations.get(key) ?? key,
            unknownMessage: "Unknown API error",
        });

        expect(result).toEqual({
            show: true,
            code: 131042,
            description: "Business eligibility payment issue",
        });
    });
});