export interface CallRecording {
    callId: string;
    campaignEntryId?: string | null;
    leadId?: string | null;
    recordingUrl: string;
    durationSec: number;
    durationMin: number;
    fileSize: number;
    callStart: string;
    callEnd: string;
    createdAt: string;
}

export interface CallRecordingsListParams {
    page?: number;
    pageSize?: number;
    leadId?: string;
    campaignEntryId?: string;
    campaignId?: string;
    minDuration?: number;
    maxDuration?: number;
    sortBy?: 'created_at' | 'duration' | 'call_start';
    sortOrder?: 'asc' | 'desc';
}

export interface CallRecordingsListMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export interface CallRecordingsListResponse {
    status: string;

    items: CallRecording[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
}

export interface CallRecordingResponse {
    status: string;
    data: CallRecording;
}

export interface CallRecordingsByRelationResponse {
    items: CallRecording[];
    total: number;
}
