import { Media } from '@/lib/medias/types';
import type { BuiltinHoldTrack } from '@/lib/workspace/workspace-config/types';
import { apiClient, getApiBaseUrl } from '@/lib/api/browser-client';

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

/** Remove uma música de espera enviada pelo workspace (libera uma vaga do plano). */
export async function deleteHoldMusicAction(mediaId: string): Promise<{ ok: boolean; error?: string }> {
    const response = await apiClient<{ deleted: string }>(`/medias/${mediaId}`, {
        method: 'DELETE',
    });

    if (response.error) {
        return { ok: false, error: response.error.message };
    }
    return { ok: true };
}

/** Faixas de espera prontas para uso, inclusas no servidor. */
export async function listHoldMusicBuiltinsAction(): Promise<{ tracks: BuiltinHoldTrack[] }> {
    const response = await apiClient<{ tracks: BuiltinHoldTrack[] }>('/hold-music/builtins', {
        method: 'GET',
    });

    if (response.error) {
        return { tracks: [] };
    }
    return { tracks: response.data?.tracks ?? [] };
}

/**
 * Bytes (base64) de uma faixa inclusa, para o player de pré-escuta. O endpoint
 * de áudio exige o token, então o servidor busca e repassa como data URI.
 */
export async function getHoldMusicBuiltinPreviewAction(
    workspaceId: string,
    key: string,
): Promise<{ dataUri: string | null; error?: string }> {
    try {
        const res = await fetch(
            `${getApiBaseUrl()}/hold-music/builtins/${encodeURIComponent(key)}/audio`,
            {
                credentials: 'include',
                headers: {
                    'X-Workspace-ID': workspaceId,
                },
                cache: 'no-store',
            },
        );
        if (!res.ok) {
            return { dataUri: null, error: `preview failed (${res.status})` };
        }
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        return { dataUri: `data:audio/mpeg;base64,${base64}` };
    } catch (err) {
        return { dataUri: null, error: err instanceof Error ? err.message : 'preview failed' };
    }
}
