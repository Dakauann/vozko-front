import type { WhatsAppCampaignPhoneStatus } from "./types";

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
