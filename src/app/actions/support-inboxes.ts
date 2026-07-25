import type {
    SupportInbox,
    SupportInboxListMeta,
    SupportInboxPayload,
} from '@/lib/support-inboxes/types';

import { apiClient } from '@/lib/api/browser-client';

const DEFAULT_META: SupportInboxListMeta = {
    page: 1,
    pageSize: 15,
    totalPages: 1,
    totalItems: 0,
};

interface ListApiResponse {
    data: SupportInbox[];
    meta: SupportInboxListMeta;
}

export async function listSupportInboxesAction(
    page = 1,
    pageSize = 15,
    search?: string,
    archived?: boolean,
) {
    const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
    });
    if (search) params.set('search', search);
    if (archived !== undefined) params.set('archived', String(archived));

    const response = await apiClient<ListApiResponse>(
        `/support/inboxes?${params.toString()}`,
        { method: 'GET' },
    );

    if (response.error) {
        return {
            inboxes: [] as SupportInbox[],
            meta: DEFAULT_META,
            error: response.error.message,
        };
    }

    const data = response.data;
    return {
        inboxes: data?.data ?? [],
        meta: data?.meta ?? DEFAULT_META,
        error: null,
    };
}

export async function getSupportInboxAction(id: string) {
    const response = await apiClient<{ data: SupportInbox }>(
        `/support/inboxes/${id}`,
        { method: 'GET' },
    );

    if (response.error) {
        return { inbox: null, error: response.error.message };
    }

    const inbox = response.data?.data ?? response.data ?? null;
    return { inbox: inbox as SupportInbox | null, error: null };
}

export async function createSupportInboxAction(payload: SupportInboxPayload) {
    const response = await apiClient<{ data: SupportInbox }>(
        '/support/inboxes',
        {
            method: 'POST',
            body: JSON.stringify(payload),
        },
    );

    if (response.error) {
        return { inbox: null, error: response.error.message };
    }

    const inbox = response.data?.data ?? response.data ?? null;
    return { inbox: inbox as SupportInbox | null, error: null };
}

export async function updateSupportInboxAction(id: string, payload: SupportInboxPayload) {
    const response = await apiClient<{ data: SupportInbox }>(
        `/support/inboxes/${id}`,
        {
            method: 'PUT',
            body: JSON.stringify(payload),
        },
    );

    if (response.error) {
        return { inbox: null, error: response.error.message };
    }

    const inbox = response.data?.data ?? response.data ?? null;
    return { inbox: inbox as SupportInbox | null, error: null };
}

export async function deleteSupportInboxAction(id: string) {
    const response = await apiClient<{ message: string }>(
        `/support/inboxes/${id}`,
        { method: 'DELETE' },
    );

    if (response.error) {
        return { error: response.error.message };
    }

    return { error: null };
}

export async function archiveSupportInboxAction(id: string) {
    const response = await apiClient<{ data: SupportInbox }>(
        `/support/inboxes/${id}`,
        {
            method: 'PUT',
            body: JSON.stringify({ archived: true }),
        },
    );

    if (response.error) {
        return { error: response.error.message };
    }

    return { error: null };
}
