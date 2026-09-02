/**
 * Comment analysis types.
 *
 * These mirror `delivery/http/commentanalysis/dto.go`. Stored values are
 * English slugs on both sides; the UI translates every enum label in all four
 * locales (see `i18n/messages/*.json` under `commentAnalysis.enums`), and the
 * slugs never reach the screen untranslated.
 *
 * Two derived numbers are never model-produced and never computed here:
 * `severity` (0-100, from three ordinal dimensions) and `acceptanceScore`
 * (from the stance mix, damped for small samples). Both are computed in the
 * back-end domain so a chart and the number above it cannot disagree.
 */

export type CommentSource = 'instagram';

export type CommentAnalysisStatus = 'pending' | 'in_flight' | 'analyzed' | 'failed' | 'skipped';

export type CommentSentiment = 'positive' | 'neutral' | 'negative';
export type CommentStance = 'supporter' | 'neutral' | 'critic' | 'hostile';
export type CommentIntent =
    | 'praise'
    | 'question'
    | 'complaint'
    | 'support_request'
    | 'spam'
    | 'sales_lead'
    | 'other';
export type QualityLevel = 'none' | 'low' | 'medium' | 'high';
export type ModerationState = 'none' | 'watched' | 'muted' | 'blocked';
export type Vertical = 'gov' | 'retail' | 'services';
export type RollupScope = 'account' | 'container' | 'topic';
export type BackfillStatus = 'pending' | 'running' | 'done' | 'failed' | 'canceled';

export const COMMENT_SENTIMENTS: CommentSentiment[] = ['positive', 'neutral', 'negative'];
export const COMMENT_STANCES: CommentStance[] = ['supporter', 'neutral', 'critic', 'hostile'];
export const COMMENT_INTENTS: CommentIntent[] = [
    'praise',
    'question',
    'complaint',
    'support_request',
    'spam',
    'sales_lead',
    'other',
];
export const MODERATION_STATES: ModerationState[] = ['none', 'watched', 'muted', 'blocked'];
export const VERTICALS: Vertical[] = ['gov', 'retail', 'services'];

/** The severity from which a comment counts as "high" (mirrors the domain). */
export const HIGH_SEVERITY_THRESHOLD = 60;

export interface AnalyzedComment {
    id: string;
    source: CommentSource;
    accountId: string;
    containerId: string;
    sourceCommentId: string;
    parentCommentId?: string;

    authorExternalId: string;
    authorHandle?: string;

    status: CommentAnalysisStatus;
    attempts: number;
    failureReason?: string;

    sentiment?: CommentSentiment;
    stance?: CommentStance;
    intent?: CommentIntent;
    topicKey?: string;
    isSpam: boolean;
    language?: string;

    toxicity?: QualityLevel;
    personalAttack?: QualityLevel;
    legalRisk?: QualityLevel;
    severity: number;
    requiresAction: boolean;

    excerpt: string;
    truncated: boolean;

    model?: string;
    analyzedAt?: string;
    commentedAt: string;
    createdAt: string;
}

/** The §11.1 counters, flattened onto stats, trend points and authors. */
export interface CommentCounters {
    total: number;
    analyzed: number;
    pending: number;
    inFlight: number;
    failed: number;
    skipped: number;

    sentimentPositive: number;
    sentimentNeutral: number;
    sentimentNegative: number;

    stanceSupporter: number;
    stanceNeutral: number;
    stanceCritic: number;
    stanceHostile: number;

    intentPraise: number;
    intentQuestion: number;
    intentComplaint: number;
    intentSupportRequest: number;
    intentSpam: number;
    intentSalesLead: number;
    intentOther: number;

    spamCount: number;

    severityAvg: number;
    severityMax: number;
    severityHighCount: number;

    requiresActionCount: number;

    distinctAuthors: number;
    flaggedAuthors: number;
}

export interface TopicStat {
    topicKey: string;
    count: number;
    sentimentPositive: number;
    sentimentNeutral: number;
    sentimentNegative: number;
    severityAvg: number;
}

export interface CommentAnalysisStats extends CommentCounters {
    topics: TopicStat[];
    acceptanceScore: number;
}

export interface TrendPoint extends CommentCounters {
    /** YYYY-MM-DD, UTC calendar day. */
    bucketDate: string;
    acceptanceScore: number;
}

export interface TopicCount {
    topicKey: string;
    count: number;
}

export interface CommentAuthor {
    id: string;
    source: CommentSource;
    accountId: string;
    authorExternalId: string;
    authorHandle?: string;
    firstSeenAt: string;
    lastSeenAt: string;
    counters: CommentCounters;
    topTopics: TopicCount[];
    derivedStance: CommentStance;
    isFlagged: boolean;
    moderationState: ModerationState;
    updatedAt: string;
}

