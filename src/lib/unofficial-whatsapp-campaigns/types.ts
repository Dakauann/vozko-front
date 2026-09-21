
import type { CampaignMetrics, CampaignStatus } from "@/lib/campaigns/metrics";

export type { CampaignMetrics, CampaignStatus };

export type UnofficialWhatsAppCampaignEntryStatus =
    | "PENDING"
    | "SENT"
    | "DELIVERED"
    | "READ"
    | "FAILED"
    | "NOT_ELIGIBLE_POSSIBLE_SPAM"
    | "SKIPPED_NOT_ON_WHATSAPP";

export type UnofficialWhatsAppMessageKind =
    | "text"
    | "image"
    | "video"
    | "audio"
    | "document"
    | "menu";

export interface UnofficialWhatsAppMenuOption {
    id: string;
    title: string;
    description?: string;
}

export interface UnofficialWhatsAppMessageSpec {
    kind: UnofficialWhatsAppMessageKind;
    bodies: string[];
    mediaId?: string;
    fileName?: string;
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

    sendDelayMinMs: number;
    sendDelayMaxMs: number;
    dailyCap: number;

    status: CampaignStatus;
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

export interface UnofficialWhatsAppCampaignSeedOutcome {
    sentPercent: number;
    failedPercent: number;
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
    seedOutcome?: UnofficialWhatsAppCampaignSeedOutcome | null;
}

export interface UnofficialWhatsAppCampaignEntry {
    id: string;
    campaignId: string;
    leadId: string;
    number: string;
    name?: string;
    conversationId?: string;
    status: UnofficialWhatsAppCampaignEntryStatus;
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
