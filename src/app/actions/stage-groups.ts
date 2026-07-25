import type { CreateStageGroupInput, StageGroup, UpdateStageGroupInput } from '@/lib/stage-groups/types';

import { apiClient } from "@/lib/api/browser-client";

export async function listStageGroupsAction(): Promise<{ stageGroups: StageGroup[]; error?: string }> {
    const response = await apiClient<StageGroup[]>('/stage-groups', { method: 'GET' });

    if (response.error) {
        return { stageGroups: [], error: response.error.message };
    }

    return { stageGroups: response.data ?? [] };
}

export async function createStageGroupAction(
    input: CreateStageGroupInput,
): Promise<{ stageGroup: StageGroup | null; error?: string }> {
    const response = await apiClient<StageGroup>('/stage-groups', {
        method: 'POST',
        body: JSON.stringify(input),
    });

    if (response.error) {
        return { stageGroup: null, error: response.error.message };
    }

    return { stageGroup: response.data ?? null };
}

export async function updateStageGroupAction(
    id: string,
    input: UpdateStageGroupInput,
): Promise<{ stageGroup: StageGroup | null; error?: string }> {
    const response = await apiClient<StageGroup>(`/stage-groups/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
    });

    if (response.error) {
        return { stageGroup: null, error: response.error.message };
    }

    return { stageGroup: response.data ?? null };
}

export async function deleteStageGroupAction(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const response = await apiClient<void>(`/stage-groups/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });

    if (response.error) {
        return { success: false, error: response.error.message };
    }

    return { success: true };
}
