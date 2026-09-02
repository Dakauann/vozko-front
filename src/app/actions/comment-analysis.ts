import type {
    AnalyzedComment,
    BackfillEstimate,
    CommentAnalysisSettings,
    CommentAnalysisSettingsPatch,
    CommentAnalysisSpend,
    CommentAnalysisStats,
    CommentAuthor,
    CommentAuthorDetail,
    CommentBackfill,
    CommentContainerOverridePut,
    CommentContainerSettings,
    CommentListFilters,
    CommentSource,
    CommentStance,
    ModerationState,
    PaginatedMeta,
    RollupScope,
    TrendPoint,
} from '@/lib/comment-analysis/types';
import { EMPTY_COUNTERS, EMPTY_META } from '@/lib/comment-analysis/types';

import { apiClient } from '@/lib/api/browser-client';

// Thin apiClient wrappers in the shape of app/actions/analysis.ts: defaulted
// empty results, `{ data, error }`, never a thrown error reaching a component.
// The workspace is never sent; the API scopes every read to the session.

interface PaginatedResponse<T> {
    data: T[];
    meta: PaginatedMeta;
}

function filtersToParams(f: CommentListFilters): URLSearchParams {
    const params = new URLSearchParams();
    params.set('accountId', f.accountId);
    if (f.containerId) params.set('containerId', f.containerId);
    if (f.status?.length) params.set('status', f.status.join(','));
    if (f.topic) params.set('topic', f.topic);
    if (f.stance) params.set('stance', f.stance);
    if (f.sentiment) params.set('sentiment', f.sentiment);
    if (f.intent) params.set('intent', f.intent);
    if (f.severityMin !== undefined) params.set('severityMin', String(f.severityMin));
    if (f.severityMax !== undefined) params.set('severityMax', String(f.severityMax));
    if (f.requiresAction !== undefined) params.set('requiresAction', String(f.requiresAction));
    if (f.authorExternalId) params.set('authorExternalId', f.authorExternalId);
    if (f.from) params.set('from', f.from);
    if (f.to) params.set('to', f.to);
    if (f.sort) params.set('sort', f.sort);
    if (f.page) params.set('page', String(f.page));
    if (f.pageSize) params.set('pageSize', String(f.pageSize));
    return params;
}

export async function listAnalyzedCommentsAction(filters: CommentListFilters) {
    const response = await apiClient<PaginatedResponse<AnalyzedComment>>(
        `/comment-analysis?${filtersToParams(filters).toString()}`,
        { method: 'GET' },
    );
    if (response.error) {
        return { items: [] as AnalyzedComment[], meta: EMPTY_META, error: response.error.message };
    }
    return { items: response.data?.data ?? [], meta: response.data?.meta ?? EMPTY_META };
}

export async function getCommentAnalysisStatsAction(filters: CommentListFilters) {
    const response = await apiClient<CommentAnalysisStats>(
        `/comment-analysis/stats?${filtersToParams(filters).toString()}`,
        { method: 'GET' },
    );
    if (response.error) return { error: response.error.message };
    return {
        stats: response.data ?? { ...EMPTY_COUNTERS, topics: [], acceptanceScore: 50 },
    };
}

export async function getCommentAnalysisTrendsAction(
    scope: RollupScope,
    scopeId: string,
    from?: string,
    to?: string,
) {
    const params = new URLSearchParams({ scope, scopeId });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const response = await apiClient<TrendPoint[]>(`/comment-analysis/trends?${params.toString()}`, {
        method: 'GET',
    });
    if (response.error) return { points: [] as TrendPoint[], error: response.error.message };
    return { points: response.data ?? [] };
}

export async function listCommentAuthorsAction(input: {
    accountId: string;
    flaggedOnly?: boolean;
    stance?: CommentStance;
    moderation?: ModerationState;
    minComments?: number;
    page?: number;
    pageSize?: number;
}) {
    const params = new URLSearchParams({ accountId: input.accountId });
    if (input.flaggedOnly) params.set('flagged', 'true');
    if (input.stance) params.set('stance', input.stance);
    if (input.moderation) params.set('moderation', input.moderation);
    if (input.minComments) params.set('minComments', String(input.minComments));
    if (input.page) params.set('page', String(input.page));
    if (input.pageSize) params.set('pageSize', String(input.pageSize));
    const response = await apiClient<PaginatedResponse<CommentAuthor>>(
        `/comment-analysis/authors?${params.toString()}`,
        { method: 'GET' },
    );
    if (response.error) {
        return { items: [] as CommentAuthor[], meta: EMPTY_META, error: response.error.message };
    }
    return { items: response.data?.data ?? [], meta: response.data?.meta ?? EMPTY_META };
}

export async function getCommentAuthorAction(authorId: string, page = 1, pageSize = 20) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    const response = await apiClient<CommentAuthorDetail>(
        `/comment-analysis/authors/${authorId}?${params.toString()}`,
        { method: 'GET' },
    );
    if (response.error) return { error: response.error.message };
    return { detail: response.data };
}

