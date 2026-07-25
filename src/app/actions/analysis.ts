import type {
    Analysis,
    AnalysisEntryType,
    AnalysisListParams,
    AnalysisListResponse,
    AnalysisPagination,
    AnalysisSingleResponse,
    AnalysisStats,
    AnalysisStatsParams,
    AnalysisStatsResponse,
} from '@/lib/analysis/types';

import { apiClient } from "@/lib/api/browser-client";

const DEFAULT_PAGINATION: AnalysisPagination = {
    page: 1,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
};

const DEFAULT_STATS: AnalysisStats = {
    totalAnalyses: 0,
    avgAttendanceQuality: 0,
    minAttendanceQuality: 0,
    maxAttendanceQuality: 0,
    totalMessages: 0,
    avgMessagesPerAnalysis: 0,
    interestInterested: 0,
    interestNotInterested: 0,
    interestUndecided: 0,
    dispositionSale: 0,
    dispositionCallback: 0,
    dispositionDeclined: 0,
    dispositionNoAnswer: 0,
    dispositionVoicemail: 0,
    dispositionPending: 0,
    sentimentPositive: 0,
    sentimentNeutral: 0,
    sentimentNegative: 0,
    qualificationHotLead: 0,
    qualificationWarmLead: 0,
    qualificationColdLead: 0,
};

function buildQueryString(params: Record<string, string | number | undefined>): string {
    const queryParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
            queryParams.set(key, String(value));
        }
    }

    const queryString = queryParams.toString();
    return queryString ? `?${queryString}` : '';
}

export async function listAnalysesAction(params: AnalysisListParams = {}) {
    const queryString = buildQueryString({
        campaignId: params.campaignId,
        whatsappCampaignId: params.whatsappCampaignId,
        leadId: params.leadId,
        entryType: params.entryType,
        interest: params.interest,
        disposition: params.disposition,
        sentiment: params.sentiment,
        qualification: params.qualification,
        nextAction: params.nextAction,
        attendanceQualityMin: params.attendanceQualityMin,
        attendanceQualityMax: params.attendanceQualityMax,
        page: params.page,
        pageSize: params.pageSize,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
    });

    const url = `/analysis${queryString}`;

    const response = await apiClient<AnalysisListResponse>(url, {
        method: 'GET',
    });

    if (response.error) {
        return {
            analyses: [] as Analysis[],
            pagination: DEFAULT_PAGINATION,
            error: response.error.message,
        };
    }

    return {
        analyses: response.data?.data ?? [],
        pagination: response.data?.pagination ?? DEFAULT_PAGINATION,
        error: null,
    };
}

export async function getAnalysisStatsAction(params: AnalysisStatsParams = {}) {
    const queryString = buildQueryString({
        campaignId: params.campaignId,
        whatsappCampaignId: params.whatsappCampaignId,
        leadId: params.leadId,
        entryType: params.entryType,
        interest: params.interest,
        disposition: params.disposition,
        sentiment: params.sentiment,
        qualification: params.qualification,
        attendanceQualityMin: params.attendanceQualityMin,
        attendanceQualityMax: params.attendanceQualityMax,
    });

    const url = `/analysis/stats${queryString}`;

    const response = await apiClient<AnalysisStatsResponse>(url, {
        method: 'GET',
    });

    if (response.error) {
        return {
            stats: DEFAULT_STATS,
            error: response.error.message,
        };
    }

    const statsData = response.data?.data ?? response.data ?? DEFAULT_STATS;

    return {
        stats: statsData as AnalysisStats,
        error: null,
    };
}

export async function getLeadCampaignAnalysisAction(leadId: string, campaignId: string) {
    const url = `/admin/leads/${leadId}/campaigns/${campaignId}/analysis`;

    const response = await apiClient<AnalysisSingleResponse>(url, {
        method: 'GET',
    });

    if (response.error) {
        return {
            analysis: null as Analysis | null,
            error: response.error.message,
        };
    }

    return {
        analysis: response.data?.data ?? null,
        error: null,
    };
}

export async function getLeadWhatsAppCampaignAnalysisAction(leadId: string, whatsappCampaignId: string) {
    const url = `/admin/leads/${leadId}/whatsapp-campaigns/${whatsappCampaignId}/analysis`;

    const response = await apiClient<AnalysisSingleResponse>(url, {
        method: 'GET',
    });

    if (response.error) {
        return {
            analysis: null as Analysis | null,
            error: response.error.message,
        };
    }

    return {
        analysis: response.data?.data ?? null,
        error: null,
    };
}

export async function getVoiceCampaignAnalysesAction(
    campaignId: string,
    params: Omit<AnalysisListParams, 'campaignId' | 'whatsappCampaignId'> = {}
) {
    return listAnalysesAction({
        ...params,
        campaignId,
        entryType: 'voice',
    });
}

export async function getWhatsAppCampaignAnalysesAction(
    whatsappCampaignId: string,
    params: Omit<AnalysisListParams, 'campaignId' | 'whatsappCampaignId'> = {}
) {
    return listAnalysesAction({
        ...params,
        whatsappCampaignId,
        entryType: 'whatsapp',
    });
}

export async function getVoiceCampaignStatsAction(
    campaignId: string,
    params: Omit<AnalysisStatsParams, 'campaignId' | 'whatsappCampaignId'> = {}
) {
    return getAnalysisStatsAction({
        ...params,
        campaignId,
        entryType: 'voice',
    });
}

export async function getWhatsAppCampaignStatsAction(
    whatsappCampaignId: string,
    params: Omit<AnalysisStatsParams, 'campaignId' | 'whatsappCampaignId'> = {}
) {
    return getAnalysisStatsAction({
        ...params,
        whatsappCampaignId,
        entryType: 'whatsapp',
    });
}

export async function getLeadAnalysesAction(
    leadId: string,
    params: Omit<AnalysisListParams, 'leadId'> = {}
) {
    return listAnalysesAction({
        ...params,
        leadId,
    });
}

export async function getHighValueLeadsAnalysesAction(
    campaignId?: string,
    whatsappCampaignId?: string,
    minQuality: number = 80,
    params: Omit<AnalysisListParams, 'campaignId' | 'whatsappCampaignId' | 'qualification' | 'attendanceQualityMin'> = {}
) {
    return listAnalysesAction({
        ...params,
        campaignId,
        whatsappCampaignId,
        qualification: 'hot_lead',
        attendanceQualityMin: minQuality,
        sortBy: 'attendanceQuality',
        sortOrder: 'desc',
    });
}

export async function getNegativeSentimentAnalysesAction(
    campaignId?: string,
    whatsappCampaignId?: string,
    params: Omit<AnalysisListParams, 'campaignId' | 'whatsappCampaignId' | 'sentiment'> = {}
) {
    return listAnalysesAction({
        ...params,
        campaignId,
        whatsappCampaignId,
        sentiment: 'negative',
        sortBy: 'createdAt',
        sortOrder: 'desc',
    });
}

export async function getEntryAnalysisAction(entryId: string, entryType: AnalysisEntryType) {
    const url = `/analysis/entry/${entryId}?entryType=${entryType}`;

    const response = await apiClient<Analysis | null>(url, {
        method: 'GET',
    });

    if (response.error) {
        return { analysis: null as Analysis | null, error: response.error.message };
    }

    return { analysis: response.data ?? null, error: null };
}
