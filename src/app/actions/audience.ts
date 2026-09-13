import type {
    AlertRule,
    AlertRuleDraft,
    AlertVocabulary,
    AnalyzedComment,
    AuthorContainersPage,
    AuthorSort,
    EscalationRecipient,
    EscalationResult,
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
    AudienceSource,
    CommentSource,
    CommentStance,
    ModerationState,
    PaginatedMeta,
    ReplySuggestion,
    RollupScope,
    TrendPoint,
} from '@/lib/audience/types';
import { EMPTY_COUNTERS, EMPTY_META } from '@/lib/audience/types';

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
    if (f.subjectId) params.set("subjectId", f.subjectId);
    if (f.latestOnly) params.set("latestOnly", "true");
    if (f.accountId) params.set("accountId", f.accountId);
    if (f.source) params.set("source", f.source);
    if (f.subjectKind?.length) params.set("subjectKind", f.subjectKind.join(","));
    if (f.interest) params.set("interest", f.interest);
    if (f.disposition) params.set("disposition", f.disposition);
    if (f.qualification) params.set("qualification", f.qualification);
    if (f.nextAction) params.set("nextAction", f.nextAction);
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
        `/audience?${filtersToParams(filters).toString()}`,
        { method: 'GET' },
    );
    if (response.error) {
        return { items: [] as AnalyzedComment[], meta: EMPTY_META, error: response.error.message };
    }
    return { items: response.data?.data ?? [], meta: response.data?.meta ?? EMPTY_META };
}

export async function getCommentAnalysisStatsAction(filters: CommentListFilters) {
    const response = await apiClient<CommentAnalysisStats>(
        `/audience/stats?${filtersToParams(filters).toString()}`,
        { method: 'GET' },
    );
    if (response.error) return { error: response.error.message };
    return {
        stats: response.data ?? { ...EMPTY_COUNTERS, topics: [], subjects: [], acceptanceScore: 50 },
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
    const response = await apiClient<TrendPoint[]>(`/audience/trends?${params.toString()}`, {
        method: 'GET',
    });
    if (response.error) return { points: [] as TrendPoint[], error: response.error.message };
    return { points: response.data ?? [] };
}

/** Daily activity for workspace-wide and mixed channel/type audience views. */
export async function getAudienceTrendsAction(filters: CommentListFilters) {
    const response = await apiClient<TrendPoint[]>(
        `/audience/trends?${filtersToParams(filters).toString()}`,
        { method: 'GET' },
    );
    if (response.error) return { points: [] as TrendPoint[], error: response.error.message };
    return { points: response.data ?? [] };
}

export async function listCommentAuthorsAction(input: {
    accountId: string;
    flaggedOnly?: boolean;
    stance?: CommentStance;
    moderation?: ModerationState;
    minComments?: number;
    /** Resolves an @ seen in the feed to its author row (§2). */
    authorExternalId?: string;
    /**
     * The window, as instants. Sending one switches the server from the
     * lifetime projection to regrouping the comments themselves, so the
     * standing it returns describes the window rather than all time.
     */
    from?: string;
    to?: string;
    sort?: AuthorSort;
    page?: number;
    pageSize?: number;
}) {
    const params = new URLSearchParams({ accountId: input.accountId });
    if (input.flaggedOnly) params.set('flagged', 'true');
    if (input.stance) params.set('stance', input.stance);
    if (input.moderation) params.set('moderation', input.moderation);
    if (input.minComments) params.set('minComments', String(input.minComments));
    if (input.authorExternalId) params.set('authorExternalId', input.authorExternalId);
    if (input.from) params.set('from', input.from);
    if (input.to) params.set('to', input.to);
    if (input.sort) {
        params.set('sort', input.sort.key);
        params.set('order', input.sort.direction);
    }
    if (input.page) params.set('page', String(input.page));
    if (input.pageSize) params.set('pageSize', String(input.pageSize));
    const response = await apiClient<PaginatedResponse<CommentAuthor>>(
        `/audience/authors?${params.toString()}`,
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
        `/audience/authors/${authorId}?${params.toString()}`,
        { method: 'GET' },
    );
    if (response.error) return { error: response.error.message };
    return { detail: response.data };
}

export async function listAuthorContainersAction(
    authorId: string,
    page = 1,
    pageSize = 20,
    range?: { from?: string; to?: string },
) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (range?.from) params.set('from', range.from);
    if (range?.to) params.set('to', range.to);
    const response = await apiClient<AuthorContainersPage>(
        `/audience/authors/${authorId}/containers?${params.toString()}`,
        { method: 'GET' },
    );
    if (response.error) return { error: response.error.message };
    return { result: response.data };
}

/**
 * Who a comment can be forwarded to: conversations this workspace already has
 * open. Deliberately not "any number" — forwarding is not cold outbound.
 */
