import type { DataDeletionRequest } from '@/lib/facebook/types';

import { apiClient } from '@/lib/api/browser-client';

export async function getDataDeletionStatusAction(
    code: string,
): Promise<{ request: DataDeletionRequest } | { notFound: true } | { error: string }> {
    const trimmed = code.trim();
    if (!trimmed) return { notFound: true };
    const response = await apiClient<DataDeletionRequest>(`/meta/data-deletion/${encodeURIComponent(trimmed)}`, {
        method: 'GET',
    });
    if (response.error) {
        return response.error.status === 404 ? { notFound: true } : { error: response.error.message };
    }
    if (!response.data) return { error: 'Empty response' };
    return { request: response.data };
}
