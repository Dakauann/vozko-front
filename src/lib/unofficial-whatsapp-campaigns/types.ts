/**
 * Unofficial WhatsApp campaign types.
 *
 * These mirror `delivery/http/unofficial_whatsapp/campaign_dto.go`. They are
 * deliberately parallel to the official campaign's shapes so one set of
 * components renders both, with the three differences that ARE the product
 * difference:
 *
 *  - a **message spec** where the official campaign carries a `templateId`;
 *  - **pacing and cap** fields the Cloud API has no use for;
 *  - **nothing about money**. Meta charges nothing for a linked-device send, so
 *    no price, category or balance appears anywhere on this channel.
 */

import type { CampaignMetrics, CampaignStatus } from "@/lib/campaigns/metrics";

export type { CampaignMetrics, CampaignStatus };

/** The send statuses this channel can produce. */
export type UnofficialWhatsAppCampaignEntryStatus =
    | "PENDING"
    | "SENT"
    | "DELIVERED"
    | "READ"
    | "FAILED"
    | "NOT_ELIGIBLE_POSSIBLE_SPAM"
    | "SKIPPED_NOT_ON_WHATSAPP";

/**
 * What one campaign sends. Maps 1:1 onto the channel's three send surfaces, so
 * a kind can never be picked that the backend has no way to deliver.
 */
export type UnofficialWhatsAppMessageKind =
    | "text"
    | "image"
    | "video"
    | "audio"
    | "document"
    | "menu";

export interface UnofficialWhatsAppMenuOption {
    /** Workflows branch on the id, never the label. */
    id: string;
    title: string;
    description?: string;
}

export interface UnofficialWhatsAppMessageSpec {
    kind: UnofficialWhatsAppMessageKind;
    /**
     * A LIST, and that is a ban-avoidance control rather than a convenience:
     * identical bodies leaving one number at volume are what WhatsApp's spam
     * heuristics weight, and this channel has no template to hide behind. One
     * variant is picked per recipient, deterministically, so a resumed campaign
     * never sends the same person two different messages.
     */
    bodies: string[];
    mediaId?: string;
    fileName?: string;
    /** Menu only. */
    style?: "buttons" | "list";
    footer?: string;
    button?: string;
    options?: UnofficialWhatsAppMenuOption[];
}

export interface UnofficialWhatsAppCampaign {
    id: string;
    workspaceId: string;
    departmentId?: string | null;
    instanceId: string;

    name: string;
    message: UnofficialWhatsAppMessageSpec;

    /**
     * The number's identity and live state, resolved server-side.
     *
     * `instanceSessionLive` is precomputed for the same reason the instance
     * types.ts gives: the UI must never re-derive "connected" from a status
     * string, or the Start button and the send path disagree.
     */
    instanceLabel?: string;
    instanceStatus?: string;
    instanceSessionLive: boolean;

    agentId?: string | null;
    workflowId?: string | null;
    pipelineId?: string | null;
    enableAgentResponses: boolean;
    enableWorkflow: boolean;
    enableAnalysis: boolean;
    enableAutoStaging: boolean;
    enableAutoMemory: boolean;
    preferAudio: boolean;
    aiModel?: string;

    /** Pacing, copied from the number at creation and never faster than it. */
    sendDelayMinMs: number;
    sendDelayMaxMs: number;
    /** 0 means "no campaign limit" — the number's own cap still applies. */
    dailyCap: number;

    status: CampaignStatus;
    /**
     * Why the SYSTEM paused this campaign. Without it an automatic pause looks
     * identical to a manual one, and an operator restarts straight back into
     * whatever stopped it.
     */
    statusReason?: string;

    scheduledStart?: string | null;
    archived: boolean;

    metrics?: CampaignMetrics;
    createdAt: string;
    updatedAt: string;
}

export interface UnofficialWhatsAppCampaignTarget {
    number: string;
    name?: string;
    variables?: string[];
    metadata?: Record<string, string | number | boolean | null>;
}

export interface UnofficialWhatsAppCampaignPayload {
    name: string;
    instanceId: string;
    message: UnofficialWhatsAppMessageSpec;

    agentId?: string | null;
    workflowId?: string | null;
    pipelineId?: string | null;
    enableAgentResponses: boolean;
    enableWorkflow: boolean;
    enableAnalysis: boolean;
    enableAutoStaging: boolean;
    enableAutoMemory: boolean;
    preferAudio: boolean;
    aiModel?: string;

    sendDelayMinMs?: number;
    sendDelayMaxMs?: number;
    dailyCap?: number;

    scheduledStart?: string | null;
    archived?: boolean;
    targets?: UnofficialWhatsAppCampaignTarget[];
}

export interface UnofficialWhatsAppCampaignEntry {
    id: string;
    campaignId: string;
    leadId: string;
    number: string;
    name?: string;
    /** Empty until the campaign has actually reached this person. */
    conversationId?: string;
    status: UnofficialWhatsAppCampaignEntryStatus;
    /** Which body this person received, for a campaign running rotations. */
    variantIndex: number;
    errorCode?: number;
    errorMessage?: string;
    variables?: string[];
    metadata?: Record<string, string | number | boolean | null>;
    conversationStatus?: string;
    automationEnabled?: boolean | null;
    lastMessageAt?: string | null;
    sentAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface UnofficialWhatsAppCampaignListMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

/** What the optional pre-flight list clean found. */
export interface ValidateTargetsResult {
    campaignId: string;
    checked: number;
    onWhatsApp: number;
    skipped: number;
}

export interface QuickSendResult {
    campaignId: string;
    status: string;
    addedCount: number;
    duplicatesSkipped: number;
    dispatchedCount: number;
}

export interface AddEntriesResult {
    addedCount: number;
    duplicatesSkipped: number;
    invalidSkipped: number;
}
