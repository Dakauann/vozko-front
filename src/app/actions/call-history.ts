import { callListQuery } from '@/lib/call-history/format';
import type { CallDetail, CallListFilters, CallListPage } from '@/lib/call-history/types';

import { apiClient } from '@/lib/api/browser-client';

export async function listCallsAction(filters: CallListFilters) {
    const response = await apiClient<CallListPage>(`/calls?${callListQuery(filters)}`, { method: 'GET' });
    if (response.error || !response.data) return { error: response.error?.message ?? 'empty response' };
    return { page: response.data };
}

export async function getCallAction(callId: string) {
    const response = await apiClient<CallDetail>(`/calls/${encodeURIComponent(callId)}`, { method: 'GET' });
    if (response.error || !response.data) return { error: response.error?.message ?? 'empty response' };
    return { call: response.data };
}
