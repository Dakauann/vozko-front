import type { EntryStage, EntryType, Stage } from '@/lib/conversations/types';
import {
    assignStageToEntry,
    createStage,
    deleteStage,
    getBatchEntryStages,
    getEntryStage,
    removeStageFromEntry,
    reorderStages,
    setInitialStage,
    updateStage,
} from '@/lib/conversations/stages';

import { apiClient } from "@/lib/api/browser-client";


/**
 * Stages of ONE funnel.
 *
 * `pipelineId` names it directly and wins on the server. Without it the backend
 * resolves through the campaign and, with no campaign, lands on the workspace
 * default — which is why every stage list in the CRM used to show the default
 * funnel's stages no matter which funnel was on screen.
 */
export async function listStagesAction(workspaceId?: string, campaignId?: string, campaignType?: string, pipelineId?: string): Promise<{ stages: Stage[]; error?: string }> {
    const wsHeaders: Record<string, string> = workspaceId ? { 'X-Workspace-ID': workspaceId } : {};
    const params = new URLSearchParams();
    if (campaignId) params.set('campaignId', campaignId);
    if (campaignType) params.set('campaignType', campaignType);
    if (pipelineId) params.set('pipelineId', pipelineId);
    const qs = params.toString();
    const response = await apiClient<Stage[]>(`/stages${qs ? `?${qs}` : ''}`, { method: 'GET', headers: wsHeaders });

    if (response.error) {
        return { stages: [], error: response.error.message };
    }

    return { stages: response.data ?? [] };
}

export async function createStageAction(
    name: string,
    color: string,
    description: string,
    campaignId?: string,
    campaignType?: string,
    pipelineId?: string,
): Promise<{ stage: Stage | null; error?: string }> {
    const response = await createStage(name, color, description, campaignId, campaignType, pipelineId);

    if (response.error) {
        return { stage: null, error: response.error.message };
    }

    return { stage: response.data ?? null };
}

export async function updateStageAction(
    stageId: string,
    data: { name?: string; color?: string; description?: string },
): Promise<{ stage: Stage | null; error?: string }> {
    const response = await updateStage(stageId, data);

    if (response.error) {
        return { stage: null, error: response.error.message };
    }

    return { stage: response.data ?? null };
}

export async function deleteStageAction(
    stageId: string,
): Promise<{ success: boolean; error?: string }> {
    const response = await deleteStage(stageId);

    if (response.error) {
        return { success: false, error: response.error.message };
    }

    return { success: true };
}

export async function setInitialStageAction(
    stageId: string,
): Promise<{ stage: Stage | null; error?: string }> {
    const response = await setInitialStage(stageId);

    if (response.error) {
        return { stage: null, error: response.error.message };
    }

    return { stage: response.data ?? null };
}

export async function reorderStagesAction(
    stageIds: string[],
): Promise<{ stages: Stage[]; error?: string }> {
    const response = await reorderStages(stageIds);

    if (response.error) {
        return { stages: [], error: response.error.message };
    }

    return { stages: response.data ?? [] };
}


export async function assignStageToEntryAction(
    stageId: string,
    entryId: string,
    entryType: EntryType,
): Promise<{ entryStage: EntryStage | null; error?: string }> {
    const response = await assignStageToEntry(stageId, entryId, entryType);

    if (response.error) {
        return { entryStage: null, error: response.error.message };
    }

    return { entryStage: response.data ?? null };
}

export async function removeStageFromEntryAction(
    stageId: string,
    entryId: string,
    entryType: EntryType,
): Promise<{ success: boolean; error?: string }> {
    const response = await removeStageFromEntry(stageId, entryId, entryType);

    if (response.error) {
        return { success: false, error: response.error.message };
    }

    return { success: true };
}

export async function getEntryStageAction(
    entryType: EntryType,
    entryId: string,
): Promise<{ entryStage: EntryStage | null; error?: string }> {
    const response = await getEntryStage(entryType, entryId);

    if (response.error) {
        return { entryStage: null, error: response.error.message };
    }

    return { entryStage: response.data ?? null };
}

export async function getBatchEntryStagesAction(
    entryIds: string[],
    entryType: EntryType,
): Promise<{ entryStages: Record<string, EntryStage | null>; error?: string }> {
    if (!entryIds.length) return { entryStages: {} };

    const response = await getBatchEntryStages(entryIds, entryType);

    if (response.error) {
        return { entryStages: {}, error: response.error.message };
    }

    return { entryStages: response.data ?? {} };
}
