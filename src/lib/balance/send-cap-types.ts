export type SendCapLevel = "ok" | "near" | "reached";

export interface SendCapItem {
    workspaceId: string;
    workspaceName: string;
    limit: number;
    used: number;
    remaining: number;
    level: SendCapLevel;
    cycleDay: number;
    cycleStart: string;
    renewsAt: string;
    updatedBy: string;
    updatedAt: string;
    unlockedBy?: string;
    unlockedAt?: string;
}

export interface SendCapListing {
    canUnlock: boolean;
    items: SendCapItem[];
}

export interface SendCapChange {
    workspaceId: string;
    limit: number | null;
    cycleDay: number | null;
}

export type SendCapUnlockTarget =
    | { kind: "raise"; limit: number; cycleDay: number }
    | { kind: "remove" };

export interface SendCapActionError {
    message: string;
    code?: string;
}

export const SEND_CAP_CODE_LENGTH = 4;

export function isCompleteSendCapCode(code: string): boolean {
    return new RegExp(`^\\d{${SEND_CAP_CODE_LENGTH}}$`).test(code);
}

export function parseSendCapLimit(raw: string): number | null {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const value = Number(trimmed);
    return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function sendCapUsageRatio(item: Pick<SendCapItem, "used" | "limit">): number {
    if (item.limit <= 0) return 1;
    return Math.min(1, Math.max(0, item.used / item.limit));
}

export const SEND_CAP_DEFAULT_CYCLE_DAY = 1;

export function parseSendCapCycleDay(raw: string): number | null {
    const trimmed = raw.trim();
    if (!/^\d{1,2}$/.test(trimmed)) return null;
    const day = Number(trimmed);
    return day >= 1 && day <= 31 ? day : null;
}
