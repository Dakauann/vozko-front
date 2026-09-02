import type { EntryStage, EntryType, Stage } from './types';

import { apiClient } from '@/lib/api/browser-client';
import { normalizeEntryType } from './types';


export function listStages(campaignId?: string, campaignType?: string) {
    const params = new URLSearchParams();
    if (campaignId) params.set('campaignId', campaignId);
    if (campaignType) params.set('campaignType', campaignType);
    const qs = params.toString();
    return apiClient<Stage[]>(`/stages${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

// pipelineId puts the stage on a named funnel; without it the server attaches it
// to the workspace default, which is what made it impossible to add a column to a
// custom funnel from the CRM.
export function createStage(name: string, color: string, description: string, campaignId?: string, campaignType?: string, pipelineId?: string) {
    return apiClient<Stage>('/stages', {
        method: 'POST',
        body: JSON.stringify({ name, color, description, ...(campaignId && { campaignId }), ...(campaignType && { campaignType }), ...(pipelineId && { pipelineId }) }),
    });
}

export function updateStage(stageId: string, data: { name?: string; color?: string; description?: string }) {
    return apiClient<Stage>(`/stages/${stageId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export function deleteStage(stageId: string) {
    return apiClient<void>(`/stages/${stageId}`, { method: 'DELETE' });
}

export function setInitialStage(stageId: string) {
    return apiClient<Stage>('/stages/initial', {
        method: 'PUT',
        body: JSON.stringify({ stageId }),
    });
}

export function reorderStages(stageIds: string[]) {
    return apiClient<Stage[]>('/stages/reorder', {
        method: 'PUT',
        body: JSON.stringify({ stageIds }),
    });
}


export function assignStageToEntry(
    stageId: string,
    entryId: string,
    entryType: EntryType,
) {
    return apiClient<EntryStage>('/stages/entries', {
        method: 'POST',
        body: JSON.stringify({ stageId, entryId, entryType: normalizeEntryType(entryType) }),
    });
}

export function removeStageFromEntry(
    stageId: string,
    entryId: string,
    entryType: EntryType,
) {
    return apiClient<void>('/stages/entries', {
        method: 'DELETE',
        body: JSON.stringify({ stageId, entryId, entryType: normalizeEntryType(entryType) }),
    });
}

export function getEntryStage(entryType: EntryType, entryId: string) {
    return apiClient<EntryStage | null>(`/stages/entries/${normalizeEntryType(entryType)}/${entryId}`, {
        method: 'GET',
    });
}

export function getBatchEntryStages(entryIds: string[], entryType: EntryType) {
    return apiClient<Record<string, EntryStage | null>>('/stages/entries/batch', {
        method: 'POST',
        body: JSON.stringify({ entryIds, entryType: normalizeEntryType(entryType) }),
    });
}