export async function setCommentAuthorModerationAction(authorId: string, state: ModerationState) {
    const response = await apiClient<CommentAuthor>(`/comment-analysis/authors/${authorId}`, {
        method: 'PATCH',
        body: JSON.stringify({ state }),
    });
    if (response.error) return { error: response.error.message };
    return { author: response.data };
}

export async function getCommentAnalysisSettingsAction(source: CommentSource, accountId: string) {
    const response = await apiClient<CommentAnalysisSettings>(
        `/comment-analysis/settings/${source}/${accountId}`,
        { method: 'GET' },
    );
    if (response.error) return { error: response.error.message };
    return { settings: response.data };
}

export async function updateCommentAnalysisSettingsAction(
    source: CommentSource,
    accountId: string,
    patch: CommentAnalysisSettingsPatch,
) {
    const response = await apiClient<CommentAnalysisSettings>(
        `/comment-analysis/settings/${source}/${accountId}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
    );
    if (response.error) return { error: response.error.message };
    return { settings: response.data };
}

export async function retryAnalyzedCommentAction(id: string) {
    const response = await apiClient<AnalyzedComment>(`/comment-analysis/${id}/retry`, {
        method: 'POST',
    });
    if (response.error) return { error: response.error.message };
    return { comment: response.data };
}

export async function getCommentAnalysisSpendAction(accountId: string, days?: number) {
    const params = new URLSearchParams({ accountId });
    if (days) params.set('days', String(days));
    const response = await apiClient<CommentAnalysisSpend>(
        `/comment-analysis/spend?${params.toString()}`,
        { method: 'GET' },
    );
    if (response.error) return { error: response.error.message };
    return { spend: response.data };
}

export async function estimateCommentBackfillAction(
    source: CommentSource,
    accountId: string,
    containerId?: string,
) {
    const params = new URLSearchParams();
    if (containerId) params.set('containerId', containerId);
    const query = params.toString();
    const response = await apiClient<BackfillEstimate>(
        `/comment-analysis/backfill/${source}/${accountId}/estimate${query ? `?${query}` : ''}`,
        { method: 'GET' },
    );
    if (response.error) return { error: response.error.message };
    return { estimate: response.data };
}

export async function startCommentBackfillAction(
    source: CommentSource,
    accountId: string,
    confirmedEstimate: number,
    containerId?: string,
) {
    const response = await apiClient<CommentBackfill>(`/comment-analysis/backfill/${source}/${accountId}`, {
        method: 'POST',
        body: JSON.stringify({ confirmedEstimate, containerId: containerId ?? '' }),
    });
    if (response.error) return { error: response.error.message, code: response.error.code };
    return { backfill: response.data };
}

export async function getCommentBackfillAction(id: string) {
    const response = await apiClient<CommentBackfill>(`/comment-analysis/backfill/${id}`, {
        method: 'GET',
    });
    if (response.error) return { error: response.error.message };
    return { backfill: response.data };
}

export async function cancelCommentBackfillAction(id: string) {
    const response = await apiClient<CommentBackfill>(`/comment-analysis/backfill/${id}/cancel`, {
        method: 'POST',
    });
    if (response.error) return { error: response.error.message };
    return { backfill: response.data };
}

// ---- accounts and per-post settings ----

/** Every account of the workspace with analysis settings (enabled or not). */
export async function listCommentAnalysisAccountsAction() {
    const response = await apiClient<CommentAnalysisSettings[]>('/comment-analysis/settings', {
        method: 'GET',
    });
    if (response.error) return { accounts: [] as CommentAnalysisSettings[], error: response.error.message };
    return { accounts: response.data ?? [] };
}

export async function getCommentContainerSettingsAction(
    source: CommentSource,
    accountId: string,
    containerId: string,
) {
    const response = await apiClient<CommentContainerSettings>(
        `/comment-analysis/settings/${source}/${accountId}/containers/${containerId}`,
        { method: 'GET' },
    );
    if (response.error) return { error: response.error.message };
    return { settings: response.data };
}

export async function putCommentContainerSettingsAction(
    source: CommentSource,
    accountId: string,
    containerId: string,
    override: CommentContainerOverridePut,
) {
    const response = await apiClient<CommentContainerSettings>(
        `/comment-analysis/settings/${source}/${accountId}/containers/${containerId}`,
        { method: 'PUT', body: JSON.stringify(override) },
    );
    if (response.error) return { error: response.error.message };
    return { settings: response.data };
}

/** Removes the post's own settings; it inherits the account's again. */
export async function deleteCommentContainerSettingsAction(
    source: CommentSource,
    accountId: string,
    containerId: string,
) {
    const response = await apiClient<CommentContainerSettings>(
        `/comment-analysis/settings/${source}/${accountId}/containers/${containerId}`,
        { method: 'DELETE' },
    );
    if (response.error) return { error: response.error.message };
    return { settings: response.data };
}
