import {
    createSavedView,
    deleteSavedView,
    listSavedViews,
    setDefaultSavedView,
    updateSavedView,
    type SavedView,
    type SavedViewInput,
} from '@/lib/crm/saved-views';
import type { PipelineObjectType } from '@/lib/crm/pipelines';


export async function listSavedViewsAction(
    objectType: PipelineObjectType = 'conversation',
): Promise<{ views: SavedView[]; error?: string }> {
    const response = await listSavedViews(objectType);

    if (response.error) {
        return { views: [], error: response.error.message };
    }

    return { views: response.data ?? [] };
}

export async function createSavedViewAction(
    input: SavedViewInput,
): Promise<{ view: SavedView | null; error?: string }> {
    const response = await createSavedView(input);

    if (response.error) {
        return { view: null, error: response.error.message };
    }

    return { view: response.data ?? null };
}

export async function updateSavedViewAction(
    id: string,
    input: Partial<SavedViewInput>,
): Promise<{ view: SavedView | null; error?: string }> {
    const response = await updateSavedView(id, input);

    if (response.error) {
        return { view: null, error: response.error.message };
    }

    return { view: response.data ?? null };
}

export async function deleteSavedViewAction(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const response = await deleteSavedView(id);

    if (response.error) {
        return { success: false, error: response.error.message };
    }

    return { success: true };
}

export async function setDefaultSavedViewAction(
    id: string,
): Promise<{ view: SavedView | null; error?: string }> {
    const response = await setDefaultSavedView(id);

    if (response.error) {
        return { view: null, error: response.error.message };
    }

    return { view: response.data ?? null };
}
