/**
 * The campaign metrics shape, shared by every channel that runs campaigns.
 *
 * Mirrors `campaign.Metrics` in the Go domain. It lives here rather than beside
 * one channel's types because the summary bar, the campaign card and the detail
 * header all render it without caring which transport produced it — and because
 * two copies would disagree the first time a bucket was added.
 */
export interface CampaignMetrics {
    totalNumbers: number;
    pending: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    /** Our own cooldown refused the send. Nothing was attempted. */
    notEligiblePossibleSpam: number;
    /**
     * The number is not registered on WhatsApp.
     *
     * Unofficial channel only, and ABSENT rather than zero elsewhere: an
     * omitted field reads as "this question does not apply here", where a zero
     * would read as "we checked and none were dead". Separate from `failed` on
     * purpose — a dead number is a fact about the list, not about our sending.
     */
    skippedNotOnWhatsApp?: number;
    processed: number;
    /**
     * "Disparos": what actually left the platform. Derived subtractively from
     * the never-sent buckets, so a status added later is included automatically.
     * CURRENT entry status — a campaign reset zeroes it.
     */
    dispatches: number;
    completionRate: number;
    successRate: number;
    /** Template-category split. Official channel only; templates do not exist elsewhere. */
    byCategory?: {
        marketing: number;
        utility: number;
        authentication: number;
    };
}

/** The four campaign statuses, shared across channels. */
export type CampaignStatus = "STOPPED" | "RUNNING" | "PAUSED" | "COMPLETED";

/**
 * Every send status the platform can produce, across channels.
 *
 * A union rather than a per-channel enum, because the entries table, the export
 * dialog and the filters all render statuses without knowing the transport.
 * Which subset a channel can actually produce is declared per channel.
 */
export type CampaignSendStatus =
    | "PENDING"
    | "SENT"
    | "DELIVERED"
    | "READ"
    | "FAILED"
    | "NOT_ELIGIBLE_POSSIBLE_SPAM"
    | "SKIPPED_NOT_ON_WHATSAPP";
