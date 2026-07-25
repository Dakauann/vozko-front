import { apiClient } from "@/lib/api/browser-client";
import type { CallBillingRecord } from './call-billing';

export interface CallBillingSummary extends CallBillingRecord { }

export interface CallRecord {
    id: string;
    callId: string;
    workspaceId: string;
    type: string;
    direction: string;
    source: string;
    status: string;
    agentId?: string;
    conversationId?: string;
    campaignId?: string;
    campaignEntryId?: string;
    leadId?: string;
    phoneFrom?: string;
    phoneTo?: string;
    trunkId?: string;
    parentCallId?: string;
    endReason?: string;
    surrenderReason?: string;
    startedAt: string;
    answeredAt?: string;
    endedAt?: string;
    durationSec: number;
    createdAt: string;
    updatedAt: string;
    billing?: CallBillingSummary;
}

interface PaginatedResponse {
    items: CallRecord[];
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
}

export interface ListCallsParams {
    page?: number;
    pageSize?: number;
    type?: string;
    direction?: string;
    source?: string;
    status?: string;
    agentId?: string;
    campaignId?: string;
    leadId?: string;
    startedFrom?: string;
    startedTo?: string;
}

const DEFAULT_META = {
    page: 1,
    page_size: 20,
    total_pages: 1,
    total_items: 0,
};

function buildQueryString(params?: ListCallsParams): string {
    if (!params) return '';
    const sp = new URLSearchParams();
    if (params.page) sp.set('page', String(params.page));
    if (params.pageSize) sp.set('pageSize', String(params.pageSize));
    if (params.type) sp.set('type', params.type);
    if (params.direction) sp.set('direction', params.direction);
    if (params.source) sp.set('source', params.source);
    if (params.status) sp.set('status', params.status);
    if (params.agentId) sp.set('agentId', params.agentId);
    if (params.campaignId) sp.set('campaignId', params.campaignId);
    if (params.leadId) sp.set('leadId', params.leadId);
    if (params.startedFrom) sp.set('startedFrom', params.startedFrom);
    if (params.startedTo) sp.set('startedTo', params.startedTo);
    const qs = sp.toString();
    return qs ? `?${qs}` : '';
}

export async function listCallsAction(params?: ListCallsParams) {
    const qs = buildQueryString(params);
    const response = await apiClient<PaginatedResponse>(`/calls${qs}`, { method: 'GET' });

    if (response.error) {
        return { items: [] as CallRecord[], meta: DEFAULT_META, error: response.error.message };
    }

    const data = response.data;
    if (!data) {
        return { items: [] as CallRecord[], meta: DEFAULT_META, error: null };
    }

    return {
        items: data.items ?? [],
        meta: {
            page: data.page,
            page_size: data.page_size,
            total_pages: data.total_pages,
            total_items: data.total_items,
        },
        error: null,
    };
}

export async function getCallAction(callId: string) {
    const response = await apiClient<CallRecord>(`/calls/${encodeURIComponent(callId)}`, { method: 'GET' });

    if (response.error) {
        return { item: null as CallRecord | null, error: response.error.message };
    }

    return { item: response.data ?? null, error: null };
}
