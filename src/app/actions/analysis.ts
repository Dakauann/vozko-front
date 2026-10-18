import type { Analysis, AnalysisEntryType, AnalysisListParams, AnalysisStats, AnalysisStatsParams } from '@/lib/analysis/types';
import type { SubjectCount } from '@/lib/audience/types';

import { apiClient } from "@/lib/api/browser-client";

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
    subjects: [],
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

async function getAnalysisStatsAction(params: AnalysisStatsParams = {}) {
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

export async function getEntryAnalysisAction(entryId: string, entryType: AnalysisEntryType) {
    const queryString = buildQueryString({
        subjectKind: "conversation",
        source: entryType,
        subjectId: entryId,
        status: "analyzed",
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

interface AudienceRow {
    id: string;
    subjectKind: string;
    source: string;
    containerId: string;
    subjectId: string;
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

interface AudienceCounters {
    conversationCount?: number;
    conversationAnalyzed?: number;
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
    subjects?: SubjectCount[];
}

function toAnalysis(row: AudienceRow): Analysis {
    return {
        id: row.id,
        entryId: row.subjectId,
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
        totalAnalyses: counters.conversationAnalyzed ?? counters.conversationCount ?? 0,
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
        subjects: counters.subjects ?? [],
    };
}

function audienceQuery(params: AnalysisListParams | AnalysisStatsParams) {
    return {
        subjectKind: "conversation",
        status: "analyzed",
        latestOnly: "true",
        source: params.entryType,
        containerId: params.whatsappCampaignId ?? params.campaignId,
        interest: params.interest,
        disposition: params.disposition,
        sentiment: params.sentiment,
        qualification: params.qualification,
    };
}
