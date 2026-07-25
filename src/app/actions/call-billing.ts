import { apiClient } from "@/lib/api/browser-client";

export interface CallBillingRecord {
    id: string;
    callId: string;
    workspaceId: string;
    agentId: string;
    leadId?: string;
    callSource: string;
    status: string;
    callStart: string;
    callEnd: string;
    durationSec: number;
    telephonyChargeMicros: number;
    totalChargeMicros: number;
    transactionId?: string;
    recordingUrl?: string;
    createdAt: string;
    updatedAt: string;
}

interface PaginatedResponse {
    items: CallBillingRecord[];
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
}

export interface ListCallBillingParams {
    page?: number;
    pageSize?: number;
    status?: string;
    callSource?: string;
    startDate?: string;
    endDate?: string;
}

const DEFAULT_META = {
    page: 1,
    page_size: 20,
    total_pages: 1,
    total_items: 0,
};

function buildQueryString(params?: ListCallBillingParams): string {
    if (!params) return '';
    const sp = new URLSearchParams();
    if (params.page) sp.set('page', String(params.page));
    if (params.pageSize) sp.set('pageSize', String(params.pageSize));
    if (params.status) sp.set('status', params.status);
    if (params.callSource) sp.set('callSource', params.callSource);
    if (params.startDate) sp.set('startDate', params.startDate);
    if (params.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();
    return qs ? `?${qs}` : '';
}

export async function listCallBillingAction(params?: ListCallBillingParams) {
    const qs = buildQueryString(params);
    const response = await apiClient<PaginatedResponse>(`/call-billing${qs}`, { method: 'GET' });

    if (response.error) {
        return { items: [] as CallBillingRecord[], meta: DEFAULT_META, error: response.error.message };
    }

    const data = response.data;
    if (!data) {
        return { items: [] as CallBillingRecord[], meta: DEFAULT_META, error: null };
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
