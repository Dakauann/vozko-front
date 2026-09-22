import type {
    AnalysisListParams,
    AnalysisListResponse,
    EntryConversationResponse,
    Lead,
    LeadAnalysis,
    LeadCampaignAnalysisResponse,
    LeadCampaignEntriesResponse,
    LeadConversationsResponse,
    LeadDetailResponse,
    ConversationEntryType,
    LeadEntryType,
    LeadFacets,
    LeadListItem,
    LeadSortKey,
    LeadResponse,
    LeadsListMeta,
    LeadsQueryParams,
    OldLeadsListParams,
} from '@/lib/leads/types';

import { emptyCrmFilter, encodeFilterParam } from '@/lib/crm/board';
import { withText } from '@/lib/filters/controls';

import { apiClient } from "@/lib/api/browser-client";
import type { LeadImportRow } from '@/lib/leads/import';

const DEFAULT_LEADS_META: LeadsListMeta = {
    page: 1,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
};

export async function listLeadsAction(params: OldLeadsListParams = {}) {
    let filter = emptyCrmFilter;
    if (params.number) filter = withText(filter, 'number', params.number);
    if (params.name) filter = withText(filter, 'name', params.name);

    const result = await listLeadsQueryAction({
        filter,
        sorts: params.sort
            ? [{ key: params.sort as LeadSortKey, direction: params.order ?? 'desc' }]
            : undefined,
        page: params.page,
        pageSize: params.pageSize,
    });

    return {
        leads: result.items as Lead[],
        meta: result.meta,
        error: result.error,
    };
}

export interface BlockLeadResult {
    blocked: boolean;
    metaApplied: boolean;
    error: string | null;
}

