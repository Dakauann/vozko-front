export type LeadEntryType = 'voice' | 'whatsapp';

export type VoiceEntryStatus =
    | 'PENDING'
    | 'RINGING'
    | 'ONGOING'
    | 'RECEIVED'
    | 'ENDED'
    | 'FAILED'
    | 'DECLINED'
    | 'NOT_FOUND'
    | 'BUSY'
    | 'NO_ANSWER'
    | 'CANCELLED'
    | 'VOICEMAIL';

export type WhatsAppEntryStatus =
    | 'PENDING'
    | 'SENT'
    | 'DELIVERED'
    | 'READ'
    | 'FAILED';

export type LeadEntryStatus = VoiceEntryStatus | WhatsAppEntryStatus;

export interface LeadEntry {
    id: string;
    campaignId: string;
    entryType: LeadEntryType;
    status: LeadEntryStatus;
    createdAt: string;
    updatedAt?: string;
}

export interface Lead {
    id: string;
    workspaceId: string;
    number: string;
    name?: string | null;
    age?: number | null;
    blocked?: boolean;
    blockedAt?: string | null;
    blockedBy?: string | null;
    metadata?: Record<string, string | number | boolean | null>;
    entries?: LeadEntry[];
}

export interface LeadListItem {
    id: string;
    workspaceId: string;
    number: string;
    name?: string | null;
    age?: number | null;
    createdAt: string;
    updatedAt: string;
    whatsappCampaigns: number;
    totalCampaigns: number;
    lastActivityAt?: string | null;
    whatsappWindowOpen: boolean;
    windowExpiresAt?: string | null;
}

export interface OldLeadsListParams {
    number?: string;
    name?: string;
    entryType?: LeadEntryType;
    page?: number;
    pageSize?: number;
    sort?: 'name' | 'number' | 'createdAt';
    order?: 'asc' | 'desc';
}

export interface LeadsListParams {
    number?: string;
    name?: string;
    createdFrom?: string;
    createdTo?: string;
    ageFrom?: number;
    ageTo?: number;
    hasWhatsAppCampaign?: boolean;
    page?: number;
    pageSize?: number;
    sort?: string;
    order?: 'asc' | 'desc';
}

export interface LeadsListMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export interface LeadsListResponse {
    success: boolean;
    data: {
        items: Lead[];
        page: number;
        pageSize: number;
        totalPages: number;
        totalItems: number;
    };
    error?: string | null;
}

export interface CampaignEntryItem {
    id: string;
    status: string;
    createdAt: string;
    updatedAt?: string;
}

export interface CampaignHistoryItem {
    campaignId: string;
    campaignName: string;
    type: 'voice' | 'whatsapp';
    entries: CampaignEntryItem[];
}

export interface LeadDetailResponse {
    success: boolean;
    data: {
        id: string;
        workspaceId: string;
        number: string;
        name?: string | null;
        age?: number | null;
        createdAt: string;
        updatedAt: string;
        whatsappCampaigns: number;
        totalCampaigns: number;
        lastActivityAt?: string | null;
        whatsappWindowOpen: boolean;
        windowExpiresAt?: string | null;
        campaigns: CampaignHistoryItem[];
    };
}

export interface LeadResponse {
    success: boolean;
    data: Lead;
}

export interface ConversationMessage {
    id: string;
    entryId: string;
    entryType: LeadEntryType;
    role: 'agent' | 'user';
    content: string;
    createdAt: string;
}

export interface LeadConversationsResponse {
    success: boolean;
    data: {
        leadId: string;
        number: string;
        name?: string | null;
        messages: ConversationMessage[];
    };
}

export interface LeadCampaignEntriesResponse {
    success: boolean;
    data: {
        leadId: string;
        campaignId: string;
        entries: LeadEntry[];
    };
}

export interface LeadAnalysis {
    id: string;
    entryId: string;
    entryType: LeadEntryType;
    interest: 'none' | 'low' | 'medium' | 'high';
    productInterest?: string | null;
    disposition: string;
    sentiment: 'negative' | 'neutral' | 'positive';
    qualification: 'unqualified' | 'qualified' | 'highly_qualified';
    nextAction: 'close' | 'escalate' | 'continue' | 'followup';
    summary: string;
    attendanceQuality: number;
    messageCount: number;
    createdAt: string;
}

export interface LeadCampaignAnalysisResponse {
    success: boolean;
    data: {
        leadId: string;
        campaignId: string;
        number: string;
        name?: string | null;
        analyses: LeadAnalysis[];
    };
}

export interface AnalysisListParams {
    campaignId?: string;
    whatsappCampaignId?: string;
    leadId?: string;
    entryType?: LeadEntryType;
    interest?: 'none' | 'low' | 'medium' | 'high';
    disposition?: string;
    sentiment?: 'negative' | 'neutral' | 'positive';
    qualification?: 'unqualified' | 'qualified' | 'highly_qualified';
    nextAction?: 'close' | 'escalate' | 'continue' | 'followup';
    attendanceQualityMin?: number;
    attendanceQualityMax?: number;
    page?: number;
    pageSize?: number;
    sort?: 'createdAt' | 'attendanceQuality';
    order?: 'asc' | 'desc';
}

export interface AnalysisListResponse {
    success: boolean;
    data: {
        items: LeadAnalysis[];
        page: number;
        pageSize: number;
        totalPages: number;
        totalItems: number;
    };
}

export type EntryConversationChannel = 'voice' | 'whatsapp';
export type EntryConversationMessageType =
    | 'user_message'
    | 'ai_response'
    | 'tool_call'
    | 'tool_result'
    | 'audio'
    | 'system';

export interface EntryConversationMessage {
    id: string;
    entryId: string;
    entryType: LeadEntryType;
    channel: EntryConversationChannel;
    messageType: EntryConversationMessageType;
    from: string;
    to: string;
    text: string;
    createdAt: string;
    updatedAt: string;
}

export interface EntryConversationAnalysis {
    id: string;
    entryId: string;
    entryType: LeadEntryType;
    interest: string;
    disposition: string;
    sentiment: string;
    qualification: string;
    nextAction: string;
    summary: string;
    attendanceQuality: number;
    createdAt: string;
}

export interface EntryConversationData {
    campaignId: string;
    entryId: string;
    entryType: LeadEntryType;
    leadId: string;
    status: string;
    messageCount: number;
    messages: EntryConversationMessage[];
    latestAnalysis: EntryConversationAnalysis | null;
}

export type EntryConversationResponse = EntryConversationData;