export async function listEscalationRecipientsAction(query = '', limit = 20) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (query.trim()) params.set('query', query.trim());
    const response = await apiClient<EscalationRecipient[]>(
        `/audience/escalation-recipients?${params.toString()}`,
        { method: 'GET' },
    );
    if (response.error) return { recipients: [] as EscalationRecipient[], error: response.error.message };
    return { recipients: response.data ?? [] };
}

export async function escalateCommentAction(
    commentId: string,
    recipient: { entryId: string; entryType: string },
    note?: string,
) {
    const response = await apiClient<EscalationResult>(`/audience/${commentId}/escalate`, {
        method: 'POST',
        body: JSON.stringify({
            recipientId: recipient.entryId,
            recipientKind: recipient.entryType,
            note: note?.trim() || undefined,
        }),
    });
    if (response.error) return { error: response.error.message };
    return { result: response.data };
}

/** Drafts an answer. Drafting never posts. */
export async function suggestCommentReplyAction(commentId: string) {
    const response = await apiClient<ReplySuggestion>(`/audience/${commentId}/reply/suggest`, {
        method: 'POST',
    });
    if (response.error) return { error: response.error.message };
    return { suggestion: response.data };
}

/** Publishes the operator's text. Nothing re-drafts at send time. */
export async function postCommentReplyAction(commentId: string, text: string) {
    const response = await apiClient<ReplySuggestion>(`/audience/${commentId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ text }),
    });
    if (response.error) return { error: response.error.message };
    return { reply: response.data };
}

export async function setCommentAuthorModerationAction(authorId: string, state: ModerationState) {
    const response = await apiClient<CommentAuthor>(`/audience/authors/${authorId}`, {
        method: 'PATCH',
        body: JSON.stringify({ state }),
    });
    if (response.error) return { error: response.error.message };
    return { author: response.data };
}

export async function getCommentAnalysisSettingsAction(source: CommentSource, accountId: string) {
    const response = await apiClient<CommentAnalysisSettings>(
        `/audience/settings/${source}/${accountId}`,
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
        `/audience/settings/${source}/${accountId}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
    );
    if (response.error) return { error: response.error.message };
    return { settings: response.data };
}

export async function retryAnalyzedCommentAction(id: string) {
    const response = await apiClient<AnalyzedComment>(`/audience/${id}/retry`, {
        method: 'POST',
    });
    if (response.error) return { error: response.error.message };
    return { comment: response.data };
}

