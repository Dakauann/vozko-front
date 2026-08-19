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

const DEFAULT_LEADS_META: LeadsListMeta = {
    page: 1,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
};

export async function listLeadsAction(params: OldLeadsListParams = {}) {
    // The flat legacy shape, expressed as the same structured query the leads
    // page sends. One request builder and one response reader means `name=` can
    // never come to mean two different things — and the hand-rolled reader this
    // replaced had been unwrapping a `data.items` envelope the paginated
    // endpoint stopped sending, so every caller silently got an empty list.
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
    /** Whether the contact was also blocked/unblocked on WhatsApp via Meta. */
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
    entryType: LeadEntryType = 'voice',
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

/**
 * Serializes the advanced read query.
 *
 * One builder for both endpoints: the list and its facet counts MUST be asked
 * the same question, or the count beside a filter option describes a different
 * set than the rows below it.
 */
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

/**
 * The leads list, filtered by a structured crmfilter expression.
 *
 * Supersedes listLeadsV2Action's flat parameters; both hit the same endpoint,
 * which translates either shape into the same predicates server-side.
 */
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

/**
 * Counts for the current filter. Failure degrades to zeroed buckets rather than
 * an error: the rows are what the operator asked for, and a missing badge is a
 * smaller problem than an error page over a working list.
 */
export async function getLeadFacetsAction(
    params: LeadsQueryParams = {},
): Promise<{ facets: LeadFacets; error: string | null }> {
    // Paging is irrelevant to an aggregate, and sending it would suggest
    // otherwise to anyone reading the request log.
    const queryString = buildLeadsQuery({ filter: params.filter, q: params.q });
    // The facets endpoint writes the aggregate object itself; only the paginated
    // list endpoint wraps its payload in { data, meta }.
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
