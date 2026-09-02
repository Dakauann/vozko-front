import type { UnofficialWhatsAppCampaignEntryStatus } from "./types";

/**
 * The send statuses this channel produces, and the i18n key each is labelled by.
 *
 * Mirrors StatusSet() in the Go domain. It lives here rather than inline in the
 * one screen that needed it first, because the entry filter and the export
 * dialog have to offer the same statuses under the same names — an operator who
 * filters for "Entregues" and then exports "Entregues" is entitled to the same
 * set both times.
 */
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
    // Only this channel can produce it: only here can a number be checked
    // against WhatsApp before anything is sent.
    { value: "SKIPPED_NOT_ON_WHATSAPP", labelKey: "status.skippedNotOnWhatsApp" },
];

/**
 * The entries that actually left the platform.
 *
 * Mirrors StatusSet().Dispatched(), which derives it by REMOVING the never-sent
 * buckets rather than by listing these three — so a status added later joins the
 * set on both sides instead of being quietly dropped from exports.
 */
export const UNOFFICIAL_DISPATCHED_STATUSES: UnofficialWhatsAppCampaignEntryStatus[] = [
    "SENT",
    "DELIVERED",
    "READ",
];

/**
 * Whether a campaign in this status can be started.
 *
 * Mirrors campaign.ResolveTransition: COMPLETED accepts START because re-running
 * a finished campaign after a reset is normal, and refusing it would make reset
 * a dead end.
 */
export function canStart(status: string): boolean {
    return status !== "RUNNING";
}

export function canPause(status: string): boolean {
    return status === "RUNNING";
}

export function canStop(status: string): boolean {
    return status !== "STOPPED";
}
