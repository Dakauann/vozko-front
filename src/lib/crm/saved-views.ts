import type { CrmFilter } from '@/lib/crm/board';
import type { PipelineObjectType } from '@/lib/crm/pipelines';

import { apiClient } from '@/lib/api/browser-client';

// Mirrors domain/savedview.SavedView. A saved view is a named, shareable board
// preset: a filter + groupBy (+ sort/columns/visibility) that the workspace can
// switch between. `filter` is the crmfilter JSON object (not base64) since it
// travels in the request body, not the query string.
/**
 * What a view targets. Wider than PipelineObjectType because a lead list has no
 * pipeline: `lead` views are named segments (a filter + sort + columns), which
 * is exactly what a saved view already is minus the board axis.
 */
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

// The mutable slice a caller supplies when creating/updating a view. The server
// owns id/isDefault/position.
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
