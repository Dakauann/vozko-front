import type { EmailInbox, EmailInboxSettings } from '@/lib/email/types';

import { apiClient, type ApiResult } from '@/lib/api/browser-client';

interface EmailActionError {
    error: string;
    code?: string;
}

function failure(result: ApiResult<unknown>): EmailActionError {
    return { error: result.error?.message ?? 'Request failed', code: result.error?.code };
}

function inboxPath(senderId: string): string {
    return `/email/inboxes/${encodeURIComponent(senderId)}`;
}

export async function listEmailInboxesAction() {
    const response = await apiClient<{ items: EmailInbox[] }>('/email/inboxes', { method: 'GET' });
    if (response.error) return { inboxes: [] as EmailInbox[], ...failure(response) };
    return { inboxes: response.data?.items ?? [] };
}

export async function getEmailInboxAction(senderId: string) {
    const response = await apiClient<EmailInbox>(inboxPath(senderId), { method: 'GET' });
    if (response.error) return failure(response);
    return { inbox: response.data };
}

export async function updateEmailInboxAction(senderId: string, settings: EmailInboxSettings) {
    const response = await apiClient<EmailInbox>(inboxPath(senderId), {
        method: 'PUT',
        body: JSON.stringify(settings),
    });
    if (response.error) return failure(response);
    return { inbox: response.data };
}
