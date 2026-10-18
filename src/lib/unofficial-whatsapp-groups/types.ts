export type GroupOrigin = "managed" | "external";
export type GroupSort = "recent" | "oldest" | "name" | "name_desc" | "members";
export type MemberStatus = "active" | "left";
export type MemberRole = "member" | "admin" | "superadmin";
export type JoinStatus = "pending" | "running" | "done" | "failed" | "cancelled";
export type AnalysisStatus = "active" | "paused" | "archived";
export type AnalysisTrigger = "message_count" | "scheduled";
export type AnalysisSort = "recent" | "oldest" | "name" | "name_desc";
export type TrackedFieldType = "text" | "number" | "percentage" | "boolean";
export type RunKind = "cycle" | "daily";
export type RunStatus = "completed" | "failed";
export type RunSentiment = "positive" | "negative" | "neutral" | "mixed";
export type MentionSentiment = "positive" | "negative" | "neutral";
export type AlertLevel = "low" | "medium" | "high";
export type MembershipPeriod = "month" | "7d" | "30d" | "90d";
export type MembershipSort = "name" | "members" | "joins" | "leaves" | "churn" | "growth" | "net" | "messages";
export type MemberAction = "add" | "remove" | "promote" | "demote";
export type SetupStep = "description" | "admins_only" | "promote_numbers";
export type PausedReason = "repeated_failures";