export async function blockLeadAction(
    leadId: string,
    block: boolean,
    businessPhoneId?: string
): Promise<BlockLeadResult> {
    const response = await apiClient<{
        success: boolean;
        data: { leadId: string; blocked: boolean; metaApplied: boolean };
    }>(`/leads/${leadId}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            blocked: block,
            ...(businessPhoneId ? { businessPhoneId } : {}),
        }),
    });

    if (response.error) {
        return { blocked: !block, metaApplied: false, error: response.error.message };
    }

    return {
        blocked: response.data?.data?.blocked ?? block,
        metaApplied: response.data?.data?.metaApplied ?? false,
        error: null,
    };
}

export async function getLeadByIdAction(
    leadId: string,
    entryType?: LeadEntryType
) {
    const queryParams = new URLSearchParams();
    if (entryType) queryParams.set('entryType', entryType);

    const queryString = queryParams.toString();
    const url = `/leads/${leadId}${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<LeadResponse>(url, {
        method: 'GET',
    });

    if (response.error) {
        return { lead: null, error: response.error.message };
    }

    return { lead: response.data?.data ?? null, error: null };
}

export async function searchLeadByNumberAction(
    phoneNumber: string,
    entryType?: LeadEntryType
) {
    const queryParams = new URLSearchParams();
    queryParams.set('number', phoneNumber);
    if (entryType) queryParams.set('entryType', entryType);

    const url = `/leads/search?${queryParams.toString()}`;

    const response = await apiClient<LeadResponse>(url, {
        method: 'GET',
    });

    if (response.error) {
        return { lead: null, error: response.error.message };
    }

    return { lead: response.data?.data ?? null, error: null };
}

export async function getLeadConversationsAction(
    leadId: string,
    entryType?: LeadEntryType
) {
    const queryParams = new URLSearchParams();
    if (entryType) queryParams.set('entryType', entryType);

    const queryString = queryParams.toString();
    const url = `/leads/${leadId}/conversations${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<LeadConversationsResponse>(url, {
        method: 'GET',
    });

    if (response.error) {
        return { conversations: null, error: response.error.message };
    }

    return { conversations: response.data?.data ?? null, error: null };
}

export async function getLeadCampaignEntriesAction(
    leadId: string,
    campaignId: string,
    entryType?: LeadEntryType
) {
    const queryParams = new URLSearchParams();
    if (entryType) queryParams.set('entryType', entryType);

    const queryString = queryParams.toString();
    const url = `/leads/${leadId}/campaigns/${campaignId}/entries${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<LeadCampaignEntriesResponse>(url, {
        method: 'GET',
    });

    if (response.error) {
        return { entries: [], error: response.error.message };
    }

    return { entries: response.data?.data?.entries ?? [], error: null };
}

export async function getLeadCampaignAnalysisAction(
    leadId: string,
    campaignId: string,
    entryType?: LeadEntryType
) {
    const queryParams = new URLSearchParams();
    if (entryType) queryParams.set('entryType', entryType);

    const queryString = queryParams.toString();
    const url = `/leads/${leadId}/campaigns/${campaignId}/analysis${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<LeadCampaignAnalysisResponse>(url, {
        method: 'GET',
    });

    if (response.error) {
        return { analysis: null, error: response.error.message };
    }

    return { analysis: response.data?.data ?? null, error: null };
}

export async function listAnalysisAction(params: AnalysisListParams = {}) {
    const queryParams = new URLSearchParams();
    if (params.campaignId) queryParams.set('campaignId', params.campaignId);
    if (params.whatsappCampaignId) queryParams.set('whatsappCampaignId', params.whatsappCampaignId);
    if (params.leadId) queryParams.set('leadId', params.leadId);
    if (params.entryType) queryParams.set('entryType', params.entryType);
    if (params.interest) queryParams.set('interest', params.interest);
    if (params.disposition) queryParams.set('disposition', params.disposition);
    if (params.sentiment) queryParams.set('sentiment', params.sentiment);
    if (params.qualification) queryParams.set('qualification', params.qualification);
    if (params.nextAction) queryParams.set('nextAction', params.nextAction);
    if (params.attendanceQualityMin !== undefined) {
        queryParams.set('attendanceQualityMin', params.attendanceQualityMin.toString());
    }
    if (params.attendanceQualityMax !== undefined) {
        queryParams.set('attendanceQualityMax', params.attendanceQualityMax.toString());
    }
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString());
    if (params.sort) queryParams.set('sort', params.sort);
    if (params.order) queryParams.set('order', params.order);

    const queryString = queryParams.toString();
    const url = `/analysis${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<AnalysisListResponse>(url, {
        method: 'GET',
    });

    if (response.error) {
        return {
            analyses: [] as LeadAnalysis[],
            meta: DEFAULT_LEADS_META,
            error: response.error.message,
        };
    }

    const data = response.data?.data;

    return {
        analyses: data?.items ?? [],
        meta: {
            page: data?.page ?? 1,
            pageSize: data?.pageSize ?? 20,
            totalPages: data?.totalPages ?? 1,
            totalItems: data?.totalItems ?? 0,
        },
        error: null,
    };
}

export async function getEntryConversationAction(
    entryId: string,
    entryType: ConversationEntryType = 'voice',
) {
    const queryParams = new URLSearchParams();
    queryParams.set('entryType', entryType);

    const url = `/entries/${entryId}/conversation?${queryParams.toString()}`;

    const response = await apiClient<EntryConversationResponse>(url, {
        method: 'GET',
    });

    if (response.error) {
        return { conversation: null, error: response.error.message };
    }

    return { conversation: response.data ?? null, error: null };
}

function buildLeadsQuery(params: LeadsQueryParams): string {
    const qs = new URLSearchParams();

    const filter = encodeFilterParam(params.filter);
    if (filter) qs.set('filter', filter);

    const q = params.q?.trim();
    if (q) qs.set('q', q);

    if (params.sorts?.length) {
        qs.set('sort', params.sorts.map((s) => `${s.key}:${s.direction}`).join(','));
    }
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));

    return qs.toString();
}

export interface LeadsQueryResult {
    items: LeadListItem[];
    meta: LeadsListMeta;
    error: string | null;
}

export async function listLeadsQueryAction(
    params: LeadsQueryParams = {},
): Promise<LeadsQueryResult> {
    const queryString = buildLeadsQuery(params);
    const response = await apiClient<{
        data: LeadListItem[];
        meta: LeadsListMeta;
    }>(`/leads${queryString ? `?${queryString}` : ''}`, { method: 'GET' });

    if (response.error) {
        return {
            items: [],
            meta: DEFAULT_LEADS_META,
            error: response.error.message,
        };
    }

    const payload = response.data;
    return {
        items: payload?.data ?? [],
        meta: {
            page: payload?.meta?.page ?? 1,
            pageSize: payload?.meta?.pageSize ?? DEFAULT_LEADS_META.pageSize,
            totalPages: payload?.meta?.totalPages ?? 1,
            totalItems: payload?.meta?.totalItems ?? 0,
        },
        error: null,
    };
}

const EMPTY_LEAD_FACETS: LeadFacets = {
    total: 0,
    blocked: 0,
    active: 0,
    windowOpen: 0,
    windowClosed: 0,
    withCampaign: 0,
    withoutCampaign: 0,
    withMemory: 0,
    withoutMemory: 0,
    named: 0,
    unnamed: 0,
    memoryCategories: {},
    channels: {},
    campaignStatuses: {},
};

export async function getLeadFacetsAction(
    params: LeadsQueryParams = {},
): Promise<{ facets: LeadFacets; error: string | null }> {
    const queryString = buildLeadsQuery({ filter: params.filter, q: params.q });
    const response = await apiClient<LeadFacets>(
        `/leads/facets${queryString ? `?${queryString}` : ''}`,
        { method: 'GET' },
    );

    if (response.error) {
        return { facets: EMPTY_LEAD_FACETS, error: response.error.message };
    }
    return { facets: response.data ?? EMPTY_LEAD_FACETS, error: null };
}

export async function getLeadCampaignHistoryAction(leadId: string) {
    const response = await apiClient<LeadDetailResponse['data']>(`/leads/${leadId}/campaigns`, {
        method: 'GET',
    });

    if (response.error) {
        return { lead: null, error: response.error.message };
    }

    return { lead: response.data ?? null, error: null };
}

export async function renameLeadAction(
    leadId: string,
    name: string,
): Promise<{ lead: Lead | null; error: string | null }> {
    const response = await apiClient<Lead>(`/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });

    if (response.error) {
        return { lead: null, error: response.error.message };
    }
    return { lead: response.data ?? null, error: null };
}

export interface LeadImportResult {
    created: number;
    matched: number;
    blocked: number;
    invalid: number;
    duplicate: number;
    rejected: { line: number; number: string; reason: string }[];
    rejectedTruncated?: number;
    inboxSeedQueued?: number;
    inboxSeedError?: string;
    scriptedSeedQueued?: number;
    scriptedSeedError?: string;
}

export interface LeadImportSeedConversations {
    bodies: string[];
    maxMessages: number;
    context?: string;
    attachment?: LeadImportSeedAttachment;
}

export interface LeadImportSeedAttachment {
    mediaId: string;
    kind: string;
}

export const LEAD_IMPORT_MAX_ROWS = 100000;

export async function importLeadsAction(
    rows: LeadImportRow[],
    onExisting: 'fill_empty' | 'skip' = 'fill_empty',
    seedInbox = false,
    seedConversations?: LeadImportSeedConversations,
): Promise<{ result: LeadImportResult | null; error: string | null }> {
    if (rows.length === 0) {
        return { result: null, error: null };
    }

    const response = await apiClient<LeadImportResult>('/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            rows,
            onExisting,
            seedInbox,
            ...(seedInbox && seedConversations ? { seedConversations } : {}),
        }),
    });

    if (response.error) {
        return { result: null, error: response.error.message };
    }

    return { result: response.data ?? null, error: null };
}
