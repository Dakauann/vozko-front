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
  "transferred",
  "caller_hung_up",
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
  "lead_not_dialable",
  "lead_blocked",
  "number_required",
  "call_service_offline",
  "call_list_item_unavailable",
  "microphone_unsupported",
  "microphone_denied",
  "microphone_not_found",
  "microphone_busy",
  "microphone_failed",
  "call_audio_unsupported",
] as const;

export type DialerErrorCode = (typeof DIALER_ERROR_CODES)[number];

export function dialerErrorCode(code: string | null): DialerErrorCode | null {
  return (DIALER_ERROR_CODES as readonly string[]).includes(code ?? "") ? (code as DialerErrorCode) : null;
}

export type MicrophoneErrorCode = Extract<DialerErrorCode, `microphone_${string}` | "call_audio_unsupported">;

const MICROPHONE_FAILURES = new Map<string, MicrophoneErrorCode>([
  ["NotAllowedError", "microphone_denied"],
  ["PermissionDeniedError", "microphone_denied"],
  ["SecurityError", "microphone_denied"],
  ["NotFoundError", "microphone_not_found"],
  ["DevicesNotFoundError", "microphone_not_found"],
  ["OverconstrainedError", "microphone_not_found"],
  ["NotReadableError", "microphone_busy"],
  ["TrackStartError", "microphone_busy"],
  ["AbortError", "microphone_busy"],
  ["NotSupportedError", "call_audio_unsupported"],
]);

export function microphoneErrorCode(failure: unknown): MicrophoneErrorCode {
  const name = failure && typeof failure === "object" && "name" in failure ? String(failure.name) : "";
  return MICROPHONE_FAILURES.get(name) ?? "microphone_failed";
}
