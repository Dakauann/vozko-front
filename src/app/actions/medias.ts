import { Media } from '@/lib/medias/types';
import { apiClient } from '@/lib/api/browser-client';

export async function getMediaAction(mediaId: string): Promise<Media | null> {
    const response = await apiClient<Media>(`/medias/${mediaId}`, {
        method: 'GET',
    });

    if (response.error) {
        return null;
    }

    return response.data || null;
}

export async function listMediasAction(): Promise<{ medias: Media[] }> {
    const response = await apiClient<Media[]>('/medias', {
        method: 'GET',
    });

    if (response.error) {
        return { medias: [] };
    }

    return { medias: response.data ?? [] };
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
