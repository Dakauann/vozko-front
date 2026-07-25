export type WhatsAppCampaignType = "standard" | "organic";

export type WhatsAppCampaignStatus = "STOPPED" | "RUNNING" | "PAUSED" | "COMPLETED";

export type WhatsAppCampaignPhoneStatus =
    | "PENDING"
    | "SENT"
    | "DELIVERED"
    | "READ"
    | "FAILED"
    | "NOT_ELIGIBLE_POSSIBLE_SPAM";

export interface WhatsAppCampaignPhoneNumber {
    id?: string;
    number: string;
    name?: string | null;
    variables?: string[];
    metadata?: Record<string, string | number | boolean | null>;
    status?: WhatsAppCampaignPhoneStatus;
    errorCode?: number;
    errorMessage?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface WhatsAppCampaignMetrics {
    totalNumbers: number;
    pending: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    notEligiblePossibleSpam: number;
    // "Disparos": billed sends, total minus the buckets never charged for
    // (pending, failed, spam-protection skips). CURRENT entry status — a
    // campaign reset zeroes this. See StatusCounts.Dispatches on the backend.
    dispatches: number;
    completionRate: number;
    successRate: number;
    /** Volume of dispatches split by template category (no money). */
    byCategory?: {
        marketing: number;
        utility: number;
        authentication: number;
    };
}

export interface WhatsAppCampaign {
    id: string;
    name: string;
    type: WhatsAppCampaignType;
    templateId: string;
    templateName?: string;
    /** MARKETING | UTILITY | AUTHENTICATION (list enrichment). */
    templateCategory?: string;
    businessPhoneId: string;
    departmentId?: string | null;
    businessPhone?: {
        id: string;
        displayPhoneNumber: string;
        verifiedName?: string;
    };
    agentId?: string | null;
    agentName?: string;
    workflowId?: string | null;
    enableAgentResponses: boolean;
    preferAudio: boolean;
    showTemplateInCrm: boolean;
    enableAnalysis: boolean;
    enableAutoStaging: boolean;
    aiModel?: string;
    scheduledStart?: string | null;
    status: WhatsAppCampaignStatus;
    archived: boolean;
    resetCode?: string;
    // Conversation funnel this campaign routes to (empty = workspace default).
    pipelineId?: string;
    phoneNumbers?: WhatsAppCampaignPhoneNumber[];
    metrics?: WhatsAppCampaignMetrics;
    createdAt: string;
    updatedAt: string;
}

export interface WhatsAppCampaignListMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface WhatsAppCampaignListResponse {
    success: boolean;
    data?: {
        items?: WhatsAppCampaign[];
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
    };
}

export interface WhatsAppCampaignPayload {
    name: string;
    type?: WhatsAppCampaignType;
    templateId: string;
    businessPhoneId: string;
    agentId?: string | null;
    workflowId?: string | null;
    stageGroupId?: string;
    pipelineId?: string;
    enableAgentResponses: boolean;
    preferAudio: boolean;
    showTemplateInCrm: boolean;
    enableAnalysis: boolean;
    enableAutoStaging: boolean;
    aiModel?: string;
    scheduledStart?: string | null;
    phoneNumbers: Omit<WhatsAppCampaignPhoneNumber, 'id' | 'status' | 'createdAt' | 'updatedAt'>[];
}

export interface WhatsAppCampaignLifecycleResponse {
    success: boolean;
    message?: string;
}

export interface WhatsAppCampaignResetPrepareResponse {
    success: boolean;
    data?: {
        resetCode: string;
        totalNumbers: number;
        numbersToReset: number;
    };
}

export interface WhatsAppCampaignResetConfirmResponse {
    success: boolean;
    data?: {
        numbersReset: number;
    };
}

export interface WhatsAppCampaignClearHistoryPrepareResponse {
    success: boolean;
    data?: {
        campaignId: string;
        clearCode: string;
        messageCount: number;
        message: string;
    };
}

export interface WhatsAppCampaignClearHistoryConfirmResponse {
    success: boolean;
    data?: {
        campaign: {
            id: string;
            name: string;
            templateId: string;
            status: WhatsAppCampaignStatus;
        };
        deletedCount: number;
    };
}

export interface WhatsAppCampaignEntry {
    id: string;
    campaignId: string;
    leadId: string;
    status: WhatsAppCampaignPhoneStatus;
    errorCode?: number;
    errorMessage?: string;
    variables?: string[];
    createdAt: string;
    updatedAt: string;
}

export interface WhatsAppCampaignEntryWithLead {
    entry: WhatsAppCampaignEntry;
    leadId: string;
    number: string;
    name?: string | null;
    age?: number | null;
    metadata?: Record<string, string | number | boolean | null>;
    latestAnalysis?: {
        id: string;
        interest: string;
        disposition: string;
        sentiment: string;
        qualification: string;
        nextAction: string;
        attendanceQuality: number;
        summary: string;
        productInterest?: string | null;
        messageCount: number;
        createdAt: string;
    } | null;
}

export interface WhatsAppCampaignEntriesListParams {
    search?: string;
    status?: WhatsAppCampaignPhoneStatus;
    stageId?: string;
    page?: number;
    pageSize?: number;
    sort?: 'number' | 'name' | 'status' | 'createdAt' | 'updatedAt';
    order?: 'asc' | 'desc';
    interest?: 'interested' | 'not_interested' | 'undecided';
    disposition?: 'sale' | 'callback' | 'declined' | 'no_answer' | 'voicemail' | 'pending';
    sentiment?: 'positive' | 'neutral' | 'negative';
    qualification?: 'hot_lead' | 'warm_lead' | 'cold_lead';
    nextAction?: 'schedule_callback' | 'send_whatsapp' | 'close' | 'escalate' | 'continue';
    attendanceQualityMin?: number;
    attendanceQualityMax?: number;
    hasAnalysis?: boolean;
    hasToolCalls?: boolean;
    toolName?: string;
    messageType?: 'user_message' | 'ai_response' | 'tool_call' | 'tool_result' | 'audio' | 'system';
    minMessageCount?: number;
    maxMessageCount?: number;
    errorCode?: number;
}

export interface WhatsAppCampaignEntriesApiResponse {
    data: WhatsAppCampaignEntryWithLead[];
    meta: {
        page: number;
        pageSize: number;
        totalPages: number;
        totalItems: number;
    };
}
