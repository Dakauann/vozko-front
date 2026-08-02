import type {
    ConnectTelegramPayload,
    CreateDeepLinkPayload,
    TelegramAccount,
    TelegramAccountListMeta,
    TelegramDeepLinkResult,
    UpdateTelegramAccountPayload,
} from '@/lib/telegram/types';

import { apiClient } from '@/lib/api/browser-client';

const DEFAULT_META: TelegramAccountListMeta = {
    page: 1,
    pageSize: 15,
    totalPages: 1,
    totalItems: 0,
};

interface ListApiResponse {
    data: TelegramAccount[];
    meta: TelegramAccountListMeta;
}

export async function listTelegramAccountsAction(page = 1, pageSize = 15, search?: string) {
    const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
    });
    if (search) params.set('search', search);

    const response = await apiClient<ListApiResponse>(`/telegram/accounts?${params.toString()}`, {
        method: 'GET',
    });

    if (response.error) {
        return { accounts: [] as TelegramAccount[], meta: DEFAULT_META, error: response.error.message };
    }
    return {
        accounts: response.data?.data ?? [],
        meta: response.data?.meta ?? DEFAULT_META,
    };
}

export async function getTelegramAccountAction(accountId: string) {
    const response = await apiClient<TelegramAccount>(`/telegram/accounts/${accountId}`, {
        method: 'GET',
    });
    if (response.error) return { error: response.error.message };
    return { account: response.data };
}

/**
 * Connects a bot.
 *
 * The whole flow is this one call: no OAuth, no popup, no callback. The token is
 * write-only — it is never returned by any endpoint afterwards — so a caller
 * that loses it must mint a new one in BotFather.
 */
export async function connectTelegramAccountAction(payload: ConnectTelegramPayload) {
    const response = await apiClient<TelegramAccount>('/telegram/accounts', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    if (response.error) return { error: response.error.message };
    return { account: response.data };
}

export async function updateTelegramAccountAction(
    accountId: string,
    payload: UpdateTelegramAccountPayload,
) {
    const response = await apiClient<TelegramAccount>(`/telegram/accounts/${accountId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    if (response.error) return { error: response.error.message };
    return { account: response.data };
}

export async function disconnectTelegramAccountAction(accountId: string) {
    const response = await apiClient<{ status: string }>(`/telegram/accounts/${accountId}`, {
        method: 'DELETE',
    });
    if (response.error) return { error: response.error.message };
    return { success: true };
}

/**
 * Re-points Telegram at our webhook.
 *
 * This is the repair action for the channel's worst failure. Undelivered updates
 * are discarded after 24 hours and there is no history API to recover them, so
 * an operator who sees a webhook warning needs a button, not a support ticket.
 */
export async function reregisterTelegramWebhookAction(accountId: string) {
    const response = await apiClient<TelegramAccount>(`/telegram/accounts/${accountId}/webhook`, {
        method: 'POST',
    });
    if (response.error) return { error: response.error.message };
    return { account: response.data };
}

export async function listTelegramDeepLinksAction(accountId: string, limit = 50) {
    const response = await apiClient<{ items: TelegramDeepLinkResult[] }>(
        `/telegram/accounts/${accountId}/deep-links?limit=${limit}`,
        { method: 'GET' },
    );
    if (response.error) return { links: [] as TelegramDeepLinkResult[], error: response.error.message };
    return { links: response.data?.items ?? [] };
}

export async function createTelegramDeepLinkAction(
    accountId: string,
    payload: CreateDeepLinkPayload,
) {
    const response = await apiClient<TelegramDeepLinkResult>(
        `/telegram/accounts/${accountId}/deep-links`,
        { method: 'POST', body: JSON.stringify(payload) },
    );
    if (response.error) return { error: response.error.message };
    return { link: response.data };
}

export async function deleteTelegramDeepLinkAction(accountId: string, token: string) {
    const response = await apiClient<{ status: string }>(
        `/telegram/accounts/${accountId}/deep-links/${encodeURIComponent(token)}`,
        { method: 'DELETE' },
    );
    if (response.error) return { error: response.error.message };
    return { success: true };
}
