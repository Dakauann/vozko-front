import { apiClient } from "@/lib/api/browser-client";
import type {
    OutreachError,
    SendQuote,
    StartOfficialConversationPayload,
    StartedOfficialConversation,
} from "@/lib/whatsapp-outreach/types";

/**
 * Cold outbound on the official WhatsApp channel.
 *
 * The idempotency key is a required argument rather than something minted here:
 * this call spends the workspace's balance, and a key generated inside the
 * function would be new on every retry — which is precisely the case it exists
 * to protect against. The caller owns the key because only the caller knows
 * which attempts are the same attempt.
 */
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
                // A window that is already open answers with the conversation to
                // open instead, so the refusal can become a redirect.
                entryId: response.data?.entryId,
                entryType: response.data?.entryType,
            },
        };
    }

    return { conversation: response.data ?? null, error: null };
}

/**
 * What a send will cost, before the operator commits to it.
 *
 * Deliberately a separate call rather than a field on the template: the price
 * depends on the workspace's plan and on the template's category, and quoting it
 * from anything other than the code that performs the charge is how a UI ends up
 * promising one number and billing another.
 */
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
