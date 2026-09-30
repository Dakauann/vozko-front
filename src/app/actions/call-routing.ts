import type {
    CallQueue,
    CallQueuePayload,
    HoldPreset,
    QueueLive,
    QueueStats,
    QueueTarget,
    RoutingSettings,
} from '@/lib/call-routing/types';

import { apiClient, fetchWithRefresh, getApiBaseUrl, scopeHeaders } from '@/lib/api/browser-client';

export async function listCallQueuesAction() {
    const response = await apiClient<CallQueue[]>('/call-queues', { method: 'GET' });
    if (response.error) return { queues: [] as CallQueue[], error: response.error.message };
    return { queues: response.data ?? [] };
}

export async function createCallQueueAction(payload: CallQueuePayload) {
    const response = await apiClient<CallQueue>('/call-queues', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    if (response.error) return { error: response.error.message };
    return { queue: response.data };
}

export async function updateCallQueueAction(queueId: string, payload: CallQueuePayload) {
    const response = await apiClient<CallQueue>(`/call-queues/${encodeURIComponent(queueId)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    if (response.error) return { error: response.error.message };
    return { queue: response.data };
}

export async function deleteCallQueueAction(queueId: string) {
    const response = await apiClient<{ status: string }>(`/call-queues/${encodeURIComponent(queueId)}`, {
        method: 'DELETE',
    });
    if (response.error) return { error: response.error.message };
    return { success: true as const };
}

export async function listTransferQueuesAction() {
    const response = await apiClient<QueueTarget[]>('/call-queues/transfer-targets', { method: 'GET' });
    if (response.error) return { queues: [] as QueueTarget[], error: response.error.message };
    return { queues: response.data ?? [] };
}

export async function getRoutingSettingsAction() {
    const response = await apiClient<RoutingSettings>('/call-routing/settings', { method: 'GET' });
    if (response.error) return { error: response.error.message };
    return { settings: response.data };
}

export async function saveRoutingSettingsAction(settings: RoutingSettings) {
    const response = await apiClient<RoutingSettings>('/call-routing/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
    });
    if (response.error) return { error: response.error.message };
    return { settings: response.data };
}

export async function listHoldPresetsAction() {
    const response = await apiClient<HoldPreset[]>('/hold-music/presets', { method: 'GET' });
    if (response.error) return { presets: [] as HoldPreset[], error: response.error.message };
    return { presets: response.data ?? [] };
}

export async function fetchHoldPresetAudioAction(presetId: string) {
    const response = await fetchWithRefresh(() =>
        fetch(`${getApiBaseUrl()}/hold-music/presets/${encodeURIComponent(presetId)}/audio`, {
            method: 'GET',
            credentials: 'include',
            headers: scopeHeaders(),
        }),
    );
    if (!response.ok) return { error: `Preview failed with status ${response.status}` };
    return { blob: await response.blob() };
}

export async function getLiveQueuesAction() {
    const response = await apiClient<QueueLive[]>('/call-queues/live', { method: 'GET' });
    if (response.error) return { queues: [] as QueueLive[], error: response.error.message };
    return { queues: response.data ?? [] };
}

export async function getQueueStatsAction(from: string, to: string) {
    const params = new URLSearchParams({ from, to });
    const response = await apiClient<QueueStats[]>(`/call-queues/stats?${params.toString()}`, { method: 'GET' });
    if (response.error) return { stats: [] as QueueStats[], error: response.error.message };
    return { stats: response.data ?? [] };
}
