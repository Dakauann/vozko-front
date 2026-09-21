import type { TemplateComponent } from "@/lib/whatsapp-templates/types";

export interface StartOfficialConversationPayload {
    businessPhoneId: string;
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
    replayed: boolean;
    chargedMicros: number;
    recorded: boolean;
}

export interface SendQuote {
    category: string;
    priceMicros: number;
    balanceMicros: number;
    affordable: boolean;
}

export interface OutreachError {
    code: string;
    message: string;
    entryId?: string;
    entryType?: string;
}

export interface TemplateStarter {
    id: string;
    suggestedName: string;
    bodyKey: string;
    variableCount: number;
}

export const UTILITY_STARTERS: TemplateStarter[] = [
    { id: "followUp", suggestedName: "retomada_atendimento", bodyKey: "create.starters.followUp.body", variableCount: 1 },
    { id: "confirmation", suggestedName: "confirmacao_agendamento", bodyKey: "create.starters.confirmation.body", variableCount: 2 },
    { id: "update", suggestedName: "atualizacao_solicitacao", bodyKey: "create.starters.update.body", variableCount: 2 },
    { id: "documentReady", suggestedName: "documento_disponivel", bodyKey: "create.starters.documentReady.body", variableCount: 1 },
];

export function starterComponents(bodyText: string, examples: string[]): TemplateComponent[] {
    return [
        {
            type: "BODY",
            text: bodyText,
            example: examples.length > 0 ? { body_text: [examples] } : undefined,
        },
    ];
}

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

