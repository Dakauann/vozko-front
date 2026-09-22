import type {
    CreateInstagramMediaPayload,
    InstagramAccount,
    InstagramAccountListMeta,
    InstagramComment,
    InstagramMedia,
    InstagramPage,
    UpdateInstagramAccountPayload,
    InstagramCommentRule,
    CommentRulePayload,
} from '@/lib/instagram/types';

import { apiClient, getApiBaseUrl } from '@/lib/api/browser-client';
import { withWorkspaceScope } from '@/lib/browser/scoped-download-url';

const DEFAULT_META: InstagramAccountListMeta = {
    page: 1,
    pageSize: 15,
    totalPages: 1,
    totalItems: 0,
};

interface ListApiResponse {
    data: InstagramAccount[];
    meta: InstagramAccountListMeta;
}

export async function listInstagramAccountsAction(page = 1, pageSize = 15, search?: string) {
    const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
    });
    if (search) params.set('search', search);

    const response = await apiClient<ListApiResponse>(`/instagram/accounts?${params.toString()}`, {
        method: 'GET',
    });

    if (response.error) {
        return { accounts: [] as InstagramAccount[], meta: DEFAULT_META, error: response.error.message };
    }
    return {
        accounts: response.data?.data ?? [],
        meta: response.data?.meta ?? DEFAULT_META,
    };
}

export async function getInstagramAccountAction(accountId: string) {
    const response = await apiClient<InstagramAccount>(`/instagram/accounts/${accountId}`, {
        method: 'GET',
    });
    if (response.error) return { error: response.error.message };
    return { account: response.data };
}

