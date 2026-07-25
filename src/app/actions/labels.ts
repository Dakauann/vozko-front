import type { EntryLabel, EntryType, Label } from '@/lib/conversations/types';
import {
    assignLabelToEntry,
    createLabel,
    deleteLabel,
    removeLabelFromEntry,
    reorderLabels,
    updateLabel,
} from '@/lib/conversations/labels';

import { apiClient } from "@/lib/api/browser-client";


export async function listLabelsAction(workspaceId?: string): Promise<{ labels: Label[]; error?: string }> {
    const wsHeaders: Record<string, string> = workspaceId ? { 'X-Workspace-ID': workspaceId } : {};
    const response = await apiClient<Label[]>('/labels', { method: 'GET', headers: wsHeaders });

    if (response.error) {
        return { labels: [], error: response.error.message };
    }

    return { labels: response.data ?? [] };
}

export async function createLabelAction(
    name: string,
    color: string,
): Promise<{ label: Label | null; error?: string }> {
    const response = await createLabel(name, color);

    if (response.error) {
        return { label: null, error: response.error.message };
    }

    return { label: response.data ?? null };
}

export async function updateLabelAction(
    labelId: string,
    data: { name?: string; color?: string },
): Promise<{ label: Label | null; error?: string }> {
    const response = await updateLabel(labelId, data);

    if (response.error) {
        return { label: null, error: response.error.message };
    }

    return { label: response.data ?? null };
}

export async function deleteLabelAction(
    labelId: string,
): Promise<{ success: boolean; error?: string }> {
    const response = await deleteLabel(labelId);

    if (response.error) {
        return { success: false, error: response.error.message };
    }

    return { success: true };
}

export async function reorderLabelsAction(
    labelIds: string[],
): Promise<{ labels: Label[]; error?: string }> {
    const response = await reorderLabels(labelIds);

    if (response.error) {
        return { labels: [], error: response.error.message };
    }

    return { labels: response.data ?? [] };
}


export async function assignLabelToEntryAction(
    labelId: string,
    entryId: string,
    entryType: EntryType,
): Promise<{ entryLabel: EntryLabel | null; error?: string }> {
    const response = await assignLabelToEntry(labelId, entryId, entryType);

    if (response.error) {
        return { entryLabel: null, error: response.error.message };
    }

    return { entryLabel: response.data ?? null };
}

export async function removeLabelFromEntryAction(
    labelId: string,
    entryId: string,
    entryType: EntryType,
): Promise<{ success: boolean; error?: string }> {
    const response = await removeLabelFromEntry(labelId, entryId, entryType);

    if (response.error) {
        return { success: false, error: response.error.message };
    }

    return { success: true };
}
