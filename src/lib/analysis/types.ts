export type AnalysisEntryType = 'voice' | 'whatsapp';

export type AnalysisInterest = 'interested' | 'not_interested' | 'undecided';

export type AnalysisDisposition = 'sale' | 'callback' | 'declined' | 'no_answer' | 'voicemail' | 'pending';

export type AnalysisSentiment = 'positive' | 'neutral' | 'negative';

export type AnalysisQualification = 'hot_lead' | 'warm_lead' | 'cold_lead';

export type AnalysisNextAction = 'schedule_callback' | 'send_whatsapp' | 'close' | 'escalate' | 'continue';

export interface Analysis {
    id: string;
    entryId: string;
    entryType: AnalysisEntryType;
    interest: AnalysisInterest;
    productInterest?: string | null;
    disposition: AnalysisDisposition;
    sentiment: AnalysisSentiment;
    qualification: AnalysisQualification;
    nextAction: AnalysisNextAction;
    summary: string;
    attendanceQuality: number;
    messageCount: number;
    createdAt: string;
}

export interface AnalysisListParams {
    campaignId?: string;
    whatsappCampaignId?: string;
    leadId?: string;
    entryType?: AnalysisEntryType;
    interest?: AnalysisInterest;
    disposition?: AnalysisDisposition;
    sentiment?: AnalysisSentiment;
    qualification?: AnalysisQualification;
    nextAction?: AnalysisNextAction;
    attendanceQualityMin?: number;
    attendanceQualityMax?: number;
    page?: number;
    pageSize?: number;
    sortBy?: 'createdAt' | 'attendanceQuality' | 'interest' | 'disposition' | 'sentiment' | 'qualification';
    sortOrder?: 'asc' | 'desc';
}

export interface AnalysisStatsParams {
    campaignId?: string;
    whatsappCampaignId?: string;
    leadId?: string;
    entryType?: AnalysisEntryType;
    interest?: AnalysisInterest;
    disposition?: AnalysisDisposition;
    sentiment?: AnalysisSentiment;
    qualification?: AnalysisQualification;
    attendanceQualityMin?: number;
    attendanceQualityMax?: number;
}

export interface AnalysisPagination {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export interface AnalysisListResponse {
    success: boolean;
    data: Analysis[];
    pagination: AnalysisPagination;
}

export interface AnalysisSingleResponse {
    success: boolean;
    data: Analysis;
}

export interface AnalysisStats {
    totalAnalyses: number;
    avgAttendanceQuality: number;
    minAttendanceQuality: number;
    maxAttendanceQuality: number;
    totalMessages: number;
    avgMessagesPerAnalysis: number;

    interestInterested: number;
    interestNotInterested: number;
    interestUndecided: number;

    dispositionSale: number;
    dispositionCallback: number;
    dispositionDeclined: number;
    dispositionNoAnswer: number;
    dispositionVoicemail: number;
    dispositionPending: number;

    sentimentPositive: number;
    sentimentNeutral: number;
    sentimentNegative: number;

    qualificationHotLead: number;
    qualificationWarmLead: number;
    qualificationColdLead: number;
}

export interface AnalysisStatsResponse {
    success: boolean;
    data: AnalysisStats;
}
