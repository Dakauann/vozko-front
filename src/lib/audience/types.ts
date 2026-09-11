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
    subjectId: string;
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
    occurredAt: string;
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

    // ---- Conversation subjects ----
    //
    // A slice can hold both kinds now, so these two say how much of it each
    // block describes. Without them a reader cannot tell an all-comment slice
    // from one where every conversation happened to be unlabelled.
    commentCount: number;
    conversationCount: number;

    interestInterested: number;
    interestNotInterested: number;
    interestUndecided: number;

    dispositionSale: number;
    dispositionFillingInfo: number;
    dispositionCallback: number;
    dispositionDeclined: number;
    dispositionNoAnswer: number;
    dispositionVoicemail: number;
    dispositionPending: number;

    qualificationHotLead: number;
    qualificationWarmLead: number;
    qualificationColdLead: number;

    nextActionScheduleCallback: number;
    nextActionSendWhatsApp: number;
    nextActionClose: number;
    nextActionEscalate: number;
    nextActionContinue: number;

    // Averaged over analysed CONVERSATIONS only: comments carry no such score
    // and their zeros would drag a mixed slice toward nothing.
    attendanceQualityAvg: number;
    attendanceQualityMin: number;
    attendanceQualityMax: number;

    messagesTotal: number;
    messagesAvg: number;
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

/*
 * Who this person appears to be (§5), inferred from their own comments. There
 * is no bio on the comment edge; this is what they have said.
 *
 * The evidence travels WITH the label on purpose. A chip that said only
 * "político" would be a claim about a real member of the public; one that says
 * how confident we are and how many comments it read is an inference the
 * reader can weigh, which is the only form this is safe to show in.
 */
export type AuthorRole =
    | 'unknown'
    | 'politician'
    | 'journalist'
    | 'public_servant'
    | 'business_owner'
    | 'professional'
    | 'activist';

export const AUTHOR_ROLES: AuthorRole[] = [
    'unknown',
    'politician',
    'journalist',
    'public_servant',
    'business_owner',
    'professional',
    'activist',
];

export interface AuthorRoleInference {
    role: AuthorRole;
    /** The shared ordinal rubric, never a percentage. */
    confidence: QualityLevel;
    /** How many of the person's comments the inference read. */
    basedOnComments: number;
    /** One sentence in the model's words, so an operator can disagree. */
    rationale?: string;
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
    /**
     * Signed ledger: +1 a supporter comment, −0.5 a critic, −1 a hostile one,
     * with an extra −1 per high-severity comment. Negative means the author has
     * cost more than they gave. Computed in the domain, never in the UI.
     */
    reputation: number;
    role: AuthorRoleInference;
    /**
     * Whether the server considers the inference strong enough to show. The
     * UI must obey this rather than re-deriving the rule: the thresholds live
     * in the domain, and two answers to "is this safe to display" is one too
     * many.
     */
    roleDisplayable: boolean;
    isFlagged: boolean;
    moderationState: ModerationState;
    updatedAt: string;
}

/**
 * One post an author has commented on (§2).
 *
 * `comments` means COMMENTS. Likes and other interactions are not in the
 * webhook and are not stored, so nothing here may be labelled "interações".
 */
export interface AuthorContainer {
    source: CommentSource;
    accountId: string;
    containerId: string;

    comments: number;
    stanceSupporter: number;
    stanceNeutral: number;
    stanceCritic: number;
    stanceHostile: number;
    severityMax: number;
    severityHighCount: number;

    firstCommentedAt: string;
    lastCommentedAt: string;

    derivedStance: CommentStance;
    /** The same signed ledger as CommentAuthor.reputation, for this post alone. */
    reputation: number;
}

/** The author plus a page of their posts, so a panel heading and its list arrive together. */
export interface AuthorContainersPage {
    author: CommentAuthor;
    containers: AuthorContainer[];
    page: number;
    pageSize: number;
    total: number;
}

export interface CommentAuthorDetail {
    author: CommentAuthor;
    comments: AnalyzedComment[];
    page: number;
    pageSize: number;
    total: number;
}

