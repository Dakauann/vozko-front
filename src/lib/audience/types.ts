
export type CommentSource = 'instagram';

export type SubjectKind = "comment" | "conversation";

export type AudienceSource =
    | "instagram"
    | "whatsapp"
    | "telegram"
    | "unofficial_whatsapp";

export type ConversationInterest = "interested" | "not_interested" | "undecided";
export type ConversationDisposition = "sale" | "filling_info" | "callback" | "declined" | "pending";
export type ConversationQualification = "hot_lead" | "warm_lead" | "cold_lead";
export type ConversationNextAction = "schedule_callback" | "send_whatsapp" | "close" | "escalate" | "continue";

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

export const HIGH_SEVERITY_THRESHOLD = 60;

export interface AnalyzedComment {
    id: string;
    subjectKind?: SubjectKind;
    source: AudienceSource;
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

    interest?: ConversationInterest;
    productInterest?: string;
    disposition?: ConversationDisposition;
    qualification?: ConversationQualification;
    nextAction?: ConversationNextAction;
    summary?: string;
    attendanceQuality?: number;
    messageCount?: number;

    model?: string;
    analyzedAt?: string;
    occurredAt: string;
    createdAt: string;
}

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

    commentCount: number;
    conversationCount: number;
    conversationAnalyzed: number;
    lastAnalyzedAt?: string;

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

export interface SubjectCount {
    key: string;
    label: string;
    count: number;
}

export interface CommentAnalysisStats extends CommentCounters {
    topics: TopicStat[];
    subjects: SubjectCount[];
    acceptanceScore: number;
}

export interface TrendPoint extends CommentCounters {
    bucketDate: string;
    acceptanceScore: number;
}

export interface TopicCount {
    topicKey: string;
    count: number;
}

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
    confidence: QualityLevel;
    basedOnComments: number;
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
    reputation: number;
    role: AuthorRoleInference;
    roleDisplayable: boolean;
    isFlagged: boolean;
    moderationState: ModerationState;
    updatedAt: string;
}

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
    reputation: number;
}

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


export interface EscalationRecipient {
    entryId: string;
    entryType: string;
    name?: string;
    number?: string;
    windowOpen: boolean;
    lastMessageAt?: string;
}

export interface EscalationResult {
    commentId: string;
    author: string;
    where: string;
    text: string;
    sentAt: string;
}

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
    instructions?: string;
    replyPolicy: ReplyPolicy;
    updatedAt: string;
}

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
    priceMicros: number;
}

export interface BackfillEstimate {
    containers: number;
    estimatedComments: number;
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
    progress: number;
    error?: string;
    createdAt: string;
    updatedAt: string;
    finishedAt?: string;
}

export const AUDIENCE_SOURCES: AudienceSource[] = [
    "instagram",
    "whatsapp",
    "telegram",
    "unofficial_whatsapp",
];

export interface CommentListFilters {
    subjectId?: string;
    latestOnly?: boolean;
    accountId?: string;
    source?: AudienceSource | "";
    subjectKind?: SubjectKind[];
    containerId?: string;
    interest?: string;
    disposition?: string;
    qualification?: string;
    nextAction?: string;
    status?: CommentAnalysisStatus[];
    topic?: string;
    stance?: CommentStance;
    sentiment?: CommentSentiment;
    intent?: CommentIntent;
    severityMin?: number;
    severityMax?: number;
    requiresAction?: boolean;
    authorExternalId?: string;
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
    conversationAnalyzed: 0,
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

export interface CommentContainerSettings {
    override: CommentContainerOverride | null;
    effective: CommentAnalysisSettings;
}

export interface CommentContainerOverridePut {
    enabled: boolean | null;
    model: string | null;
    topics: CommentTopic[] | null;
    severityThreshold: number | null;
    instructions: string | null;
}

export const MAX_INSTRUCTIONS_LENGTH = 2000;

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

export const DEFAULT_AUTHOR_SORT: AuthorSort = { key: 'reputation', direction: 'asc' };

export const AUTHOR_SORT_FIRST_DIRECTION: Record<AuthorSortKey, 'asc' | 'desc'> = {
    reputation: 'asc',
    comments: 'desc',
    negative: 'desc',
    positive: 'desc',
    severity: 'desc',
    lastSeen: 'desc',
    firstSeen: 'desc',
};

export const AUTHOR_TABLE_COLUMNS: { key: AuthorSortKey; numeric?: boolean }[] = [
    { key: 'reputation', numeric: true },
    { key: 'comments', numeric: true },
    { key: 'positive', numeric: true },
    { key: 'negative', numeric: true },
    { key: 'severity' },
    { key: 'lastSeen' },
];


export type AlertMetric =
    | 'comment_severity'
    | 'high_severity_count'
    | 'hostile_count'
    | 'comment_volume'
    | 'acceptance_score'
    | 'attendance_quality'
    | 'escalation_count';

export type AlertChannel = 'official' | 'unofficial';

export interface AlertRule {
    id: string;
    workspaceId: string;
    source: AudienceSource;
    accountId: string;

    name: string;
    enabled: boolean;
    createdByUserId?: string;

    metric: AlertMetric;
    threshold: number;
    windowMinutes: number;
    minMessages: number;

    channel: AlertChannel;
    recipient: string;
    businessPhoneId?: string;
    templateId?: string;
    instanceId?: string;

    brief: boolean;
    cooldownMinutes: number;
    maxPerDay: number;

    lastFiredAt?: string;
    firedToday: number;
    firedDay?: string;
    lastError?: string;

    createdAt: string;
    updatedAt: string;
}

export interface AlertRuleDraft {
    name: string;
    enabled: boolean;
    source?: AudienceSource;
    accountId?: string;
    metric: AlertMetric;
    threshold: number;
    windowMinutes?: number;
    minMessages?: number;
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
    subjectKind: SubjectKind;
    supportsMinMessages: boolean;
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
    maxMinMessages: number;
    templateParamCount: number;
}

export interface AlertSender {
    id: string;
    label: string;
}

export interface AlertChannelStatus {
    channel: AlertChannel;
    available: boolean;
    reason?: string;
    senders: AlertSender[];
}

export interface AlertVocabulary {
    metrics: AlertMetricOption[];
    channels: AlertChannel[];
    channelStatus?: AlertChannelStatus[];
    limits: AlertLimits;
    facts: string[];
}
