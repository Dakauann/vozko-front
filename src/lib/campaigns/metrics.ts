export interface CampaignMetrics {
    totalNumbers: number;
    pending: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    notEligiblePossibleSpam: number;
    skippedNotOnWhatsApp?: number;
    processed: number;
    dispatches: number;
    completionRate: number;
    successRate: number;
    byCategory?: {
        marketing: number;
        utility: number;
        authentication: number;
    };
}

export type CampaignStatus = "STOPPED" | "RUNNING" | "PAUSED" | "COMPLETED";

export type CampaignSendStatus =
    | "PENDING"
    | "SENT"
    | "DELIVERED"
    | "READ"
    | "FAILED"
    | "NOT_ELIGIBLE_POSSIBLE_SPAM"
    | "SKIPPED_NOT_ON_WHATSAPP";
