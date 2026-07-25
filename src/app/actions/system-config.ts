import {
    DEFAULT_SYSTEM_CONFIG,
    SystemConfig,
    UpdateSystemConfigPayload
} from '@/lib/system-config/types';

import { apiClient } from "@/lib/api/browser-client";

function normalizeSystemConfigPayload(
    payload?: SystemConfig | null,
): SystemConfig {
    return {
        ...DEFAULT_SYSTEM_CONFIG,
        ...payload,
    };
}

export async function getSystemConfigAction(): Promise<{
    config: SystemConfig | null;
    error?: string;
}> {
    const response = await apiClient<SystemConfig>('/admin/system/config', {
        method: 'GET',
    });

    if (response.error) {
        return {
            config: null,
            error: response.error.message
        };
    }

    const config = normalizeSystemConfigPayload(response.data ?? null);

    return { config };
}


export async function updateSystemConfigAction(
    payload: UpdateSystemConfigPayload
): Promise<{
    config: SystemConfig | null;
    error?: string;
}> {
    const cleanPayload: UpdateSystemConfigPayload = {};

    if (payload.baseSystemPrompt !== undefined) {
        cleanPayload.baseSystemPrompt = payload.baseSystemPrompt;
    }

    if (payload.maxConcurrentCalls !== undefined) {
        cleanPayload.maxConcurrentCalls = Math.max(
            1,
            Math.round(payload.maxConcurrentCalls)
        );
    }

    if (payload.workTimeEnabled !== undefined) {
        cleanPayload.workTimeEnabled = payload.workTimeEnabled;
    }

    if (payload.workTimeStart !== undefined) {
        cleanPayload.workTimeStart = payload.workTimeStart;
    }

    if (payload.workTimeEnd !== undefined) {
        cleanPayload.workTimeEnd = payload.workTimeEnd;
    }

    const response = await apiClient<SystemConfig>('/admin/system/config', {
        method: 'PUT',
        body: JSON.stringify(cleanPayload),
    });

    if (response.error) {
        return {
            config: null,
            error: response.error.message
        };
    }

    const config = normalizeSystemConfigPayload(response.data ?? null);

    return { config };
}
