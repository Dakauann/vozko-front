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

/**
 * How a seeded demonstration campaign's list divides up.
 *
 * Mirrors `SeededOutcome.Statuses` in the Go domain, which is the authority:
 * CUMULATIVE integer division, so the rounding happens in one place and shares
 * that add up to 100 settle the whole list exactly. Flooring each bucket on its
 * own leaves up to two entries over — 40% and 60% of three targets floors to
 * one and one — and the preview would then promise a split the server does not
 * produce.
 *
 * It exists so the create form can show the operator the three real numbers
 * instead of two percentages they have to multiply in their head, and it is
 * here rather than inline in that form because a rule that is spelled twice is
 * a rule that drifts.
 */
export function seededOutcomeCounts(
    total: number,
    respondedPercent: number,
    failedPercent: number,
): { responded: number; failed: number; pending: number } {
    const clamp = (v: number) => Math.min(100, Math.max(0, Math.floor(v) || 0));
    const respondedShare = clamp(respondedPercent);
    const failedShare = clamp(failedPercent);

    const responded = Math.floor((total * respondedShare) / 100);
    const settled = Math.floor((total * clamp(respondedShare + failedShare)) / 100);
    return {
        responded,
        failed: settled - responded,
        pending: Math.max(0, total - settled),
    };
}