/*
 * Forwarding a comment and answering it (§3, §6).
 */

/** One conversation a comment can be forwarded into. */
export interface EscalationRecipient {
    entryId: string;
    entryType: string;
    name?: string;
    number?: string;
    /** Whether a free-form message can reach them right now. Shown, not enforced. */
    windowOpen: boolean;
    lastMessageAt?: string;
}

/** What was actually sent, echoed back so the UI shows the real message. */
export interface EscalationResult {
    commentId: string;
    author: string;
    where: string;
    text: string;
    sentAt: string;
}

/**
 * What an account may say back. `auto` exists in the API but is refused by it
 * for now: this cut is suggest-only, so the UI must not offer it.
 */
export type ReplyMode = 'off' | 'suggest' | 'auto';

export const SELECTABLE_REPLY_MODES: ReplyMode[] = ['off', 'suggest'];

export interface ReplyPolicy {
    mode: ReplyMode;
    maxAutoSeverity: number;
}

export interface ReplySuggestion {
    commentId: string;
    text: string;
    model?: string;
    draftedAt: string;
    auto: boolean;
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
    replyPolicy: ReplyPolicy;
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
    replyPolicy?: ReplyPolicy;
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
    sort?: 'severity:desc' | 'severity:asc' | 'occurredAt:desc' | 'occurredAt:asc';
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
    commentCount: 0,
    conversationCount: 0,
    interestInterested: 0,
    interestNotInterested: 0,
    interestUndecided: 0,
    dispositionSale: 0,
    dispositionFillingInfo: 0,
    dispositionCallback: 0,
    dispositionDeclined: 0,
    dispositionNoAnswer: 0,
    dispositionVoicemail: 0,
    dispositionPending: 0,
    qualificationHotLead: 0,
    qualificationWarmLead: 0,
    qualificationColdLead: 0,
    nextActionScheduleCallback: 0,
    nextActionSendWhatsApp: 0,
    nextActionClose: 0,
    nextActionEscalate: 0,
    nextActionContinue: 0,
    attendanceQualityAvg: 0,
    attendanceQualityMin: 0,
    attendanceQualityMax: 0,
    messagesTotal: 0,
    messagesAvg: 0,
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

/*
 * Author ranking (§1). These keys mirror `domain/comment_analysis/author_sort.go`
 * one for one, and the API refuses anything else rather than defaulting, so a
 * typo here surfaces as a 400 instead of a silently different order.
 */
export const AUTHOR_SORT_KEYS = [
    'reputation',
    'comments',
    'negative',
    'positive',
    'severity',
    'lastSeen',
    'firstSeen',
] as const;

export type AuthorSortKey = (typeof AUTHOR_SORT_KEYS)[number];

export interface AuthorSort {
    key: AuthorSortKey;
    direction: 'asc' | 'desc';
}

/**
 * The table opens on the worst reputations, which is what the API does when no
 * sort is sent. Stated here too so the header renders its arrow on the first
 * paint instead of after the first click.
 */
export const DEFAULT_AUTHOR_SORT: AuthorSort = { key: 'reputation', direction: 'asc' };

/**
 * The direction a key opens on when it first becomes the sort: each one is the
 * direction that answers its own question. Reputation ascending puts the most
 * hostile first (a moderation table opens on who needs attention); the counts
 * and the dates open on "most" and "most recent".
 */
export const AUTHOR_SORT_FIRST_DIRECTION: Record<AuthorSortKey, 'asc' | 'desc'> = {
    reputation: 'asc',
    comments: 'desc',
    negative: 'desc',
    positive: 'desc',
    severity: 'desc',
    lastSeen: 'desc',
    firstSeen: 'desc',
};

/**
 * The orderable columns of the authors table, in table order.
 *
 * A column's key IS its API sort key and the suffix of its
 * `commentAnalysis.authors.columns.*` label, so a column cannot exist without
 * an ordering behind it or a label in front of it. Kept here rather than in the
 * component so the label coverage is testable without rendering React.
 */
export const AUTHOR_TABLE_COLUMNS: { key: AuthorSortKey; numeric?: boolean }[] = [
    { key: 'reputation', numeric: true },
    { key: 'comments', numeric: true },
    { key: 'positive', numeric: true },
    { key: 'negative', numeric: true },
    { key: 'severity' },
    { key: 'lastSeen' },
];

/*
 * Alerts: "quando passar de X, me manda um WhatsApp".
 *
 * The vocabulary mirrors `domain/comment_analysis/alert.go`, and the SERVER is
 * the authority on two things the UI must not re-derive: whether a metric needs
 * a window, and which direction it alarms in. Both arrive from
 * /audience/alerts/options so a picker cannot describe a metric
 * differently from the evaluator that acts on it.
 */

export type AlertMetric =
    | 'comment_severity'
    | 'high_severity_count'
    | 'hostile_count'
    | 'comment_volume'
    | 'acceptance_score';

export type AlertChannel = 'official' | 'unofficial';

export interface AlertRule {
    id: string;
    workspaceId: string;
    source: CommentSource;
    accountId: string;

