import type { ConversationMessage, EntryType, MediaType } from '@/lib/conversations/types';
import type {
    ConversationEvent,
    ConversationEventsPage,
} from '@/lib/conversations/events';

import { apiClient } from '@/lib/api/browser-client';


export async function requestCallPermissionAction(
    entryType: EntryType,
    entryId: string,
    bodyText?: string,
): Promise<{ message: ConversationMessage | null; error?: string }> {
    const response = await apiClient<ConversationMessage>(
        `/conversations/${entryType}/${entryId}/call-permission-request`,
        {
            method: 'POST',
            body: JSON.stringify(bodyText ? { body_text: bodyText } : {}),
        },
    );

    if (response.error) {
        return { message: null, error: response.error.message };
    }

    return { message: response.data ?? null };
}

export interface CallPermissionStatus {
    status: 'none' | 'pending' | 'granted' | 'rejected' | 'expired';
    can_call: boolean;
    expires_at?: string | null;
}

export async function getCallPermissionStatusAction(
    entryType: EntryType,
    entryId: string,
): Promise<{ status: CallPermissionStatus | null; error?: string }> {
    const response = await apiClient<CallPermissionStatus>(
        `/conversations/${entryType}/${entryId}/call-permission`,
        { method: 'GET' },
    );

    if (response.error) {
        return { status: null, error: response.error.message };
    }

    return { status: response.data ?? null };
}

export async function uploadConversationMediaAction(
    entryType: EntryType,
    entryId: string,
    file: File,
    mediaType: MediaType,
): Promise<{
    mediaId: string | null;
    mediaUrl: string | null;
    filename: string | null;
    error?: string;
}> {
    const formData = new FormData();
    formData.append('media', file);
    formData.append('mediaType', mediaType);

    console.log('[uploadConversationMedia] Uploading to:', `/conversations/${entryType}/${entryId}/media`);

    const response = await apiClient<{
        media_id: string;
        media_type: MediaType;
        url: string;
        filename: string;
    }>(
        `/conversations/${entryType}/${entryId}/media`,
        {
            method: 'POST',
            body: formData,
        },
    );

    console.log('[uploadConversationMedia] Full response:', JSON.stringify(response, null, 2));

    if (response.error) {
        console.error('[uploadConversationMedia] Error:', response.error);
        return { mediaId: null, mediaUrl: null, filename: null, error: response.error.message };
    }

    const mediaId = response.data?.media_id ?? null;
    console.log('[uploadConversationMedia] Extracted mediaId:', mediaId);

    return {
        mediaId,
        mediaUrl: response.data?.url ?? null,
        filename: response.data?.filename ?? null,
    };
}

export async function listConversationEventsAction(
    entryType: EntryType,
    entryId: string,
    page: number = 1,
    pageSize: number = 50,
): Promise<{
    events: ConversationEvent[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    error?: string;
}> {
    const qs = new URLSearchParams({
        page: String(Math.max(1, page)),
        page_size: String(Math.min(200, Math.max(1, pageSize))),
    });

    const response = await apiClient<ConversationEventsPage>(
        `/conversations/${entryType}/${entryId}/events?${qs.toString()}`,
        { method: 'GET' },
    );

    if (response.error) {
        return {
            events: [],
            page,
            pageSize,
            totalItems: 0,
            totalPages: 0,
            error: response.error.message,
        };
    }

    const data = response.data;
    return {
        events: data?.events ?? [],
        page: data?.page ?? page,
        pageSize: data?.page_size ?? pageSize,
        totalItems: data?.total_items ?? 0,
        totalPages: data?.total_pages ?? 0,
    };
}


export async function getConversationMediaAction(
    entryType: EntryType,
    entryId: string,
    mediaId: string,
): Promise<{
    id: string;
    media_type: MediaType;
    mime_type: string;
    url: string;
    filename: string;
    size: number;
    created_at: string;
} | null> {
    const response = await apiClient<{
        id: string;
        media_type: MediaType;
        mime_type: string;
        url: string;
        filename: string;
        size: number;
        created_at: string;
    }>(
        `/conversations/${entryType}/${entryId}/media/${mediaId}`,
        { method: 'GET' },
    );

    if (response.error) {
        console.error('[getConversationMedia] Error:', response.error);
        return null;
    }

    return response.data ?? null;
}

export async function setConversationAutomationAction(
    entryType: string,
    entryId: string,
    automationEnabled: boolean | null,
) {
    const response = await apiClient<{ assigned_user_id?: string }>(
        `/conversations/${entryType}/${entryId}/automation`,
        {
            method: 'PATCH',
            body: JSON.stringify({ automationEnabled }),
        },
    );

    if (response.error) {
        return { error: response.error.message, assignedUserId: null };
    }
    // Switching automation moves ownership: pausing releases what the agent
    // or workflow held, resuming hands the conversation back to it.
    return { error: null, assignedUserId: response.data?.assigned_user_id ?? "" };
}
