export interface DeliveryError {
    code?: number;
    message?: string;
}

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
        case 131053:
            return "mediaRejected";
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
