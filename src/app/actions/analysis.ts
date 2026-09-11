import type {
    Analysis,
    AnalysisEntryType,
    AnalysisListParams,
    AnalysisPagination,
    AnalysisSingleResponse,
    AnalysisStats,
    AnalysisStatsParams,
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
        ...audienceQuery(params),
        nextAction: params.nextAction,
        page: params.page,
        pageSize: params.pageSize,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
    });

    const url = `/audience${queryString}`;

    const response = await apiClient<{ data?: AudienceRow[]; pagination?: AnalysisPagination }>(url, {
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
        analyses: (response.data?.data ?? []).map(toAnalysis),
        pagination: response.data?.pagination ?? DEFAULT_PAGINATION,
        error: null,
    };
}

export async function getAnalysisStatsAction(params: AnalysisStatsParams = {}) {
    const queryString = buildQueryString(audienceQuery(params));

    const url = `/audience/stats${queryString}`;

    const response = await apiClient<{ data?: AudienceCounters } & AudienceCounters>(url, {
        method: 'GET',
    });

    if (response.error) {
        return {
            stats: DEFAULT_STATS,
            error: response.error.message,
        };
    }

    const counters = response.data?.data ?? response.data ?? {};

    return {
        stats: toStats(counters),
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
    // One conversation, asked for as a filter on the feed rather than through a
    // dedicated endpoint. The engine keys a conversation uniquely, so there is
    // at most one row and no need to sort by time to pick a winner.
    const queryString = buildQueryString({
        subjectKind: "conversation",
        source: entryType,
        subjectId: entryId,
        pageSize: 1,
    });

    const response = await apiClient<{ data?: AudienceRow[] }>(`/audience${queryString}`, {
        method: "GET",
    });

    if (response.error) {
        return { analysis: null as Analysis | null, error: response.error.message };
    }

    const [row] = response.data?.data ?? [];
    return { analysis: row ? toAnalysis(row) : null, error: null };
}

// ---- The audience API ----
//
// Conversation analyses moved into the unified analysis engine, which serves
// them from /audience alongside comments. This file keeps the shapes its two
// callers already speak and adapts at the boundary, so the migration is one
// file rather than every screen that shows a verdict.
//
// The vocabulary changed with the engine: a channel is a `source`, a campaign
// is a `containerId`, and a conversation is one `subjectKind` among others.

/** The engine's row shape, as served by /audience. */
interface AudienceRow {
    id: string;
    subjectKind: string;
    source: string;
    containerId: string;
    sourceCommentId: string;
    sentiment?: string;
    interest?: string;
    productInterest?: string;
    disposition?: string;
    qualification?: string;
    nextAction?: string;
    summary?: string;
    attendanceQuality?: number;
    messageCount?: number;
    createdAt: string;
}

/** The engine's counters, as served by /audience/stats. */
interface AudienceCounters {
    conversationCount?: number;
    attendanceQualityAvg?: number;
    attendanceQualityMin?: number;
    attendanceQualityMax?: number;
    messagesTotal?: number;
    messagesAvg?: number;
    interestInterested?: number;
    interestNotInterested?: number;
    interestUndecided?: number;
    dispositionSale?: number;
    dispositionCallback?: number;
    dispositionDeclined?: number;
    dispositionNoAnswer?: number;
    dispositionVoicemail?: number;
    dispositionPending?: number;
    sentimentPositive?: number;
    sentimentNeutral?: number;
    sentimentNegative?: number;
    qualificationHotLead?: number;
    qualificationWarmLead?: number;
    qualificationColdLead?: number;
}

function toAnalysis(row: AudienceRow): Analysis {
    return {
        id: row.id,
        // The engine identifies a subject by its channel id; for a conversation
        // that id IS the entry id.
        entryId: row.sourceCommentId,
        entryType: row.source as AnalysisEntryType,
        interest: (row.interest ?? "") as Analysis["interest"],
        productInterest: row.productInterest || null,
        disposition: (row.disposition ?? "") as Analysis["disposition"],
        sentiment: (row.sentiment ?? "") as Analysis["sentiment"],
        qualification: (row.qualification ?? "") as Analysis["qualification"],
        nextAction: (row.nextAction ?? "") as Analysis["nextAction"],
        summary: row.summary ?? "",
        attendanceQuality: row.attendanceQuality ?? 0,
        messageCount: row.messageCount ?? 0,
        createdAt: row.createdAt,
    };
}

function toStats(counters: AudienceCounters): AnalysisStats {
    return {
        // totalAnalyses counts CONVERSATIONS, not every row: these screens ask
        // about conversations, and a workspace that also analyses comments
        // would otherwise see its comment volume in a conversation total.
        totalAnalyses: counters.conversationCount ?? 0,
        avgAttendanceQuality: counters.attendanceQualityAvg ?? 0,
        minAttendanceQuality: counters.attendanceQualityMin ?? 0,
        maxAttendanceQuality: counters.attendanceQualityMax ?? 0,
        totalMessages: counters.messagesTotal ?? 0,
        avgMessagesPerAnalysis: counters.messagesAvg ?? 0,
        interestInterested: counters.interestInterested ?? 0,
        interestNotInterested: counters.interestNotInterested ?? 0,
        interestUndecided: counters.interestUndecided ?? 0,
        dispositionSale: counters.dispositionSale ?? 0,
        dispositionCallback: counters.dispositionCallback ?? 0,
        dispositionDeclined: counters.dispositionDeclined ?? 0,
        dispositionNoAnswer: counters.dispositionNoAnswer ?? 0,
        dispositionVoicemail: counters.dispositionVoicemail ?? 0,
        dispositionPending: counters.dispositionPending ?? 0,
        sentimentPositive: counters.sentimentPositive ?? 0,
        sentimentNeutral: counters.sentimentNeutral ?? 0,
        sentimentNegative: counters.sentimentNegative ?? 0,
        qualificationHotLead: counters.qualificationHotLead ?? 0,
        qualificationWarmLead: counters.qualificationWarmLead ?? 0,
        qualificationColdLead: counters.qualificationColdLead ?? 0,
    };
}

/** Shared query mapping, so the feed and the numbers above it agree. */
function audienceQuery(params: AnalysisListParams | AnalysisStatsParams) {
    return {
        subjectKind: "conversation",
        source: params.entryType,
        // A campaign is the engine's container.
        containerId: params.whatsappCampaignId ?? params.campaignId,
        interest: params.interest,
        disposition: params.disposition,
        sentiment: params.sentiment,
        qualification: params.qualification,
    };
}
