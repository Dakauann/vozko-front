const MAX_DIAL_LENGTH = 32;

export const DIAL_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"] as const;

export type DialKey = (typeof DIAL_KEYS)[number] | "+";

const SEPARATORS = /[\s().-]/g;

export function isDialable(value: string): boolean {
  const compact = value.replace(SEPARATORS, "");
  return /^\+?[\d*#]+$/.test(compact) && compact.length <= MAX_DIAL_LENGTH;
}

export function appendDialKey(current: string, key: DialKey): string {
  if (key === "+" && current.length > 0) return current;
  if (current.replace(SEPARATORS, "").length >= MAX_DIAL_LENGTH) return current;
  return current + key;
}

export const CALL_OUTCOMES = [
  "ended",
  "cancelled",
  "busy",
  "no_answer",
  "declined",
  "failed",
  "insufficient_balance",
  "balance_check_error",
  "connection_lost",
] as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export function callOutcome(reason: string | undefined): CallOutcome {
  return (CALL_OUTCOMES as readonly string[]).includes(reason ?? "") ? (reason as CallOutcome) : "ended";
}

export const DIALER_ERROR_CODES = [
  "trunk_unavailable",
  "trunk_not_registered",
  "invalid_number",
  "unauthorized",
  "no_call_slots",
  "insufficient_balance",
  "already_in_call",
  "dial_failed",
] as const;

export function dialerErrorCode(code: string | null): (typeof DIALER_ERROR_CODES)[number] | null {
  return (DIALER_ERROR_CODES as readonly string[]).includes(code ?? "") ? (code as (typeof DIALER_ERROR_CODES)[number]) : null;
}
