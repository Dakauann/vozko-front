import type {
    CreateFacebookPostPayload,
    FacebookComment,
    FacebookCommentFilter,
    FacebookCommentRule,
    FacebookCommentRulePayload,
    FacebookList,
    FacebookPage,
    FacebookPageListMeta,
    FacebookPageStatus,
    FacebookPost,
    FacebookPostListKind,
    FacebookPrivateReplyResult,
    FacebookPublishJob,
    FacebookStory,
    FacebookThreadState,
    MessengerProfile,
    UpdateFacebookPostPayload,
} from '@/lib/facebook/types';

import type { FacebookPageConfig } from '@/lib/facebook/page';
import { apiClient, getApiBaseUrl, type ApiResult } from '@/lib/api/browser-client';
import { withWorkspaceScope } from '@/lib/browser/scoped-download-url';

export interface FacebookActionError {
    error: string;
    code?: string;
    status?: number;
    expected?: Record<string, string>;
}

const DEFAULT_META: FacebookPageListMeta = {
    page: 1,
    pageSize: 15,
    totalPages: 1,
    totalItems: 0,
};

const EMPTY_LIST = { items: [], hasNext: false };

function failure(result: ApiResult<unknown>): FacebookActionError {
    return {
        error: result.error?.message ?? 'Request failed',
        code: result.error?.code,
        status: result.error?.status,
        expected: result.error?.expected,
    };
}

function pagePath(pageId: string): string {
    return `/facebook/pages/${pageId}`;
}

interface PageListResponse {
    data: FacebookPage[];
    meta: FacebookPageListMeta;
}

export async function listFacebookPagesAction(
    page = 1,
    pageSize = 15,
    search?: string,
    status?: FacebookPageStatus,
) {
    const params = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() });
    if (search) params.set('search', search);
    if (status) params.set('status', status);

    const response = await apiClient<PageListResponse>(`/facebook/pages?${params.toString()}`, { method: 'GET' });
    if (response.error) {
        return { pages: [] as FacebookPage[], meta: DEFAULT_META, ...failure(response) };
    }
    return { pages: response.data?.data ?? [], meta: response.data?.meta ?? DEFAULT_META };
}

export async function getFacebookPageAction(pageId: string) {
    const response = await apiClient<FacebookPage>(pagePath(pageId), { method: 'GET' });
    if (response.error) return failure(response);
    return { page: response.data };
}

export async function updateFacebookPageAction(pageId: string, config: FacebookPageConfig) {
    const response = await apiClient<FacebookPage>(pagePath(pageId), {
        method: 'PUT',
        body: JSON.stringify(config),
    });
    if (response.error) return failure(response);
    return { account: response.data };
}

export async function disconnectFacebookPageAction(pageId: string) {
    const response = await apiClient<{ status: string; warning?: string }>(pagePath(pageId), { method: 'DELETE' });
    if (response.error) return failure(response);
    return { ok: true as const, warning: response.data?.warning || undefined };
}

export async function checkFacebookPageHealthAction(pageId: string) {
    const response = await apiClient<FacebookPage>(`${pagePath(pageId)}/health-check`, { method: 'POST' });
    if (response.error) return failure(response);
    return { page: response.data };
}

export function facebookConnectUrl(returnPath?: string): string {
    const params = new URLSearchParams({ redirect: '1' });
    if (returnPath) params.set('returnPath', returnPath);
    return `${getApiBaseUrl()}/oauth/facebook/start?${params.toString()}`;
}

export async function listFacebookPostsAction(
    pageId: string,
    kind: FacebookPostListKind = 'published',
    after?: string,
    limit = 24,
) {
    const params = new URLSearchParams({ kind, limit: limit.toString() });
    if (after) params.set('after', after);
    const response = await apiClient<FacebookList<FacebookPost>>(`${pagePath(pageId)}/posts?${params.toString()}`, {
        method: 'GET',
    });
    if (response.error) return { list: EMPTY_LIST as FacebookList<FacebookPost>, ...failure(response) };
    return { list: response.data ?? (EMPTY_LIST as FacebookList<FacebookPost>) };
}

