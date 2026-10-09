import type { WsErrorPayload } from "@/lib/conversations/types";

export const OUTREACH_REFUSAL_CODES = [
  "window_already_open",
  "send_in_progress",
  "within_spam_window",
  "insufficient_balance",
  "monthly_send_cap_reached",
  "pricing_unavailable",
  "quote_out_of_range",
  "quote_unavailable",
  "template_not_sendable",
  "template_phone_mismatch",
  "invalid_phone",
  "lead_opted_out",
  "lead_blocked",
  "forbidden",
  "phone_not_connected",
  "not_found",
  "conversation_not_found",
  "idempotency_key_required",
  "billing_unavailable",
  "send_outcome_unknown",
  "send_failed",
] as const;

export type OutreachRefusalCode = (typeof OUTREACH_REFUSAL_CODES)[number];

const KNOWN: ReadonlySet<string> = new Set(OUTREACH_REFUSAL_CODES);

export function outreachRefusalKey(
  code: string | null | undefined,
  fallback: OutreachRefusalCode = "send_failed",
): `errors.${OutreachRefusalCode}` {
  const known = code && KNOWN.has(code) ? (code as OutreachRefusalCode) : fallback;
  return `errors.${known}`;
}

export function isTemplateSendRefusal(payload: WsErrorPayload): boolean {
  return Boolean(payload.entry_id && payload.entry_type && !payload.status);
}

export function isRetryableQuoteRefusal(code: string | null | undefined): boolean {
  return outreachRefusalKey(code, "quote_unavailable") === "errors.quote_unavailable";
}
