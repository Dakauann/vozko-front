import type {
    CallRecording,
    CallRecordingResponse,
    CallRecordingsByRelationResponse,
    CallRecordingsListMeta,
    CallRecordingsListParams,
    CallRecordingsListResponse,
} from '@/lib/call-recordings/types';

import { apiClient } from "@/lib/api/browser-client";

const DEFAULT_RECORDINGS_META: CallRecordingsListMeta = {
    page: 1,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
};

export async function listCallRecordingsAction(
    params: CallRecordingsListParams = {}
) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString());
    if (params.leadId) queryParams.set('leadId', params.leadId);
    if (params.campaignEntryId) queryParams.set('campaignEntryId', params.campaignEntryId);
    if (params.campaignId) queryParams.set('campaignId', params.campaignId);
    if (params.minDuration !== undefined) queryParams.set('minDuration', params.minDuration.toString());
    if (params.maxDuration !== undefined) queryParams.set('maxDuration', params.maxDuration.toString());
    if (params.sortBy) queryParams.set('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);

    const queryString = queryParams.toString();
    const url = `/admin/call-recordings${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<CallRecordingsListResponse>(url, {
        method: 'GET',
    });

    console.log(response)

    if (response.error) {
        return {
            recordings: [] as CallRecording[],
            meta: DEFAULT_RECORDINGS_META,
            error: response.error.message,
        };
    }

    const data = response.data?.items;

    return {
        recordings: data ?? [],
        meta: {
            page: response.data?.page ?? 1,
            pageSize: response.data?.pageSize ?? 20,
            totalPages: response.data?.totalPages ?? 1,
            totalItems: response.data?.totalItems ?? 0,
        },
        error: null,
    };
}

export async function getCallRecordingByCallIdAction(callId: string) {
    const response = await apiClient<CallRecordingResponse>(`/admin/call-recordings/by-call?callId=${encodeURIComponent(callId)}`, {
        method: 'GET',
    });

    if (response.error) {
        return { recording: null, error: response.error.message };
    }

    return { recording: response.data?.data ?? null, error: null };
}

export async function getCallRecordingsByLeadAction(leadId: string) {
    const response = await apiClient<CallRecordingsByRelationResponse>(`/admin/call-recordings/by-lead?leadId=${encodeURIComponent(leadId)}`, {
        method: 'GET',
    });

    if (response.error) {
        return { recordings: [], total: 0, error: response.error.message };
    }

    return {
        recordings: response.data?.items ?? [],
        total: response.data?.total ?? 0,
        error: null,
    };
}

export async function getCallRecordingsByEntryAction(entryId: string) {
    const response = await apiClient<CallRecordingsByRelationResponse>(`/call-recordings/by-entry?entryId=${encodeURIComponent(entryId)}`, {
        method: 'GET',
    });

    if (response.error) {
        return { recordings: [], total: 0, error: response.error.message };
    }

    return {
        recordings: response.data?.items ?? [],
        total: response.data?.total ?? 0,
        error: null,
    };
}