export async function updateInstagramAccountAction(
    accountId: string,
    payload: UpdateInstagramAccountPayload,
) {
    const response = await apiClient<InstagramAccount>(`/instagram/accounts/${accountId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    if (response.error) return { error: response.error.message };
    return { account: response.data };
}

export async function disconnectInstagramAccountAction(accountId: string) {
    const response = await apiClient<{ status: string }>(`/instagram/accounts/${accountId}`, {
        method: 'DELETE',
    });
    if (response.error) return { error: response.error.message };
    return { ok: true };
}

export function instagramConnectUrl(returnPath?: string): string {
    const params = new URLSearchParams({ redirect: '1' });
    if (returnPath) params.set('returnPath', returnPath);
    return `${getApiBaseUrl()}/oauth/instagram/start?${params.toString()}`;
}


export async function listInstagramMediaAction(accountId: string, after?: string, limit = 24) {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (after) params.set('after', after);

    const response = await apiClient<InstagramPage<InstagramMedia>>(
        `/instagram/accounts/${accountId}/media?${params.toString()}`,
        { method: 'GET' },
    );
    if (response.error) {
        return { page: { items: [], hasNext: false } as InstagramPage<InstagramMedia>, error: response.error.message };
    }
    return { page: response.data ?? { items: [], hasNext: false } };
}

export async function getInstagramMediaAction(accountId: string, mediaId: string) {
    const response = await apiClient<InstagramMedia>(
        `/instagram/accounts/${accountId}/media/${mediaId}`,
        { method: 'GET' },
    );
    if (response.error) return { error: response.error.message };
    return { media: response.data };
}

export async function createInstagramMediaAction(
    accountId: string,
    payload: CreateInstagramMediaPayload,
) {
    const response = await apiClient<InstagramMedia>(`/instagram/accounts/${accountId}/media`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    if (response.error) return { error: response.error.message };
    return { media: response.data };
}

export async function setInstagramCommentEnabledAction(
    accountId: string,
    mediaId: string,
    commentEnabled: boolean,
) {
    const response = await apiClient<{ commentEnabled: boolean }>(
        `/instagram/accounts/${accountId}/media/${mediaId}`,
        { method: 'PATCH', body: JSON.stringify({ commentEnabled }) },
    );
    if (response.error) return { error: response.error.message };
    return { commentEnabled: response.data?.commentEnabled ?? commentEnabled };
}

export function instagramAssetUrl(accountId: string, mediaId: string, thumb = false): string {
    const suffix = thumb ? '?thumb=1' : '';
    return withWorkspaceScope(
        `${getApiBaseUrl()}/instagram/accounts/${accountId}/media/${mediaId}/asset${suffix}`,
    );
}

export function instagramAvatarUrl(accountId: string): string {
    return withWorkspaceScope(`${getApiBaseUrl()}/instagram/accounts/${accountId}/avatar`);
}


export async function listInstagramCommentsAction(
    accountId: string,
    mediaId: string,
    after?: string,
    limit = 50,
) {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (after) params.set('after', after);

    const response = await apiClient<InstagramPage<InstagramComment>>(
        `/instagram/accounts/${accountId}/media/${mediaId}/comments?${params.toString()}`,
        { method: 'GET' },
    );
    if (response.error) {
        return {
            page: { items: [], hasNext: false } as InstagramPage<InstagramComment>,
            error: response.error.message,
        };
    }
    return { page: response.data ?? { items: [], hasNext: false } };
}

export async function replyInstagramCommentAction(
    accountId: string,
    commentId: string,
    message: string,
) {
    const response = await apiClient<{ id: string }>(
        `/instagram/accounts/${accountId}/comments/${commentId}/replies`,
        { method: 'POST', body: JSON.stringify({ message }) },
    );
    if (response.error) return { error: response.error.message };
    return { id: response.data?.id };
}

export async function hideInstagramCommentAction(
    accountId: string,
    commentId: string,
    hidden: boolean,
) {
    const response = await apiClient<{ hidden: boolean }>(
        `/instagram/accounts/${accountId}/comments/${commentId}/hide`,
        { method: 'POST', body: JSON.stringify({ hidden }) },
    );
    if (response.error) return { error: response.error.message };
    return { hidden: response.data?.hidden ?? hidden };
}

export async function deleteInstagramCommentAction(accountId: string, commentId: string) {
    const response = await apiClient<{ status: string }>(
        `/instagram/accounts/${accountId}/comments/${commentId}`,
        { method: 'DELETE' },
    );
    if (response.error) return { error: response.error.message };
    return { ok: true };
}

export async function privateReplyInstagramCommentAction(
    accountId: string,
    commentId: string,
    text: string,
) {
    const response = await apiClient<{ status: string }>(
        `/instagram/accounts/${accountId}/comments/${commentId}/private-reply`,
        { method: 'POST', body: JSON.stringify({ text }) },
    );
    if (response.error) {
        return { error: response.error.message, code: response.error.code };
    }
    return { ok: true };
}


export async function listCommentRulesAction(accountId: string) {
    const response = await apiClient<InstagramCommentRule[]>(
        `/instagram/accounts/${accountId}/comment-rules`,
        { method: 'GET' },
    );
    if (response.error) return { rules: [] as InstagramCommentRule[], error: response.error.message };
    return { rules: response.data ?? [] };
}

export async function createCommentRuleAction(accountId: string, payload: CommentRulePayload) {
    const response = await apiClient<InstagramCommentRule>(
        `/instagram/accounts/${accountId}/comment-rules`,
        { method: 'POST', body: JSON.stringify(payload) },
    );
    if (response.error) return { error: response.error.message };
    return { rule: response.data };
}

export async function updateCommentRuleAction(
    accountId: string,
    ruleId: string,
    payload: CommentRulePayload,
) {
    const response = await apiClient<InstagramCommentRule>(
        `/instagram/accounts/${accountId}/comment-rules/${ruleId}`,
        { method: 'PUT', body: JSON.stringify(payload) },
    );
    if (response.error) return { error: response.error.message };
    return { rule: response.data };
}

export async function deleteCommentRuleAction(accountId: string, ruleId: string) {
    const response = await apiClient<{ status: string }>(
        `/instagram/accounts/${accountId}/comment-rules/${ruleId}`,
        { method: 'DELETE' },
    );
    if (response.error) return { error: response.error.message };
    return { ok: true };
}
