import type { CrmFilter } from '@/lib/crm/board';
import type { PipelineObjectType } from '@/lib/crm/pipelines';

import { apiClient } from '@/lib/api/browser-client';

export type SavedViewObjectType = PipelineObjectType | 'lead';

export type SavedViewVisibility = 'private' | 'shared' | 'workspace';
export type SavedViewSortDir = 'asc' | 'desc';

export interface SavedView {
    id: string;
    name: string;
    objectType: SavedViewObjectType;
    pipelineId?: string;
    filter: CrmFilter;
    groupBy: string;
    sortField?: string;
    sortDir?: SavedViewSortDir | string;
    columns?: string[];
    visibility?: SavedViewVisibility | string;
    isDefault: boolean;
    position: number;
}

export interface SavedViewInput {
    name: string;
    objectType: SavedViewObjectType;
    pipelineId?: string;
    filter: CrmFilter;
    groupBy: string;
    sortField?: string;
    sortDir?: SavedViewSortDir | string;
    columns?: string[];
    visibility?: SavedViewVisibility | string;
}

export function listSavedViews(
    objectType: SavedViewObjectType = 'conversation',
) {
    const qs = objectType ? `?objectType=${encodeURIComponent(objectType)}` : '';
    return apiClient<SavedView[]>(`/saved-views${qs}`, { method: 'GET' });
}

export function createSavedView(input: SavedViewInput) {
    return apiClient<SavedView>('/saved-views', {
        method: 'POST',
        body: JSON.stringify(input),
    });
}

export function updateSavedView(
    id: string,
    input: Partial<SavedViewInput>,
) {
    return apiClient<SavedView>(`/saved-views/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
    });
}

export function deleteSavedView(id: string) {
    return apiClient<void>(`/saved-views/${id}`, { method: 'DELETE' });
}

export function setDefaultSavedView(id: string) {
    return apiClient<SavedView>(`/saved-views/${id}/default`, {
        method: 'PUT',
    });
}
