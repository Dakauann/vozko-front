import type { ConversationMessage, EntryType, InboxEntry } from '@/lib/conversations/types';

import { apiClient } from "@/lib/api/browser-client";

export async function searchInboxAction(params: {
    campaignId: string;
    campaignType: 'voice' | 'whatsapp';
    query?: string;
    stageId?: string;
    stageName?: string;
    messageSearch?: string;
    minMessageCount?: number;
    maxMessageCount?: number;
    windowOpen?: boolean;
    hasUnread?: boolean;
    page?: number;
    pageSize?: number;
}): Promise<{
    entries: InboxEntry[];
    query?: string;
    filters: Record<string, unknown>;
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    error?: string;
}> {
    const queryParams = new URLSearchParams();
    queryParams.append('campaign_id', params.campaignId);
    queryParams.append('campaign_type', params.campaignType);

    if (params.query) queryParams.append('query', params.query);
    if (params.stageId) queryParams.append('stage_id', params.stageId);
    if (params.stageName) queryParams.append('stage_name', params.stageName);
    if (params.messageSearch) queryParams.append('message_search', params.messageSearch);
    if (params.minMessageCount !== undefined) {
        queryParams.append('min_message_count', params.minMessageCount.toString());
    }
    if (params.maxMessageCount !== undefined) {
        queryParams.append('max_message_count', params.maxMessageCount.toString());
    }
    if (params.windowOpen !== undefined) {
        queryParams.append('window_open', params.windowOpen.toString());
    }
    if (params.hasUnread !== undefined) {
        queryParams.append('has_unread', params.hasUnread.toString());
    }
    if (params.page !== undefined) {
        queryParams.append('page', params.page.toString());
    }
    if (params.pageSize !== undefined) {
        queryParams.append('page_size', params.pageSize.toString());
    }

    const response = await apiClient<{
        success: boolean;
        data: {
            entries: InboxEntry[];
            query?: string;
            filters: Record<string, unknown>;
            page: number;
            page_size: number;
            total_items: number;
            total_pages: number;
        };
    }>(`/conversations/inbox/search?${queryParams.toString()}`, {
        method: 'GET',
    });

    if (response.error) {
        return {
            entries: [],
            filters: {},
            page: 1,
            pageSize: 20,
            totalItems: 0,
            totalPages: 0,
            error: response.error.message,
        };
    }

    const data = response.data?.data;

    return {
        entries: data?.entries ?? [],
        query: data?.query,
        filters: data?.filters ?? {},
        page: data?.page ?? 1,
        pageSize: data?.page_size ?? 20,
        totalItems: data?.total_items ?? 0,
        totalPages: data?.total_pages ?? 0,
    };
}

export async function searchConversationMessagesAction(
    entryType: EntryType,
    entryId: string,
    query: string,
    page: number = 1,
    pageSize: number = 50,
): Promise<{
    messages: ConversationMessage[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    error?: string;
}> {
    if (!query || query.trim().length === 0) {
        return {
            messages: [],
            page: 1,
            pageSize: 50,
            totalItems: 0,
            totalPages: 0,
            error: 'Search query is required',
        };
    }

    const queryParams = new URLSearchParams({
        query: query.trim(),
        page: page.toString(),
        page_size: pageSize.toString(),
    });

    const response = await apiClient<{
        success: boolean;
        data: {
            messages: ConversationMessage[];
            page: number;
            page_size: number;
            total_items: number;
            total_pages: number;
        };
    }>(
        `/conversations/${entryType}/${entryId}/messages/search?${queryParams.toString()}`,
        { method: 'GET' },
    );

    if (response.error) {
        return {
            messages: [],
            page: 1,
            pageSize: 50,
            totalItems: 0,
            totalPages: 0,
            error: response.error.message,
        };
    }

    const data = response.data?.data;

    return {
        messages: data?.messages ?? [],
        page: data?.page ?? 1,
        pageSize: data?.page_size ?? pageSize,
        totalItems: data?.total_items ?? 0,
        totalPages: data?.total_pages ?? 0,
    };
}
