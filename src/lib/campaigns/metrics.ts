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

export const EMPTY_CAMPAIGN_METRICS: CampaignMetrics = {
    totalNumbers: 0,
    pending: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    notEligiblePossibleSpam: 0,
    processed: 0,
    dispatches: 0,
    completionRate: 0,
    successRate: 0,
};
