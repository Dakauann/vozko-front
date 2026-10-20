export const SEND_ERROR_KEYS = [
  "sendFailed",
  "unauthorized",
  "notConfigured",
  "internalError",
  "notAllowed",
  "notFound",
  "windowExpired",
  "unsupported",
  "generic",
] as const;

export type SendErrorKey = (typeof SEND_ERROR_KEYS)[number];

const KEY_BY_CODE: Record<string, SendErrorKey> = {
  send_failed: "sendFailed",
  unauthorized: "unauthorized",
  not_configured: "notConfigured",
  internal_error: "internalError",
  not_allowed: "notAllowed",
  not_found: "notFound",
  window_expired: "windowExpired",
  unsupported: "unsupported",
  failed: "sendFailed",
};

export function sendErrorKey(code: string | undefined): SendErrorKey {
  return (code && KEY_BY_CODE[code]) || "generic";
}
