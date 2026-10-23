import { apiClient, type ApiResult } from "@/lib/api/browser-client";
import type {
  EmailOutreachError,
  EmailOutreachQuote,
  StartEmailConversationPayload,
  StartedEmailConversation,
} from "@/lib/email-outreach/types";

function refusalOf(result: ApiResult<unknown>, fallbackCode: string): EmailOutreachError {
  if (!result.error) return { code: fallbackCode, message: "" };
  return {
    code: result.error.code ?? fallbackCode,
    message: result.error.message,
    ...(result.error.status !== undefined ? { status: result.error.status } : {}),
    ...(result.error.details ? { details: result.error.details } : {}),
  };
}

export async function startEmailConversationAction(
  payload: StartEmailConversationPayload,
): Promise<{ conversation: StartedEmailConversation | null; error: EmailOutreachError | null }> {
  const response = await apiClient<StartedEmailConversation>("/email/outreach/conversations", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (response.error || !response.data) {
    return { conversation: null, error: refusalOf(response, "email_send_failed") };
  }
  return { conversation: response.data, error: null };
}

export async function quoteEmailOutreachAction(
  signal?: AbortSignal,
): Promise<{ quote: EmailOutreachQuote | null; error: EmailOutreachError | null }> {
  const response = await apiClient<EmailOutreachQuote>("/email/outreach/quote", { method: "GET", signal });

  if (response.error || !response.data) {
    return { quote: null, error: refusalOf(response, "email_pricing_failed") };
  }
  return { quote: response.data, error: null };
}
