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
    LeadEntry,
    LeadEntryType,
    LeadListItem,
    LeadResponse,
    LeadsListMeta,
    LeadsListParams,
    LeadsListResponse,
    OldLeadsListParams,
} from '@/lib/leads/types';

import { apiClient } from "@/lib/api/browser-client";

const DEFAULT_LEADS_META: LeadsListMeta = {
    page: 1,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
};

export async function listLeadsAction(params: OldLeadsListParams = {}) {
    const queryParams = new URLSearchParams();
    if (params.number) queryParams.set('number', params.number);
    if (params.name) queryParams.set('name', params.name);
    if (params.entryType) queryParams.set('entryType', params.entryType);
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString());
    if (params.sort) queryParams.set('sort', params.sort);
    if (params.order) queryParams.set('order', params.order);

    const queryString = queryParams.toString();
    const url = `/leads${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<LeadsListResponse>(url, {
        method: 'GET',
    });

    if (response.error) {
        return {
            leads: [] as Lead[],
            meta: DEFAULT_LEADS_META,
            error: response.error.message,
        };
    }

    const data = response.data?.data;

    return {
        leads: data?.items ?? [],
        meta: {
            page: data?.page ?? 1,
            pageSize: data?.pageSize ?? 20,
            totalPages: data?.totalPages ?? 1,
            totalItems: data?.totalItems ?? 0,
        },
        error: null,
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

export async function listLeadsV2Action(params: LeadsListParams = {}) {
    const queryParams = new URLSearchParams();
    if (params.number) queryParams.set('number', params.number);
    if (params.name) queryParams.set('name', params.name);
    if (params.createdFrom) queryParams.set('createdFrom', params.createdFrom);
    if (params.createdTo) queryParams.set('createdTo', params.createdTo);
    if (params.ageFrom !== undefined) queryParams.set('ageFrom', params.ageFrom.toString());
    if (params.ageTo !== undefined) queryParams.set('ageTo', params.ageTo.toString());
    if (params.hasWhatsAppCampaign !== undefined) queryParams.set('hasWhatsAppCampaign', params.hasWhatsAppCampaign.toString());
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString());
    if (params.sort) queryParams.set('sort', params.sort);
    if (params.order) queryParams.set('order', params.order);

    const queryString = queryParams.toString();
    const url = `/leads${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<{
        data: LeadListItem[];
        meta: { page: number; pageSize: number; totalPages: number; totalItems: number };
    }>(url, { method: 'GET' });

    if (response.error) {
        return {
            items: [] as LeadListItem[],
            meta: DEFAULT_LEADS_META,
            error: response.error.message,
        };
    }

    const payload = response.data;
    return {
        items: payload?.data ?? [],
        meta: {
            page: payload?.meta?.page ?? 1,
            pageSize: payload?.meta?.pageSize ?? 20,
            totalPages: payload?.meta?.totalPages ?? 1,
            totalItems: payload?.meta?.totalItems ?? 0,
        },
        error: null,
    };
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
