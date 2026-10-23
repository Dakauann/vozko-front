export const SEND_ERROR_KEYS = [
  "sendFailed",
  "unauthorized",
  "notConfigured",
  "internalError",
  "notAllowed",
  "notFound",
  "windowExpired",
  "unsupported",
  "emailBalanceInsufficient",
  "emailAttachmentBlocked",
  "emailAttachmentTooLarge",
  "mediaNotSendable",
  "emailDomainChecking",
  "emailDomainUnknown",
  "emailDisposableAddress",
  "emailNoMailDomain",
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
  email_balance_insufficient: "emailBalanceInsufficient",
  email_attachment_blocked: "emailAttachmentBlocked",
  email_attachment_too_large: "emailAttachmentTooLarge",
  media_not_sendable: "mediaNotSendable",
  email_domain_checking: "emailDomainChecking",
  email_domain_unknown: "emailDomainUnknown",
  email_disposable_address: "emailDisposableAddress",
  email_no_mail_domain: "emailNoMailDomain",
};

export function sendErrorKey(code: string | undefined): SendErrorKey {
  return (code && KEY_BY_CODE[code]) || "generic";
}
