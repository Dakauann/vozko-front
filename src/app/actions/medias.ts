import { Media } from '@/lib/medias/types';
import { apiClient, fetchWithRefresh, getApiBaseUrl, scopeHeaders } from '@/lib/api/browser-client';

import { isActionError, settleResult, type ActionResult } from './action-result';

export async function getMediaAction(mediaId: string): Promise<Media | null> {
    const response = await apiClient<Media>(`/medias/${mediaId}`, {
        method: 'GET',
    });

    if (response.error) {
        return null;
    }

    return response.data || null;
}

export async function listLibraryAction(): Promise<ActionResult<Media[]>> {
    return settleResult(await apiClient<Media[]>('/medias', { method: 'GET' }), []);
}

export async function listMediasAction(): Promise<{ medias: Media[] }> {
    const result = await listLibraryAction();
    return { medias: isActionError(result) ? [] : result.data };
}


export async function uploadMediaAction(formData: FormData): Promise<{
    mediaId: string | null;
    mediaUrl: string | null;
    mediaPreviewUrl?: string | null;
    error?: string;
}> {
    const response = await apiClient<{
        id: string,
        description: string,
        url: string,
        previewUrl: string,
        createdAt: string,
        type: string
    }>('/medias', {
        method: 'POST',
        body: formData,
    });

    console.log(response)

    if (response.error) {
        return { mediaId: null, mediaUrl: null, error: response.error.message };
    }

    return { mediaId: response.data?.id || null, mediaUrl: response.data?.url || null, mediaPreviewUrl: response.data?.previewUrl || null };
}

export interface MediaFile {
    blob: Blob;
    contentType: string;
}

export async function fetchMediaFileAction(mediaId: string): Promise<{ data: MediaFile | null; error: string | null }> {
    try {
        const response = await fetchWithRefresh(() =>
            fetch(`${getApiBaseUrl()}/medias/${encodeURIComponent(mediaId)}/file`, {
                method: 'GET',
                credentials: 'include',
                headers: scopeHeaders(),
            }),
        );
        if (!response.ok) {
            return { data: null, error: `Download failed with status ${response.status}` };
        }
        const blob = await response.blob();
        return { data: { blob, contentType: response.headers.get('Content-Type') ?? blob.type }, error: null };
    } catch (error) {
        return { data: null, error: error instanceof Error ? error.message : 'Network error' };
    }
}
