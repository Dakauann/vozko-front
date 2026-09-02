import type { CrmFilter as LeadFilter } from '@/lib/crm/board';

export type LeadEntryType = 'voice' | 'whatsapp';

/**
 * The entry types a conversation can be OPENED for.
 *
 * Wider than LeadEntryType on purpose. A lead lookup is keyed on the two
 * channels whose entries are lead-shaped, while reading a transcript is
 * channel-neutral — every messaging channel stores its messages against
 * (entry_id, entry_type). Widening LeadEntryType instead would have let a lead
 * query be called with a channel it cannot answer for.
 */
export type ConversationEntryType =
    | LeadEntryType
    | 'instagram'
    | 'telegram'
    | 'unofficial_whatsapp';

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
    profilePictureUrl?: string | null;
    age?: number | null;
    blocked: boolean;
    blockedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    whatsappCampaigns: number;
    totalCampaigns: number;
    lastActivityAt?: string | null;
    whatsappWindowOpen: boolean;
    windowExpiresAt?: string | null;
    /** Active memories about this lead, and when we last learned something. */
    memories: number;
    lastMemoryAt?: string | null;
}

/**
 * Aggregate counts over the SAME filtered set the list returns (GET
 * /leads/facets). They back the counts next to each filter option, so a badge
 * always means "how many of the leads you are currently looking at", never "how
 * many are on this page".
 */
export interface LeadFacets {
    total: number;
    blocked: number;
    active: number;
    windowOpen: number;
    windowClosed: number;
    withCampaign: number;
    withoutCampaign: number;
    withMemory: number;
    withoutMemory: number;
    named: number;
    unnamed: number;
    memoryCategories: Record<string, number>;
    channels: Record<string, number>;
    campaignStatuses: Record<string, number>;
}

/** Sort keys accepted by GET /leads, mirroring domain/lead.SortKey. */
export const LEAD_SORT_KEYS = [
    'createdAt',
    'updatedAt',
    'lastActivityAt',
    'name',
    'number',
    'age',
    'campaigns',
    'memories',
    'lastMemoryAt',
] as const;

export type LeadSortKey = (typeof LEAD_SORT_KEYS)[number];
export type LeadSortDirection = 'asc' | 'desc';

export interface LeadSort {
    key: LeadSortKey;
    direction: LeadSortDirection;
}

/** Page sizes offered by the list footer. */
export const LEAD_PAGE_SIZES = [20, 50, 100, 200] as const;

export interface OldLeadsListParams {
    number?: string;
    name?: string;
    entryType?: LeadEntryType;
    page?: number;
    pageSize?: number;
    sort?: 'name' | 'number' | 'createdAt';
    order?: 'asc' | 'desc';
}

/**
 * The advanced read query: a structured crmfilter expression plus sorting and
 * paging. `filter` is serialized into the same base64 `filter` parameter the
 * CRM board uses; `q` stays a plain parameter because a search box is not a
 * predicate the operator built, it is one we build for them.
 */
export interface LeadsQueryParams {
    filter?: LeadFilter;
    q?: string;
    sorts?: LeadSort[];
    page?: number;
    pageSize?: number;
}

export interface LeadsListMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
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
