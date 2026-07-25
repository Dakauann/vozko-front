export const WHATSAPP_CAMPAIGN_INTERNAL_ERROR_CODES = {
    noBusinessPhoneConfigured: 900002,
    whatsappClientUnavailable: 900003,
    missingEntryVariables: 900006,
} as const;

const LEGACY_INTERNAL_ERROR_CODES_BY_MESSAGE: Record<string, number> = {
    "No business phone configured":
        WHATSAPP_CAMPAIGN_INTERNAL_ERROR_CODES.noBusinessPhoneConfigured,
    "Could not resolve WhatsApp client":
        WHATSAPP_CAMPAIGN_INTERNAL_ERROR_CODES.whatsappClientUnavailable,
    "Could not find entry for variables":
        WHATSAPP_CAMPAIGN_INTERNAL_ERROR_CODES.missingEntryVariables,
};

export interface ResolveWhatsAppCampaignErrorDisplayInput {
    errorCode?: number | null;
    errorMessage?: string | null;
    hasTranslation: (key: string) => boolean;
    translate: (key: string) => string;
    unknownMessage: string;
}

export interface WhatsAppCampaignErrorDisplay {
    show: boolean;
    code: number | null;
    description: string;
}

function normalizeLegacyInternalErrorCode(
    errorCode?: number | null,
    errorMessage?: string | null,
): number | null {
    const trimmedMessage = errorMessage?.trim() ?? "";
    if (trimmedMessage !== "") {
        const legacyCode = LEGACY_INTERNAL_ERROR_CODES_BY_MESSAGE[trimmedMessage];
        if (legacyCode !== undefined) {
            return legacyCode;
        }
    }

    if (typeof errorCode !== "number" || Number.isNaN(errorCode)) {
        return null;
    }

    return errorCode;
}

export function resolveWhatsAppCampaignErrorDisplay(
    input: ResolveWhatsAppCampaignErrorDisplayInput,
): WhatsAppCampaignErrorDisplay {
    const trimmedMessage = input.errorMessage?.trim() ?? "";
    const normalizedCode = normalizeLegacyInternalErrorCode(
        input.errorCode,
        trimmedMessage,
    );

    if (normalizedCode === null && trimmedMessage === "") {
        return {
            show: false,
            code: null,
            description: input.unknownMessage,
        };
    }

    if (normalizedCode !== null) {
        const translationKey = `detail.metaErrors.${normalizedCode}`;
        if (input.hasTranslation(translationKey)) {
            return {
                show: true,
                code: normalizedCode > 0 ? normalizedCode : null,
                description: input.translate(translationKey),
            };
        }
    }

    return {
        show: true,
        code: normalizedCode !== null && normalizedCode > 0 ? normalizedCode : null,
        description: trimmedMessage || input.unknownMessage,
    };
}