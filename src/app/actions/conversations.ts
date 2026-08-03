import type { ConversationMessage, EntryType, MediaType } from '@/lib/conversations/types';
import type {
    ConversationEvent,
    ConversationEventsPage,
} from '@/lib/conversations/events';

import { apiClient } from '@/lib/api/browser-client';

export async function sendConversationMessageAction(
    entryType: EntryType,
    entryId: string,
    text: string,
    mediaId?: string,
    mediaType?: MediaType,
): Promise<{ message: ConversationMessage | null; error?: string }> {
    const body: Record<string, unknown> = { text };
    if (mediaId && mediaType) {
        body.media_id = mediaId;
        body.media_type = mediaType;
    }

    const response = await apiClient<ConversationMessage>(
        `/conversations/${entryType}/${entryId}/messages`,
        {
            method: 'POST',
            body: JSON.stringify(body),
        },
    );

    console.log("sending: ", body, "response: ", response);

    if (response.error) {
        return { message: null, error: response.error.message };
    }

    return { message: response.data ?? null };
}

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

/**
 * Reads whether the conversation's lead currently allows WhatsApp calls. Used to
 * gate the "call via WhatsApp" action, `can_call` is true only when permission is
 * granted and still valid. The backend is the source of truth (it also enforces it
 * when a call is placed); callers should treat any error as "cannot call".
 */
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

/**
 * Activity timeline for one conversation (CRM telemetry conversation_events).
 * Backend: GET /conversations/{entryType}/{entryId}/events
 */
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

export async function getConversationHistoryAction(
    entryType: EntryType,
    entryId: string,
    page: number = 1,
    limit: number = 50,
): Promise<{
    messages: ConversationMessage[];
    has_more: boolean;
    error?: string;
}> {
    const response = await apiClient<{
        messages: ConversationMessage[];
        has_more: boolean;
    }>(
        `/conversations/${entryType}/${entryId}/messages?page=${page}&limit=${limit}`,
        { method: 'GET' },
    );

    if (response.error) {
        return { messages: [], has_more: false, error: response.error.message };
    }

    return {
        messages: response.data?.messages ?? [],
        has_more: response.data?.has_more ?? false,
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

/**
 * Toggles the per-conversation automation override on any channel.
 *
 * Replaces the WhatsApp campaign-entry PATCH, which required a campaign id.
 * Instagram and Telegram conversations have none, so the caller resolved no id
 * and returned before issuing a request, the button did nothing, silently.
 *
 * `null` clears the override so the conversation inherits its account or
 * campaign setting again, which is distinct from an explicit `false`.
 */
export async function setConversationAutomationAction(
    entryType: string,
    entryId: string,
    automationEnabled: boolean | null,
) {
    const response = await apiClient<{ success: boolean }>(
        `/conversations/${entryType}/${entryId}/automation`,
        {
            method: 'PATCH',
            body: JSON.stringify({ automationEnabled }),
        },
    );

    if (response.error) {
        return { error: response.error.message };
    }
    return { error: null };
}