export async function getCommentAnalysisSpendAction(accountId: string, days?: number) {
    const params = new URLSearchParams({ accountId });
    if (days) params.set('days', String(days));
    const response = await apiClient<CommentAnalysisSpend>(
        `/audience/spend?${params.toString()}`,
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
        `/audience/backfill/${source}/${accountId}/estimate${query ? `?${query}` : ''}`,
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
    const response = await apiClient<CommentBackfill>(`/audience/backfill/${source}/${accountId}`, {
        method: 'POST',
        body: JSON.stringify({ confirmedEstimate, containerId: containerId ?? '' }),
    });
    if (response.error) return { error: response.error.message, code: response.error.code };
    return { backfill: response.data };
}

export async function getCommentBackfillAction(id: string) {
    const response = await apiClient<CommentBackfill>(`/audience/backfill/${id}`, {
        method: 'GET',
    });
    if (response.error) return { error: response.error.message };
    return { backfill: response.data };
}

export async function cancelCommentBackfillAction(id: string) {
    const response = await apiClient<CommentBackfill>(`/audience/backfill/${id}/cancel`, {
        method: 'POST',
    });
    if (response.error) return { error: response.error.message };
    return { backfill: response.data };
}

// ---- accounts and per-post settings ----

/** Every account of the workspace with analysis settings (enabled or not). */
export async function listCommentAnalysisAccountsAction() {
    const response = await apiClient<CommentAnalysisSettings[]>('/audience/settings', {
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
        `/audience/settings/${source}/${accountId}/containers/${containerId}`,
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
        `/audience/settings/${source}/${accountId}/containers/${containerId}`,
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
        `/audience/settings/${source}/${accountId}/containers/${containerId}`,
        { method: 'DELETE' },
    );
    if (response.error) return { error: response.error.message };
    return { settings: response.data };
}

/*
 * Alert rules. Every one of these is gated on `audience:send`, because
 * arming an automated sender is granting sends.
 */

/**
 * The account's alert rules, every channel unless one is named.
 *
 * The source defaulted to 'instagram', from when comments were the only thing
 * analysed. That turned "list this account's rules" into "list its Instagram
 * rules", so a conversation rule, and any rule watching ALL channels, was
 * filtered out of its own page and the screen read "nenhum alerta configurado"
 * with two rules sitting in the table. Omitting it now means no filter, which
 * is what the server already does with an empty source.
 */
export async function listAlertRulesAction(accountId?: string, source?: AudienceSource) {
    const params = new URLSearchParams();
    if (source) params.set('source', source);
    if (accountId) params.set('accountId', accountId);
    const response = await apiClient<AlertRule[]>(`/audience/alerts?${params.toString()}`, {
        method: 'GET',
    });
    if (response.error) return { rules: [] as AlertRule[], error: response.error.message };
    return { rules: response.data ?? [] };
}

export async function getAlertOptionsAction() {
    const response = await apiClient<AlertVocabulary>('/audience/alerts/options', { method: 'GET' });
    if (response.error) return { error: response.error.message };
    return { options: response.data };
}

export async function createAlertRuleAction(draft: AlertRuleDraft) {
    const response = await apiClient<AlertRule>('/audience/alerts', {
        method: 'POST',
        body: JSON.stringify(draft),
    });
    if (response.error) return { error: response.error.message };
    return { rule: response.data };
}

export async function updateAlertRuleAction(id: string, draft: AlertRuleDraft) {
    const response = await apiClient<AlertRule>(`/audience/alerts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(draft),
    });
    if (response.error) return { error: response.error.message };
    return { rule: response.data };
}

export async function deleteAlertRuleAction(id: string) {
    const response = await apiClient<void>(`/audience/alerts/${id}`, { method: 'DELETE' });
    if (response.error) return { error: response.error.message };
    return {};
}

/** Sends one alert now. It does not consume the rule's cooldown or daily cap. */
export async function testAlertRuleAction(id: string) {
    const response = await apiClient<void>(`/audience/alerts/${id}/test`, { method: 'POST' });
    if (response.error) return { error: response.error.message };
    return {};
}

/*
 * The audience surface: the same rows, not narrowed to comments.
 *
 * /audience pins itself to comments so those screens keep showing what
 * they always did. /audience serves every subject kind, which is what a view
 * called "audience" has to mean now that conversations live in the same engine.
 */
export async function getAudienceStatsAction(filters: CommentListFilters) {
    const response = await apiClient<CommentAnalysisStats>(
        `/audience/stats?${filtersToParams(filters).toString()}`,
        { method: 'GET' },
    );
    if (response.error) return { error: response.error.message };
    return {
        stats: response.data ?? { ...EMPTY_COUNTERS, topics: [], subjects: [], acceptanceScore: 50 },
    };
}

/**
 * How much of the workspace's rolling analysis budget is spent.
 *
 * Its own call rather than a field on stats: the budget belongs to the
 * workspace, not to the filtered slice, so folding it into stats would return
 * the same number several times per page load and imply it varied by filter.
 * One cheap read, once per load.
 */
export interface AudienceUsage {
    used: number;
    limit: number;
    /** When the oldest counted analysis leaves the window, so room frees up. */
    oldestAt?: string;
    /**
     * How much is queued and not yet classified, workspace-wide.
     *
     * The number that makes the other two actionable. Reaching the ceiling never
     * discards work, it postpones it, so a limit set too low shows up as a queue
     * that stops draining and nowhere else.
     */
    waiting: number;
}

export async function getAudienceUsageAction(): Promise<{
    usage: AudienceUsage | null;
    error?: string;
}> {
    const response = await apiClient<AudienceUsage>("/audience/usage", { method: "GET" });
    if (response.error) {
        return { usage: null, error: response.error.message };
    }
    return { usage: response.data ?? null };
}

/**
 * What the workspace decides about its own analysis.
 *
 * Both values are as STORED, where 0 means "never set". The screen needs that
 * to tell an unset window from one somebody deliberately set to five minutes,
 * so the resolved number rides along separately rather than replacing it.
 */
export interface AudienceWorkspaceSettings {
    dailyCap: number;
    debounceMinutes: number;
    /**
     * The values actually IN FORCE, resolved by the server.
     *
     * The ceiling falls back through the workspace, then the channel accounts,
     * then the product default. Resolving that here would be a second copy of
     * the rule, free to disagree with the engine that enforces it.
     */
    effectiveDailyCap: number;
    effectiveDebounceMinutes: number;
    minDebounceMinutes: number;
    maxDebounceMinutes: number;
}

export async function getAudienceWorkspaceSettingsAction(): Promise<{
    settings: AudienceWorkspaceSettings | null;
    error?: string;
}> {
    const response = await apiClient<AudienceWorkspaceSettings>("/audience/workspace-settings", { method: "GET" });
    if (response.error) {
        return { settings: null, error: response.error.message };
    }
    return { settings: response.data ?? null };
}

/**
 * Change the ceiling, the quiet period, or both.
 *
 * A partial update: an omitted field is left alone, so the two controls on the
 * budget panel never overwrite each other. Workspace-wide by design, because the
 * budget is counted per workspace and the sweep is keyed on it.
 */
export async function updateAudienceWorkspaceSettingsAction(
    input: { dailyCap?: number; debounceMinutes?: number },
): Promise<{ settings: AudienceWorkspaceSettings | null; error?: string }> {
    const response = await apiClient<AudienceWorkspaceSettings>("/audience/workspace-settings", {
        method: "PUT",
        body: JSON.stringify(input),
    });
    if (response.error) {
        return { settings: null, error: response.error.message };
    }
    return { settings: response.data ?? null };
}