    name: string;
    enabled: boolean;
    createdByUserId?: string;

    metric: AlertMetric;
    threshold: number;
    /** Only meaningful for a windowed metric; the server zeroes it otherwise. */
    windowMinutes: number;

    channel: AlertChannel;
    recipient: string;
    businessPhoneId?: string;
    templateId?: string;
    instanceId?: string;

    brief: boolean;
    cooldownMinutes: number;
    maxPerDay: number;

    /** The firing history is read-only: it is what the cooldown is checked against. */
    lastFiredAt?: string;
    firedToday: number;
    firedDay?: string;
    lastError?: string;

    createdAt: string;
    updatedAt: string;
}

/** The shape a client sends. The firing history is deliberately absent. */
export interface AlertRuleDraft {
    name: string;
    enabled: boolean;
    source?: CommentSource;
    accountId?: string;
    metric: AlertMetric;
    threshold: number;
    windowMinutes?: number;
    channel: AlertChannel;
    recipient: string;
    businessPhoneId?: string;
    templateId?: string;
    instanceId?: string;
    brief?: boolean;
    cooldownMinutes?: number;
    maxPerDay?: number;
}

export interface AlertMetricOption {
    metric: AlertMetric;
    windowed: boolean;
    triggersWhenBelow: boolean;
}

export interface AlertLimits {
    minCooldownMinutes: number;
    defaultCooldownMinutes: number;
    maxCooldownMinutes: number;
    defaultPerDay: number;
    maxPerDay: number;
    minWindowMinutes: number;
    defaultWindowMinutes: number;
    maxWindowMinutes: number;
    /**
     * How many facts an alert can supply. NOT a requirement on the template:
     * one that declares fewer gets the first few, one that declares more has
     * the rest padded, and one with no variables is fine.
     */
    templateParamCount: number;
}

/** One number a channel can send an alert from. */
export interface AlertSender {
    id: string;
    /** What the operator recognises. Never an internal id. */
    label: string;
}

/**
 * Whether THIS workspace can use a channel right now.
 *
 * `channels` above is the product vocabulary and says nothing about the tenant.
 * Serving only that was the bug: a workspace with no connected number was
 * offered the unofficial channel, accepted it, and armed a rule that could
 * never fire.
 */
export interface AlertChannelStatus {
    channel: AlertChannel;
    available: boolean;
    /** Stable key to translate: "no_sender" or "not_enabled". */
    reason?: string;
    senders: AlertSender[];
}

export interface AlertVocabulary {
    metrics: AlertMetricOption[];
    channels: AlertChannel[];
    /**
     * Narrows `channels` to what this workspace can actually do. Empty when the
     * deployment wired no directory, in which case the picker falls back to
     * `channels` exactly as it did before.
     */
    channelStatus?: AlertChannelStatus[];
    limits: AlertLimits;
    /**
     * What an alert can put into a template's variables, in the order a
     * positional template is filled. A named template is matched by these keys.
     */
    facts: string[];
}
