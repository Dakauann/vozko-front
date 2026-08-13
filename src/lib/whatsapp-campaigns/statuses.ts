import type { WhatsAppCampaignPhoneStatus } from "./types";

/**
 * The send statuses, and the i18n key each one is labelled by.
 *
 * Mirrors AllStatuses() in the backend domain. It lives here rather than inline
 * in the one screen that happened to need it first, because the entry filter and
 * the export dialog have to offer the same statuses under the same names — an
 * operator who filters for "Entregues" and then exports "Entregues" is entitled
 * to the same set both times.
 */
export const SEND_STATUSES: {
    value: WhatsAppCampaignPhoneStatus;
    labelKey: string;
}[] = [
    { value: "PENDING", labelKey: "status.pending" },
    { value: "SENT", labelKey: "status.sent" },
    { value: "DELIVERED", labelKey: "status.delivered" },
    { value: "READ", labelKey: "status.read" },
    { value: "FAILED", labelKey: "status.failed" },
    {
        value: "NOT_ELIGIBLE_POSSIBLE_SPAM",
        labelKey: "status.notEligiblePossibleSpam",
    },
];

/**
 * The entries that actually left the platform: what the "Envios" tile counts,
 * and what "puxar os leads enviados, entregues e lidos" means.
 *
 * Mirrors DispatchedStatuses() on the backend, which derives it by removing the
 * never-billed buckets (pending, failed, spam-protection skips) rather than by
 * listing these three — so a status added later joins the set on both sides
 * instead of being quietly dropped from exports.
 */
export const DISPATCHED_STATUSES: WhatsAppCampaignPhoneStatus[] = [
    "SENT",
    "DELIVERED",
    "READ",
];