export interface CommentAuthorDetail {
    author: CommentAuthor;
    comments: AnalyzedComment[];
    page: number;
    pageSize: number;
    total: number;
}

export interface CommentTopic {
    key: string;
    label: string;
    description?: string;
}

export interface CommentAnalysisSettings {
    source: CommentSource;
    accountId: string;
    enabled: boolean;
    model?: string;
    vertical: Vertical;
    topics: CommentTopic[];
    severityThreshold: number;
    dailyCap: number;
    /** Free text the classifier reads as operator context (who the account is, what to watch for). */
    instructions?: string;
    updatedAt: string;
}

/** PATCH-shaped: absent fields are untouched. */
export interface CommentAnalysisSettingsPatch {
    enabled?: boolean;
    model?: string;
    vertical?: Vertical;
    topics?: CommentTopic[];
    severityThreshold?: number;
    dailyCap?: number;
    instructions?: string;
}

export interface CommentAnalysisSpend {
    batches: number;
    items: number;
    promptTokens: number;
    completionTokens: number;
    /** USD micros, like every price in the product. */
    priceMicros: number;
}

export interface BackfillEstimate {
    containers: number;
    estimatedComments: number;
    /** USD micros; 0 when the per-comment surcharge is not configured. */
    estimatedMicros: number;
}

export interface CommentBackfill {
    id: string;
    source: CommentSource;
    accountId: string;
    containerId?: string;
    status: BackfillStatus;
    estimatedComments: number;
    fetched: number;
    enqueued: number;
    /** 0..1 */
    progress: number;
    error?: string;
    createdAt: string;
    updatedAt: string;
    finishedAt?: string;
}

export interface CommentListFilters {
    accountId: string;
    containerId?: string;
    status?: CommentAnalysisStatus[];
    topic?: string;
    stance?: CommentStance;
    sentiment?: CommentSentiment;
    intent?: CommentIntent;
    severityMin?: number;
    severityMax?: number;
    requiresAction?: boolean;
    authorExternalId?: string;
    /** ISO date or date-time. */
    from?: string;
    to?: string;
    sort?: 'severity:desc' | 'severity:asc' | 'commentedAt:desc' | 'commentedAt:asc';
    page?: number;
    pageSize?: number;
}

export interface PaginatedMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export const EMPTY_META: PaginatedMeta = { page: 1, pageSize: 20, totalPages: 0, totalItems: 0 };

/** Empty counters, so a panel can render zeros before its first load. */
export const EMPTY_COUNTERS: CommentCounters = {
    total: 0,
    analyzed: 0,
    pending: 0,
    inFlight: 0,
    failed: 0,
    skipped: 0,
    sentimentPositive: 0,
    sentimentNeutral: 0,
    sentimentNegative: 0,
    stanceSupporter: 0,
    stanceNeutral: 0,
    stanceCritic: 0,
    stanceHostile: 0,
    intentPraise: 0,
    intentQuestion: 0,
    intentComplaint: 0,
    intentSupportRequest: 0,
    intentSpam: 0,
    intentSalesLead: 0,
    intentOther: 0,
    spamCount: 0,
    severityAvg: 0,
    severityMax: 0,
    severityHighCount: 0,
    requiresActionCount: 0,
    distinctAuthors: 0,
    flaggedAuthors: 0,
};

/**
 * A post's own settings. Every field is optional; an absent (or null) field
 * means "inherit from the account". The back-end deletes an override whose
 * fields are all absent, so "inherit everything" and "no override" are the
 * same state.
 */
export interface CommentContainerOverride {
    source: CommentSource;
    accountId: string;
    containerId: string;
    enabled?: boolean | null;
    model?: string | null;
    topics?: CommentTopic[] | null;
    severityThreshold?: number | null;
    instructions?: string | null;
    updatedAt: string;
}

/** What the engine will actually use for a post: the account's settings with the override layered on. */
export interface CommentContainerSettings {
    override: CommentContainerOverride | null;
    effective: CommentAnalysisSettings;
}

/** PUT-shaped: the whole override is replaced; a null field inherits. */
export interface CommentContainerOverridePut {
    enabled: boolean | null;
    model: string | null;
    topics: CommentTopic[] | null;
    severityThreshold: number | null;
    instructions: string | null;
}

/** Mirrors the domain's MaxInstructionsRunes. */
export const MAX_INSTRUCTIONS_LENGTH = 2000;