export async function listFacebookStoriesAction(pageId: string) {
    const response = await apiClient<{ items: FacebookStory[] }>(`${pagePath(pageId)}/stories`, { method: 'GET' });
    if (response.error) return { stories: [] as FacebookStory[], ...failure(response) };
    return { stories: response.data?.items ?? [] };
}

export async function getFacebookPostAction(pageId: string, postId: string) {
    const response = await apiClient<FacebookPost>(`${pagePath(pageId)}/posts/${postId}`, { method: 'GET' });
    if (response.error) return failure(response);
    return { post: response.data };
}

export async function createFacebookPostAction(pageId: string, payload: CreateFacebookPostPayload) {
    const response = await apiClient<FacebookPublishJob>(`${pagePath(pageId)}/posts`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    if (response.error) return failure(response);
    return { job: response.data };
}

export async function updateFacebookPostAction(pageId: string, postId: string, payload: UpdateFacebookPostPayload) {
    const response = await apiClient<{ ok: boolean }>(`${pagePath(pageId)}/posts/${postId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
    if (response.error) return failure(response);
    return { ok: true as const };
}

export async function deleteFacebookPostAction(pageId: string, postId: string) {
    const response = await apiClient<{ ok: boolean }>(`${pagePath(pageId)}/posts/${postId}`, { method: 'DELETE' });
    if (response.error) return failure(response);
    return { ok: true as const };
}

export async function getFacebookPublishJobAction(pageId: string, jobId: string) {
    const response = await apiClient<FacebookPublishJob>(`${pagePath(pageId)}/publish-jobs/${jobId}`, {
        method: 'GET',
    });
    if (response.error) return failure(response);
    return { job: response.data };
}

export function facebookPostAssetUrl(pageId: string, postId: string, variant: 'full' | 'thumb' = 'full'): string {
    return withWorkspaceScope(
        `${getApiBaseUrl()}${pagePath(pageId)}/posts/${encodeURIComponent(postId)}/asset?variant=${variant}`,
    );
}

export async function listFacebookCommentsAction(
    pageId: string,
    postId: string,
    after?: string,
    limit = 50,
    filter: FacebookCommentFilter = 'stream',
) {
    const params = new URLSearchParams({ filter, limit: limit.toString() });
    if (after) params.set('after', after);
    const response = await apiClient<FacebookList<FacebookComment>>(
        `${pagePath(pageId)}/posts/${postId}/comments?${params.toString()}`,
        { method: 'GET' },
    );
    if (response.error) return { list: EMPTY_LIST as FacebookList<FacebookComment>, ...failure(response) };
    return { list: response.data ?? (EMPTY_LIST as FacebookList<FacebookComment>) };
}

export async function commentOnFacebookPostAction(pageId: string, postId: string, message: string) {
    const response = await apiClient<{ id: string }>(`${pagePath(pageId)}/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ message }),
    });
    if (response.error) return failure(response);
    return { id: response.data?.id };
}

export async function replyFacebookCommentAction(pageId: string, commentId: string, message: string) {
    const response = await apiClient<{ id: string }>(`${pagePath(pageId)}/comments/${commentId}/replies`, {
        method: 'POST',
        body: JSON.stringify({ message }),
    });
    if (response.error) return failure(response);
    return { id: response.data?.id };
}

