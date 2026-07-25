import type { EntryLabel, EntryType, Label } from './types';

import { apiClient } from '@/lib/api/browser-client';
import { normalizeEntryType } from './types';


export function listLabels() {
    return apiClient<Label[]>('/labels', { method: 'GET' });
}

export function createLabel(name: string, color: string) {
    return apiClient<Label>('/labels', {
        method: 'POST',
        body: JSON.stringify({ name, color }),
    });
}

export function updateLabel(labelId: string, data: { name?: string; color?: string }) {
    return apiClient<Label>(`/labels/${labelId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export function deleteLabel(labelId: string) {
    return apiClient<void>(`/labels/${labelId}`, { method: 'DELETE' });
}

export function reorderLabels(labelIds: string[]) {
    return apiClient<Label[]>('/labels/reorder', {
        method: 'PUT',
        body: JSON.stringify({ labelIds }),
    });
}


export function assignLabelToEntry(
    labelId: string,
    entryId: string,
    entryType: EntryType,
) {
    return apiClient<EntryLabel>('/labels/entries', {
        method: 'POST',
        body: JSON.stringify({ labelId, entryId, entryType: normalizeEntryType(entryType) }),
    });
}

export function removeLabelFromEntry(
    labelId: string,
    entryId: string,
    entryType: EntryType,
) {
    return apiClient<void>('/labels/entries', {
        method: 'DELETE',
        body: JSON.stringify({ labelId, entryId, entryType: normalizeEntryType(entryType) }),
    });
}

export function getEntryLabels(entryType: EntryType, entryId: string) {
    return apiClient<EntryLabel[]>(`/labels/entries/${normalizeEntryType(entryType)}/${entryId}`, {
        method: 'GET',
    });
}
