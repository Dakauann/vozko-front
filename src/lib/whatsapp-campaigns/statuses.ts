import type { WhatsAppCampaignPhoneStatus, WhatsAppCampaignStatus } from "./types";

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

export const DISPATCHED_STATUSES: WhatsAppCampaignPhoneStatus[] = [
    "SENT",
    "DELIVERED",
    "READ",
];

export type CampaignListStatus = WhatsAppCampaignStatus | "READY";

export function campaignListStatus(campaign: { status: WhatsAppCampaignStatus; readyToStart?: boolean }): CampaignListStatus {
    return campaign.status === "STOPPED" && campaign.readyToStart === true ? "READY" : campaign.status;
}
