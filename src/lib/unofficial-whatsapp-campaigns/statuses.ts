import type { UnofficialWhatsAppCampaignEntryStatus } from "./types";

export const UNOFFICIAL_SEND_STATUSES: {
    value: UnofficialWhatsAppCampaignEntryStatus;
    labelKey: string;
}[] = [
    { value: "PENDING", labelKey: "status.pending" },
    { value: "SENT", labelKey: "status.sent" },
    { value: "DELIVERED", labelKey: "status.delivered" },
    { value: "READ", labelKey: "status.read" },
    { value: "FAILED", labelKey: "status.failed" },
    { value: "NOT_ELIGIBLE_POSSIBLE_SPAM", labelKey: "status.notEligiblePossibleSpam" },
    { value: "SKIPPED_NOT_ON_WHATSAPP", labelKey: "status.skippedNotOnWhatsApp" },
];

export const UNOFFICIAL_DISPATCHED_STATUSES: UnofficialWhatsAppCampaignEntryStatus[] = [
    "SENT",
    "DELIVERED",
    "READ",
];

export function canStart(status: string): boolean {
    return status !== "RUNNING";
}

export function canPause(status: string): boolean {
    return status === "RUNNING";
}

export function canStop(status: string): boolean {
    return status !== "STOPPED";
}

export function seededOutcomeCounts(
    total: number,
    sentPercent: number,
    failedPercent: number,
): { sent: number; failed: number; pending: number } {
    const clamp = (v: number) => Math.min(100, Math.max(0, Math.floor(v) || 0));
    const sentShare = clamp(sentPercent);
    const failedShare = clamp(failedPercent);

    const sent = Math.floor((total * sentShare) / 100);
    const settled = Math.floor((total * clamp(sentShare + failedShare)) / 100);
    return {
        sent,
        failed: settled - sent,
        pending: Math.max(0, total - settled),
    };
}