export interface PageMeta {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export interface WorkspaceGroup {
  id: string;
  workspaceId: string;
  jid: string;
  subject: string;
  description?: string;
  origin: GroupOrigin;
  category?: string;
  announce: boolean;
  locked: boolean;
  memberCount: number;
  pictureUrl?: string;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
  primaryInstanceId?: string;
  seriesId?: string;
  seriesSequence?: number;
  followedAt?: string;
  membersSyncedAt?: string;
  lastActivityAt?: string;
}

export interface NumberSeat {
  instanceId: string;
  label: string;
  phone?: string;
  connected: boolean;
  admin: boolean;
  canPost: boolean;
}

export interface GroupActivity {
  messages: number;
  lastActivity?: string;
  joins: number;
  leaves: number;
}

export interface LabelCount {
  label: string;
  count: number;
}

export interface MentionTotal {
  entity: string;
  frequency: number;
  sentiments: Partial<Record<MentionSentiment, number>>;
  dominantSentiment: MentionSentiment;
}

export interface GroupSummary {
  sentiment: RunSentiment;
  positivity: number;
  cycles: number;
  messages: number;
  highAlertPct: number;
  themes: LabelCount[];
  mentions: MentionTotal[];
  lastRunAt?: string;
}

export interface GroupRow {
  group: WorkspaceGroup;
  numbers: NumberSeat[];
  activity: GroupActivity;
  summary?: GroupSummary;
  hasAnalysis: boolean;
  runningCampaigns: number;
}

export interface MemberCounts {
  active: number;
  left30d: number;
  withLead: number;
  hidden: number;
}

export interface DailyPoint {
  day: string;
  messages: number;
  activeGroups: number;
  joins: number;
  leaves: number;
  net: number;
}

export interface TrendPoint {
  cycle: number;
  at: string;
  positivity: number;
  messages: number;
  sentiment: RunSentiment;
  alert: AlertLevel;
  participants: number;
}

export interface ParticipantTotal {
  key: string;
  name: string;
  jid?: string;
  messages: number;
  sentiments: Partial<Record<RunSentiment, number>>;
}

export interface AnalysisOverview {
  cycles: number;
  completed: number;
  messages: number;
  alertCounts: Partial<Record<AlertLevel, number>>;
  sentimentCounts: Partial<Record<RunSentiment, number>>;
  dominantSentiment: RunSentiment;
  avgPositivity: number;
  highAlertPct: number;
  trend: TrendPoint[];
  themes: LabelCount[];
  mentions: MentionTotal[];
  participants: ParticipantTotal[];
  participantCount: number;
  suggestions: LabelCount[];
  lastRunAt?: string;
}

export interface Mention {
  entity: string;
  sentiment: MentionSentiment;
  frequency: number;
  context: string;
}

export interface ParticipantReading {
  name: string;
  jid: string;
  sentiment: RunSentiment;
  messages: number;
  summary: string;
  keyQuote: string;
}

export interface SuggestedAction {
  situation: string;
  strategy: string;
}

export interface AnalysisResult {
  summary: string;
  sentiment: RunSentiment;
  keyThemes: string[];
  relevantMentions: Mention[];
  participantSentiments: ParticipantReading[];
  insights: string[];
  suggestedActions: SuggestedAction[];
  alertLevel: AlertLevel;
  customFields: Record<string, string | number | boolean | null>;
}

export interface AnalysisRun {
  id: string;
  analysisId: string;
  workspaceId: string;
  groupId: string;
  cycle: number;
  kind: RunKind;
  status: RunStatus;
  messagesAnalyzed: number;
  periodFrom?: string;
  periodTo?: string;
  result?: AnalysisResult;
  model?: string;
  promptTokens: number;
  completionTokens: number;
  failureReason?: string;
  startedAt: string;
  completedAt: string;
}

export interface TrackedField {
  key: string;
  type: TrackedFieldType;
}

export interface GroupAnalysis {
  id: string;
  workspaceId: string;
  groupId: string;
  name: string;
  prompt: string;
  status: AnalysisStatus;
  trigger: AnalysisTrigger;
  messagesPerCycle: number;
  scheduleHour: number;
  scheduleMinute: number;
  trackedFields: TrackedField[];
  pendingMessages: number;
  failures: number;
  pausedReason?: PausedReason;
  analyzedUntil?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupAnalysisRow extends GroupAnalysis {
  groupSubject: string;
  runs: number;
}

export interface GroupDetail extends GroupRow {
  conversationId?: string;
  members: MemberCounts;
  growth: DailyPoint[];
  overview: AnalysisOverview;
  latestRun?: AnalysisRun;
  analyses: GroupAnalysisRow[];
  series: SeriesSibling[];
}

export interface SeriesSibling {
  groupId: string;
  subject: string;
  sequence: number;
  members: number;
}

export interface GroupRef {
  groupId: string;
  subject: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  workspaceId: string;
  personKey: string;
  jid: string;
  lid?: string;
  phone?: string;
  displayName?: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt?: string;
  leftAt?: string;
  leadId?: string;
  ourNumber: boolean;
  leadName?: string;
  contactName?: string;
  pictureUrl?: string;
  otherGroups: number;
}

export interface GroupPerson {
  personKey: string;
  name: string;
  phone?: string;
  jid: string;
  leadId?: string;
  leadName?: string;
  groupCount: number;
  groups: GroupRef[];
  lastJoinAt?: string;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface GroupTotals {
  groups: number;
  followed: number;
  open: number;
  closed: number;
  categories: CategoryCount[];
}

export interface GroupCount {
  groupId: string;
  subject: string;
  count: number;
}

export interface GroupGrowth {
  groupId: string;
  subject: string;
  joins: number;
  leaves: number;
  net: number;
}

export interface GroupSentiment {
  groupId: string;
  subject: string;
  positive: number;
  neutral: number;
  negative: number;
}

export interface ResponseTimePoint {
  day: string;
  avgMinutes: number;
  samples: number;
}

export interface GroupInsight {
  analysisId: string;
  analysisName: string;
  groupId: string;
  message: string;
  alertLevel: AlertLevel;
  createdAt: string;
}

export interface SentimentTally {
  positive: number;
  neutral: number;
  negative: number;
}

export interface GroupsDashboard {
  connections: { connected: number; total: number };
  groups: GroupTotals;
  people: { memberships: number; unique: number };
  analyses: { total: number; active: number };
  runs: { runs: number; messages: number; highAlerts: number };
  dailyVolume: DailyPoint[];
  topGroups: GroupCount[];
  sentiment: SentimentTally;
  sentimentByGroup: GroupSentiment[];
  responseTime: ResponseTimePoint[];
  growth: DailyPoint[];
  topGrowing: GroupGrowth[];
  insights: GroupInsight[];
  crossGroupPeople: GroupPerson[];
  crossGroupTotal: number;
  themes: ThemeAggregate[];
  timezone: string;
}

export interface MembershipStat {
  groupId: string;
  subject: string;
  origin: GroupOrigin;
  category?: string;
  numbers: number;
  members: number;
  startMembers: number;
  joins: number;
  leaves: number;
  net: number;
  churnRate: number | null;
  growthRate: number | null;
  messages: number;
  lastActivity?: string;
  lastMemberEventAt?: string;
}

export interface MembershipSummary {
  groups: number;
  startMembers: number;
  churnRate: number | null;
  growthRate: number | null;
  members: number;
  joins: number;
  leaves: number;
  net: number;
  messages: number;
}

export interface ThemeAggregate {
  theme: string;
  occurrences: number;
  lastSeenAt: string;
  groups: GroupRef[];
}

export interface JoinTask {
  id: string;
  planId: string;
  workspaceId: string;
  instanceId: string;
  inviteLink: string;
  groupJid?: string;
  sequence: number;
  follow: boolean;
  status: JoinStatus;
  attempts: number;
  error?: string;
  dueAt: string;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvitePreview {
  inviteLink: string;
  jid: string;
  subject: string;
  description?: string;
  members: number;
  announce: boolean;
  alreadyIn: string[];
}

export interface JoinResult {
  planId: string;
  group?: WorkspaceGroup;
  tasks: JoinTask[];
}

export interface DiscoverResult {
  numbers: number;
  groups: number;
  failed: string[];
}

export interface LeadLinkResult {
  linked: number;
  alreadyLinked: number;
  withoutPhone: number;
}

export interface GroupCampaign {
  campaignId: string;
  name: string;
  campaignStatus: string;
  instanceId: string;
  entryStatus: string;
  errorMessage?: string;
  sentAt?: string;
  createdAt: string;
}

export interface TranscriptLine {
  id: string;
  at: string;
  author: string;
  authorName?: string;
  text: string;
  outbound: boolean;
}

export interface AnalysisDetail {
  analysis: GroupAnalysis;
  group: WorkspaceGroup;
  overview: AnalysisOverview;
  participantGroups: Record<string, GroupRef[]>;
  windowDays: number;
  timezone: string;
}

export interface SetupWarning {
  step: SetupStep;
  reason: string;
}

export interface ManagedGroupResult {
  group: WorkspaceGroup;
  warnings: SetupWarning[];
}

export interface MembershipWindow {
  from: string;
  to: string;
  timezone: string;
}

export interface ListGroupsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  followed?: boolean;
  origin?: GroupOrigin;
  category?: string;
  instanceId?: string;
  adminsOnly?: boolean;
  hasAnalysis?: boolean;
  sort?: GroupSort;
}

export interface ListMembersParams {
  page?: number;
  pageSize?: number;
  status?: MemberStatus;
  adminsOnly?: boolean;
  search?: string;
  leadLinked?: boolean;
  inOtherOnly?: boolean;
}

export interface MembershipParams {
  period?: MembershipPeriod;
  origin?: GroupOrigin;
  category?: string;
  search?: string;
  sort?: MembershipSort;
  desc?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ListAnalysesParams {
  page?: number;
  pageSize?: number;
  status?: AnalysisStatus;
  trigger?: AnalysisTrigger;
  groupId?: string;
  search?: string;
  sort?: AnalysisSort;
}

export interface UpdateGroupPayload {
  applyToSeries?: boolean;
  category?: string;
  subject?: string;
  description?: string;
  imageUrl?: string;
  adminsOnlyMessages?: boolean;
  adminsOnlyEdit?: boolean;
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
  category?: string;
  instanceIds: string[];
  adminsOnly?: boolean;
  skipFollow?: boolean;
}

export interface JoinGroupPayload {
  inviteLink: string;
  instanceIds: string[];
  follow: boolean;
}

export interface AnalysisPayload {
  groupId: string;
  name: string;
  prompt: string;
  trigger: AnalysisTrigger;
  messagesPerCycle?: number;
  scheduleHour?: number;
  scheduleMinute?: number;
  trackedFields?: TrackedField[];
}

export type AnalysisPatch = Partial<Omit<AnalysisPayload, "groupId">> & { status?: AnalysisStatus };

export const JOIN_SPACING_MINUTES = 10;
export const MAX_MESSAGES_PER_CYCLE = 1000;
export const MAX_TRACKED_FIELDS = 20;
export const MAX_PROMPT_CHARS = 8000;
export const MAX_CATEGORY_CHARS = 60;
export const TRACKED_FIELD_KEY = /^[a-z][a-z0-9_]*$/;
