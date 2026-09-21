export const ACTIVE_SUBSCRIPTION_REQUIRED_RECHARGE_ERROR =
  "active workspace subscription required to recharge balance";

const FAILED_CREATE_INVOICE_ERROR = "failed to create invoice";

export const CUSTOMER_DOCUMENT_REQUIRED_CODE = "customer_document_required";

const CUSTOMER_DOCUMENT_REQUIRED_HINTS = [
  CUSTOMER_DOCUMENT_REQUIRED_CODE,
  "cpf/cnpj obrigat",
];

export function isRechargeSubscriptionRequiredError(
  message?: string | null,
): boolean {
  if (!message) {
    return false;
  }

  return message
    .trim()
    .toLowerCase()
    .includes(ACTIVE_SUBSCRIPTION_REQUIRED_RECHARGE_ERROR);
}

export function isCustomerDocumentRequiredError(
  code?: string | null,
  message?: string | null,
): boolean {
  if (code && code.trim().toLowerCase() === CUSTOMER_DOCUMENT_REQUIRED_CODE) {
    return true;
  }
  if (!message) {
    return false;
  }
  const normalized = message.trim().toLowerCase();
  return CUSTOMER_DOCUMENT_REQUIRED_HINTS.some((hint) =>
    normalized.includes(hint),
  );
}

export function normalizeRechargeErrorMessage(
  message: string | null | undefined,
  messages: {
    subscriptionRequired: string;
    defaultMessage: string;
    documentRequired?: string;
  },
  code?: string | null,
): string {
  if (messages.documentRequired && isCustomerDocumentRequiredError(code, message)) {
    return messages.documentRequired;
  }

  if (!message) {
    return messages.defaultMessage;
  }

  const normalized = message.trim().toLowerCase();

  if (normalized.includes(ACTIVE_SUBSCRIPTION_REQUIRED_RECHARGE_ERROR)) {
    return messages.subscriptionRequired;
  }

  if (normalized === FAILED_CREATE_INVOICE_ERROR) {
    return messages.defaultMessage;
  }

  return message;
}

export function getSubscriptionStatusKey(
  status?: string | null,
): "active" | "cancelled" | "expired" | null {
  switch (status?.toLowerCase()) {
    case "active":
      return "active";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    default:
      return null;
  }
}
