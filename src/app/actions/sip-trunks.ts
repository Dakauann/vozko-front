import type { SipActiveCall, SipTrunk, SipTrunkPayload } from '@/lib/sip-trunks/types';

import { apiClient } from '@/lib/api/browser-client';

export async function listSipTrunksAction() {
    const response = await apiClient<SipTrunk[]>('/sip-trunks', { method: 'GET' });
    if (response.error) return { trunks: [] as SipTrunk[], error: response.error.message };
    return { trunks: response.data ?? [] };
}

export async function createSipTrunkAction(payload: SipTrunkPayload) {
    const response = await apiClient<SipTrunk>('/sip-trunks', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    if (response.error) return { error: response.error.message };
    return { trunk: response.data };
}

export async function updateSipTrunkAction(trunkId: string, payload: SipTrunkPayload) {
    const response = await apiClient<SipTrunk>(`/sip-trunks/${encodeURIComponent(trunkId)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    if (response.error) return { error: response.error.message };
    return { trunk: response.data };
}

export async function deleteSipTrunkAction(trunkId: string) {
    const response = await apiClient<{ status: string }>(`/sip-trunks/${encodeURIComponent(trunkId)}`, {
        method: 'DELETE',
    });
    if (response.error) return { error: response.error.message };
    return { success: true as const };
}

export async function listSipTrunkCallsAction(trunkId: string) {
    const response = await apiClient<SipActiveCall[]>(`/sip-trunks/${encodeURIComponent(trunkId)}/calls`, {
        method: 'GET',
    });
    if (response.error) return { calls: [] as SipActiveCall[], error: response.error.message };
    return { calls: response.data ?? [] };
}
