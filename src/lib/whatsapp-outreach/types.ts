import type { TemplateComponent } from "@/lib/whatsapp-templates/types";

export interface StartOfficialConversationPayload {
    businessPhoneId: string;
    /** The template's id, never its name: a name can resolve to a different row. */
    templateId: string;
    phoneNumber: string;
    name?: string;
    parameters?: string[];
    headerParameters?: string[];
}

export interface StartedOfficialConversation {
    entryId: string;
    entryType: string;
    leadId?: string;
    attemptId?: string;
    messageId?: string;
    conversationExisted: boolean;
    /** True when this exact request had already been sent: nothing was charged. */
    replayed: boolean;
    chargedMicros: number;
    /** False when the message was delivered but could not be written to the thread. */
    recorded: boolean;
}

export interface SendQuote {
    category: string;
    priceMicros: number;
    balanceMicros: number;
    affordable: boolean;
}

/**
 * A refusal the operator can act on.
 *
 * `code` is what the UI branches on — never the message, which is prose written
 * for a human in one language and will change the first time somebody improves
 * the wording.
 */
export interface OutreachError {
    code: string;
    message: string;
    /** Present on window_already_open: the conversation to open instead. */
    entryId?: string;
    entryType?: string;
}

/**
 * Ready-made UTILITY templates.
 *
 * They exist because "create a template" is a blank page for anyone who has not
 * done it before, and the blank page is where operators either give up or write
 * something Meta rejects. Each starter is a shape Meta approves routinely and
 * that carries no promotional content — which is what makes it UTILITY, and what
 * makes it usable by any business regardless of what they sell.
 *
 * Category is not a labelling choice: UTILITY is billed at roughly a quarter of
 * MARKETING, so a starter that quietly used the promotional category would cost
 * the workspace four times as much per message for the same text.
 */
export interface TemplateStarter {
    /** Stable id, also the i18n key suffix. */
    id: string;
    /** Suggested template name; lowercase, digits and underscores only. */
    suggestedName: string;
    /**
     * i18n key of the body text, fully qualified within this namespace.
     *
     * The stored message quote-escapes its `{{n}}` placeholders, because ICU
     * reads a bare `{` as the start of an argument and fails the whole message —
     * which next-intl reports by rendering the key path to the operator.
     */
    bodyKey: string;
    /** How many variables the body carries. */
    variableCount: number;
}

export const UTILITY_STARTERS: TemplateStarter[] = [
    { id: "followUp", suggestedName: "retomada_atendimento", bodyKey: "create.starters.followUp.body", variableCount: 1 },
    { id: "confirmation", suggestedName: "confirmacao_agendamento", bodyKey: "create.starters.confirmation.body", variableCount: 2 },
    { id: "update", suggestedName: "atualizacao_solicitacao", bodyKey: "create.starters.update.body", variableCount: 2 },
    { id: "documentReady", suggestedName: "documento_disponivel", bodyKey: "create.starters.documentReady.body", variableCount: 1 },
];

/** Builds the create payload for a starter. Text-only: the one shape that has no media to upload. */
export function starterComponents(bodyText: string, examples: string[]): TemplateComponent[] {
    return [
        {
            type: "BODY",
            text: bodyText,
            // Meta requires an example for every variable, or the template is
            // rejected on submission rather than on review.
            example: examples.length > 0 ? { body_text: [examples] } : undefined,
        },
    ];
}

/** Meta's rule for template names, applied as the operator types rather than on submit. */
export function normalizeTemplateName(raw: string): string {
    return raw
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9_\s]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .slice(0, 64);
}

export function isValidTemplateName(name: string): boolean {
    return /^[a-z][a-z0-9_]*$/.test(name) && name.length >= 3;
}

// Money conversion lives in @/lib/pricing/currency. Prices here are USD micros
// and the operator is shown BRL, so the exchange rate is not optional — see
// formatMicrosAsBrl.
