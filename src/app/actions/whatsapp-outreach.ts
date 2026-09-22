import { apiClient } from "@/lib/api/browser-client";
import type {
    OutreachError,
    SendQuote,
    StartOfficialConversationPayload,
    StartedOfficialConversation,
} from "@/lib/whatsapp-outreach/types";

export async function startOfficialConversationAction(
    payload: StartOfficialConversationPayload,
    idempotencyKey: string,
): Promise<{ conversation: StartedOfficialConversation | null; error: OutreachError | null }> {
    const response = await apiClient<StartedOfficialConversation & { entryId?: string; entryType?: string }>(
        "/whatsapp/outreach/conversations",
        {
            method: "POST",
            headers: { "Idempotency-Key": idempotencyKey },
            body: JSON.stringify(payload),
        },
    );

    if (response.error) {
        return {
            conversation: null,
            error: {
                code: response.error.code ?? "send_failed",
                message: response.error.message,
                entryId: response.data?.entryId,
                entryType: response.data?.entryType,
            },
        };
    }

    return { conversation: response.data ?? null, error: null };
}

export async function quoteTemplateSendAction(
    templateId: string,
    businessPhoneId: string,
): Promise<{ quote: SendQuote | null; error: string | null }> {
    const params = new URLSearchParams({ templateId });
    if (businessPhoneId) params.set("businessPhoneId", businessPhoneId);

    const response = await apiClient<SendQuote>(`/whatsapp/outreach/quote?${params.toString()}`, {
        method: "GET",
    });

    if (response.error) {
        return { quote: null, error: response.error.message };
    }
    return { quote: response.data ?? null, error: null };
}