export async function editFacebookCommentAction(pageId: string, commentId: string, message: string) {
    const response = await apiClient<{ ok: boolean }>(`${pagePath(pageId)}/comments/${commentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ message }),
    });
    if (response.error) return failure(response);
    return { ok: true as const };
}

export async function hideFacebookCommentAction(pageId: string, commentId: string, hidden: boolean) {
    const response = await apiClient<{ ok: boolean }>(`${pagePath(pageId)}/comments/${commentId}/hide`, {
        method: 'POST',
        body: JSON.stringify({ hidden }),
    });
    if (response.error) return failure(response);
    return { hidden };
}

export async function likeFacebookCommentAction(pageId: string, commentId: string, liked: boolean) {
    const response = await apiClient<{ ok: boolean }>(`${pagePath(pageId)}/comments/${commentId}/like`, {
        method: 'POST',
        body: JSON.stringify({ liked }),
    });
    if (response.error) return failure(response);
    return { liked };
}

export async function deleteFacebookCommentAction(pageId: string, commentId: string) {
    const response = await apiClient<{ ok: boolean }>(`${pagePath(pageId)}/comments/${commentId}`, {
        method: 'DELETE',
    });
    if (response.error) return failure(response);
    return { ok: true as const };
}

export async function privateReplyFacebookCommentAction(pageId: string, commentId: string, text: string) {
    const response = await apiClient<FacebookPrivateReplyResult>(
        `${pagePath(pageId)}/comments/${commentId}/private-reply`,
        { method: 'POST', body: JSON.stringify({ text }) },
    );
    if (response.error) return failure(response);
    return { ok: true as const, conversationId: response.data?.conversationId };
}

export async function listFacebookCommentRulesAction(pageId: string) {
    const response = await apiClient<FacebookCommentRule[]>(`${pagePath(pageId)}/comment-rules`, { method: 'GET' });
    if (response.error) return { rules: [] as FacebookCommentRule[], ...failure(response) };
    return { rules: response.data ?? [] };
}

export async function createFacebookCommentRuleAction(pageId: string, payload: FacebookCommentRulePayload) {
    const response = await apiClient<FacebookCommentRule>(`${pagePath(pageId)}/comment-rules`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    if (response.error) return failure(response);
    return { rule: response.data };
}

export async function updateFacebookCommentRuleAction(
    pageId: string,
    ruleId: string,
    payload: FacebookCommentRulePayload,
) {
    const response = await apiClient<FacebookCommentRule>(`${pagePath(pageId)}/comment-rules/${ruleId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    if (response.error) return failure(response);
    return { rule: response.data };
}

export async function deleteFacebookCommentRuleAction(pageId: string, ruleId: string) {
    const response = await apiClient<{ ok: boolean }>(`${pagePath(pageId)}/comment-rules/${ruleId}`, {
        method: 'DELETE',
    });
    if (response.error) return failure(response);
    return { ok: true as const };
}

export async function getMessengerProfileAction(pageId: string) {
    const response = await apiClient<MessengerProfile>(`${pagePath(pageId)}/messenger-profile`, { method: 'GET' });
    if (response.error) return failure(response);
    return { profile: response.data };
}

export async function updateMessengerProfileAction(pageId: string, profile: MessengerProfile) {
    const response = await apiClient<MessengerProfile>(`${pagePath(pageId)}/messenger-profile`, {
        method: 'PUT',
        body: JSON.stringify(profile),
    });
    if (response.error) return failure(response);
    return { profile: response.data ?? profile };
}

export async function getFacebookThreadStateAction(conversationId: string) {
    const response = await apiClient<FacebookThreadState>(`/facebook/conversations/${conversationId}/thread`, {
        method: 'GET',
    });
    if (response.error) return failure(response);
    return { thread: response.data };
}

export async function takeFacebookThreadControlAction(conversationId: string) {
    const response = await apiClient<{ ok: boolean; threadOwnerAppId?: string }>(
        `/facebook/conversations/${conversationId}/take-control`,
        { method: 'POST' },
    );
    if (response.error) return failure(response);
    return { ok: true as const, threadOwnerAppId: response.data?.threadOwnerAppId };
}

export async function releaseFacebookThreadControlAction(conversationId: string) {
    const response = await apiClient<{ ok: boolean }>(`/facebook/conversations/${conversationId}/release-control`, {
        method: 'POST',
    });
    if (response.error) return failure(response);
    return { ok: true as const };
}
