/**
 * WhatsApp delivery failures, translated into something an operator can act on.
 *
 * "Failed" on its own is unactionable, and the codes are the only thing that
 * separates a problem the operator can fix from one only an admin can. A number
 * that is not on WhatsApp means retype it; a billing hold on the business
 * account means stop trying and tell someone. Showing the same shrug for both
 * costs a support ticket every time.
 *
 * Codes are Meta's. Unmapped ones fall back to the provider's own message, which
 * is English but true — better than inventing a friendlier sentence that might
 * describe a different failure.
 */
export interface DeliveryError {
    code?: number;
    message?: string;
}

/** i18n key suffix for a code, under `crmConversation.deliveryError`. */
export function deliveryErrorKey(code: number | undefined): string | null {
    switch (code) {
        case 131026:
            return "notOnWhatsApp";
        case 131042:
            return "billingIssue";
        case 131047:
            return "windowClosed";
        case 131049:
            return "qualityLimit";
        case 131050:
            return "userStoppedMarketing";
        case 132000:
        case 132001:
        case 132005:
        case 132007:
        case 132012:
        case 132015:
            return "templateProblem";
        case 130472:
            return "experimentHoldout";
        default:
            return null;
    }
}

/** Reads the failure the webhook stored on the message metadata. */
export function deliveryErrorFrom(metadata: unknown): DeliveryError | null {
    if (!metadata || typeof metadata !== "object") return null;
    const raw = (metadata as Record<string, unknown>).delivery_error;
    if (!raw || typeof raw !== "object") return null;
    const { code, message } = raw as { code?: unknown; message?: unknown };
    const parsedCode = typeof code === "number" && code > 0 ? code : undefined;
    const parsedMessage = typeof message === "string" && message.trim() ? message.trim() : undefined;
    if (!parsedCode && !parsedMessage) return null;
    return { code: parsedCode, message: parsedMessage };
}
