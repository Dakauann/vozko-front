export const EMAIL_FORWARD_SKIPPED = "email_forward_skipped";

export const EMAIL_FORWARD_SKIP_REASONS = ["balance_insufficient", "send_failed"] as const;

type EmailForwardSkipReason = (typeof EMAIL_FORWARD_SKIP_REASONS)[number];

export type EmailForwardSkippedKey = `emailForwardSkipped.${EmailForwardSkipReason | "other"}`;

function isSkipReason(value: string | undefined): value is EmailForwardSkipReason {
  return (EMAIL_FORWARD_SKIP_REASONS as readonly string[]).includes(value ?? "");
}

export function emailForwardSkippedKey(details: Record<string, string>): EmailForwardSkippedKey {
  const reason = details.reason;
  return isSkipReason(reason) ? `emailForwardSkipped.${reason}` : "emailForwardSkipped.other";
}
