import type { CrmFilter as LeadFilter } from '@/lib/crm/board';
import type { Precision } from '@/lib/maps/types';

export type LeadEntryType = 'voice' | 'whatsapp';

export type ConversationEntryType =
    | LeadEntryType
    | 'instagram'
    | 'facebook'
    | 'telegram'
    | 'unofficial_whatsapp'
    | 'webchat';

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
    version: number;
}

export interface LeadConsent {
    grantedAt: string;
    source: string;
    purpose?: string;
}

export const LEAD_PHONE_LABELS = ['mobile', 'landline', 'work', 'message', 'other'] as const;

export type LeadPhoneLabel = (typeof LEAD_PHONE_LABELS)[number];

export interface LeadContactPhone {
    id: string;
    number: string;
    label: LeadPhoneLabel;
    createdAt?: string;
}

export const LEAD_ADDRESS_LABELS = ['home', 'work', 'other'] as const;

export type LeadAddressLabel = (typeof LEAD_ADDRESS_LABELS)[number];

export type LeadGeoStatus =
    | 'pending'
    | 'located'
    | 'approximate'
    | 'not_found'
    | 'ambiguous'
    | 'unavailable'
    | 'quota_exceeded'
    | 'refused';

export interface LeadAddress {
    id: string;
    label: LeadAddressLabel;
    primary: boolean;
    zipCode?: string;
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
    cityCode?: string;
    geoStatus: LeadGeoStatus;
    geoQueued?: boolean;
    precision?: Precision;
    positionSource?: string;
    positionProvider?: string;
    geocodedAt?: string;
    latitude?: number;
    longitude?: number;
    createdAt?: string;
}

export const LEAD_FAMILY_KINDS = [
    'spouse',
    'partner',
    'parent',
    'child',
    'sibling',
    'grandparent',
    'grandchild',
    'uncle_aunt',
    'nephew_niece',
    'cousin',
    'in_law',
    'relative',
] as const;

export const LEAD_REFERRAL_KINDS = ['referred', 'referred_by'] as const;

export type LeadRelationKind = (typeof LEAD_FAMILY_KINDS)[number] | (typeof LEAD_REFERRAL_KINDS)[number];

export type LeadRelationDimension = 'family' | 'referral';

export interface LeadRelation {
    id: string;
    leadId: string;
    relativeId: string;
    kind: LeadRelationKind;
    dimension: LeadRelationDimension;
    createdAt?: string;
}

export interface LeadRelative {
    relationId: string;
    leadId: string;
    kind: LeadRelationKind;
    dimension: LeadRelationDimension;
    name?: string;
    number?: string;
    createdAt?: string;
}

export interface LeadRelativesPage {
    items: LeadRelative[];
    next?: string;
}

export type LeadDuplicateReason = 'shared_phone' | 'same_name_and_address';

export interface LeadDuplicate {
    leadId: string;
    reasons: LeadDuplicateReason[];
    name?: string;
    number?: string;
}

export const LEAD_OPT_OUT_SOURCES = ['lead_request', 'operator'] as const;

export type LeadOptOutSource = (typeof LEAD_OPT_OUT_SOURCES)[number];

export interface LeadRecord {
    id: string;
    workspaceId: string;
    number: string;
    name?: string;
    realName?: string;
    nameSource?: string;
    nickname?: string;
    email?: string;
    birthDate?: string;
    age?: number | null;
    source?: string;
    owner?: string;
    whatsappOptIn?: LeadConsent | null;
    optedOutAt?: string | null;
    optOutSource?: LeadOptOutSource;
    blocked: boolean;
    blockedAt?: string | null;
    blockedBy?: string | null;
    profilePictureUrl?: string;
    phones?: LeadContactPhone[];
    addresses?: LeadAddress[];
    customFields?: Record<string, unknown>;
    relativesCount: number;
    referredCount: number;
    version: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface CreatedLead extends LeadRecord {
    duplicates: LeadDuplicate[];
}

export interface LeadBlockOutcome {
    leadId: string;
    blocked: boolean;
    metaApplied: boolean;
    version: number;
}

export interface LeadArea {
    district?: string;
    city?: string;
    state?: string;
    cityCode?: string;
}

export interface LeadCard {
    leadId: string;
    version: number;
    name?: string;
    number?: string;
    blocked: boolean;
    owner?: string;
    ownerName?: string;
    optedOutAt?: string | null;
    optOutSource?: LeadOptOutSource;
    area?: LeadArea;
    customFields?: Record<string, unknown>;
    relativesCount: number;
    referredCount: number;
}

export interface LeadAreaInput {
    district: string;
    city: string;
    state: string;
    cityCode?: string;
}

export interface LeadAnonymizeOutcome {
    leadId: string;
    version: number;
    anonymizedAt: string;
    erased: Record<string, number>;
}

export const LEAD_FIELD = {
    name: 'name',
    number: 'number',
    profilePicture: 'profilePictureUrl',
    blocked: 'blocked',
} as const;

export interface LeadUpdateEvent {
    leadId: string;
    version: number;
    fields: string[];
}

export interface LeadsBulkUpdateEvent {
    runId: string;
}

export interface LeadListItem {
    id: string;
    workspaceId: string;
    number: string;
    name?: string | null;
    realName?: string;
    profilePictureUrl?: string | null;
    age?: number | null;
    blocked: boolean;
    blockedAt?: string | null;
    version: number;
    createdAt: string;
    updatedAt: string;
    whatsappCampaigns: number;
    totalCampaigns: number;
    lastActivityAt?: string | null;
    whatsappWindowOpen: boolean;
    windowExpiresAt?: string | null;
    memories: number;
    lastMemoryAt?: string | null;
    owner?: string;
    ownerName?: string;
    phones: LeadContactPhone[];
    primaryAddress?: LeadAddress;
    customFields?: Record<string, unknown>;
    relativesCount: number;
    referredCount: number;
}

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
    'relativesCount',
    'referredCount',
] as const;

export type LeadSortKey = (typeof LEAD_SORT_KEYS)[number];
export type LeadSortDirection = 'asc' | 'desc';

export interface LeadSort {
    key: LeadSortKey;
    direction: LeadSortDirection;
}

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

export interface LeadDetail extends LeadRecord {
    ownerName?: string;
    whatsappCampaigns: number;
    totalCampaigns: number;
    lastActivityAt?: string | null;
    whatsappWindowOpen: boolean;
    windowExpiresAt?: string | null;
    campaigns: CampaignHistoryItem[];
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
