import type {
  AdBid,
  AdBudget,
  AdCreativeDraftV2,
  AdDayPart,
  AdDraftDestination,
  AdDraftTargeting,
  AdIdentity,
  AdObjective,
  AdOptimizationGoal,
  AdPlacements,
  MetaAdDraft,
} from "@/lib/advertising/draft-types";

export type AdLevel = "campaign" | "adset" | "ad";

export type AdConnection = "CONNECTED" | "NEEDS_RECONNECT" | "DISCONNECTED";

export type AdMetaStatus =
  | "active"
  | "disabled"
  | "unsettled"
  | "pending_risk_review"
  | "pending_settlement"
  | "in_grace_period"
  | "pending_closure"
  | "closed"
  | "unknown";

export type AdDelivery =
  | "active"
  | "scheduled"
  | "completed"
  | "off"
  | "campaign_off"
  | "adset_off"
  | "in_review"
  | "rejected"
  | "with_issues"
  | "pending_billing"
  | "archived"
  | "deleted"
  | "unknown";

export type AdAccountRole = "admin" | "advertiser" | "read_only";

export interface AdBudgetMinimum {
  field?: string;
  daily: number;
  currency: string;
}

export interface AdAccount {
  id: string;
  metaAccountId: string;
  name: string;
  businessName?: string;
  currency: string;
  timezone: string;
  metaStatus: AdMetaStatus | string;
  connection: AdConnection | string;
  hasFunding: boolean;
  canSpend: boolean;
  canManage: boolean;
  canSetSpendCap: boolean;
  role: AdAccountRole | string;
  spendBlocker?: string;
  lastSyncedAt?: string;
  spendCap?: number | null;
  amountSpent?: number | null;
}

export type AdReadinessKey =
  | "connection"
  | "advertiser_role"
  | "account_status"
  | "account_details"
  | "payment_method"
  | "page"
  | "phone_verification"
  | "email_verification"
  | "custom_audience_terms"
  | "pixel";

export type AdReadinessState = "ready" | "missing" | "unknown";

export type AdInAppAction = "reconnect" | "sync" | "create_pixel" | "link_whatsapp" | "connect_whatsapp";

export interface AdReadinessAction {
  kind: "in_app" | "portal" | string;
  key?: AdInAppAction | string;
  url?: string;
}

export interface AdReadinessItem {
  key: AdReadinessKey | string;
  state: AdReadinessState | string;
  required: boolean;
  action?: AdReadinessAction;
}

export interface AdBilling {
  portalUrl?: string;
  paymentMethod?: string;
  balance: number;
  prepay: boolean;
}

export interface AdReadiness {
  account: AdAccount;
  ready: boolean;
  blocking: string[];
  items: AdReadinessItem[];
  billing?: AdBilling;
}

export interface AdMetrics {
  currency: string;
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  results: number;
  resultAction: string;
  mixedResults: boolean;
  costPerResult: number | null;
  conversations: number;
  costPerConversation: number | null;
  cpc: number | null;
  cpm: number | null;
  ctr: number | null;
}

export interface AdOutcome {
  conversations: number;
  leads: number;
  wonDeals: number;
  revenue: number;
  costPerConversation: number | null;
  costPerLead: number | null;
  roas: number | null;
}

export interface AdCreative {
  title?: string;
  body?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
}

export interface AdIssue {
  code: number;
  summary: string;
  message: string;
  level: string;
}

export interface AdRow {
  metaId: string;
  level: AdLevel;
  name: string;
  campaignId?: string;
  adSetId?: string;
  status: string;
  effectiveStatus: string;
  delivery: AdDelivery | string;
  isOn: boolean;
  canToggle: boolean;
  objective?: string;
  optimizationGoal?: string;
  destinationType?: string;
  dailyBudget: number;
  lifetimeBudget: number;
  startTime?: string;
  endTime?: string;
  creative?: AdCreative;
  issues: AdIssue[] | null;
  reviewFeedback?: Record<string, string>;
  metrics: AdMetrics;
  outcome: AdOutcome;
}

export interface AdRange {
  since: string;
  until: string;
}

export interface AdPeriod {
  range: AdRange;
  totals: AdMetrics;
  outcome: AdOutcome;
}

export interface AdReport {
  account: AdAccount;
  range: AdRange;
  level: AdLevel;
  totals: AdMetrics;
  outcome: AdOutcome;
  rows: AdRow[] | null;
  previous?: AdPeriod | null;
}

export interface AdTrendPoint {
  day: string;
  spend: number;
  impressions: number;
  linkClicks: number;
  results: number;
  conversations: number;
}

export interface AdTrend {
  currency: string;
  range: AdRange;
  points: AdTrendPoint[] | null;
}

export interface AdNumber {
  kind: string;
  label: string;
  number: string;
}

export type AdPageChannel = "advertise" | "whatsapp" | "instagram" | "messenger" | "lead_forms";

export interface AdPageCapability {
  channel: AdPageChannel;
  state: "ready" | "missing" | string;
  action?: AdReadinessAction;
}

export interface AdNumberLinkStart {
  status: "code_sent" | "linked";
  page?: AdPage;
}

export interface AdPage {
  pageId: string;
  name: string;
  pictureUrl?: string;
  whatsAppNumber?: string;
  instagramUserId?: string;
  instagramUsername?: string;
  canAdvertise: boolean;
  leadTermsAccepted: boolean;
  numbers: AdNumber[] | null;
  linkable?: AdNumber[] | null;
  capabilities?: AdPageCapability[];
}

export type AdLocationKind = "country" | "region" | "city";

export interface AdLocation {
  kind: AdLocationKind;
  key: string;
  name: string;
  region?: string;
  country?: string;
}

export type AdJobStatus = "QUEUED" | "RUNNING" | "PUBLISHED" | "FAILED" | "NEEDS_REVIEW";

export interface AdJobProgress {
  media?: Record<string, string>;
  campaignId?: string;
  adSetId?: string;
  creatives?: Record<string, string>;
  ads?: Record<string, string>;
  activated?: boolean;
  inFlight?: string;
}

export interface AdPublishJob {
  id: string;
  adAccountId: string;
  campaignName: string;
  status: AdJobStatus | string;
  progress: AdJobProgress;
  fee: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdConversationOrigin {
  adId: string;
  adName: string;
  adSetName?: string;
  campaignName?: string;
  accountName: string;
  currency: string;
  day: string;
  daySpend: number;
  dayConversations: number;
  estimatedLeadCost: number | null;
}

export type MetaAdsConnectStatus = "connected" | "partial" | "error" | "cancelled";

export interface MetaAdsConnectResult {
  status: MetaAdsConnectStatus;
  reason?: string;
  count?: number;
}

export type AdEditableObject = {
  row: AdRow;
  budget: AdBudget | null;
  bid: AdBid | null;
  targeting: AdDraftTargeting | null;
  placements: AdPlacements | null;
  schedule: AdDayPart[] | null;
  creative: AdCreativeDraftV2 | null;
  identity: AdIdentity | null;
};

export interface AdObjectEdit {
  name?: string;
  budget?: AdBudget;
  bid?: AdBid;
  endAt?: string;
  targeting?: AdDraftTargeting;
  placements?: AdPlacements;
  schedule?: AdDayPart[];
  creative?: AdCreativeDraftV2;
}

export interface AdCopyRequest {
  parentId?: string;
  deepCopy: boolean;
  nameSuffix?: string;
}

export interface AdCreatedRef {
  metaId: string;
}

export type AdTestLevel = "campaign" | "adset";

export interface AdTestCell {
  name: string;
  objectIds: string[];
  share: number;
}

export interface AdSplitTest {
  metaId?: string;
  adAccountId: string;
  name: string;
  description?: string;
  level: AdTestLevel;
  cells: AdTestCell[];
  startAt: string;
  endAt: string;
  confidence: number;
}

export interface AdVideoMetrics {
  plays: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  p100: number;
  thruPlays: number;
  avgWatchSeconds: number;
}

export interface AdLiveRow {
  objectId: string;
  dimensions: Record<string, string> | null;
  metrics: AdMetrics;
  reach: number;
  frequency: number;
  video: AdVideoMetrics;
  costPerThruPlay: number | null;
}

export interface AdLiveInsights {
  currency: string;
  rows: AdLiveRow[] | null;
}

export type AdAttributionWindow = "1d_view" | "1d_click" | "7d_click" | "28d_click";

export type AdDraftState = "editing" | "publishing" | "published" | "failed";

export interface AdDraftRow {
  key: string;
  level: AdLevel;
  name: string;
  parentKey?: string;
  parentMetaId?: string;
  budget?: AdBudget;
  objective?: AdObjective;
  destination?: AdDraftDestination;
  goal?: AdOptimizationGoal;
}

export interface AdSavedDraft {
  id: string;
  adAccountId: string;
  draft: MetaAdDraft;
  version: number;
  state: AdDraftState;
  job?: AdPublishJob;
  rows: AdDraftRow[];
  createdAt: string;
  updatedAt: string;
}

export interface AdDraftList {
  drafts: AdSavedDraft[];
  objectCount: number;
}

export type AdBulkField = "name" | "primaryText" | "headline" | "description" | "link";

export type AdBulkChange =
  | { field: AdBulkField; mode: "set"; value: string }
  | { field: AdBulkField; mode: "replace"; find: string; replace: string; matchCase: boolean };

export interface AdBulkResult {
  metaId: string;
  ok: boolean;
  object?: AdRow;
  error?: { code: string; message: string };
}

export type AdReportView = "pivot" | "trend" | "bars";

export type AdReportMetric =
  | "spend"
  | "impressions"
  | "reach"
  | "frequency"
  | "clicks"
  | "linkClicks"
  | "ctr"
  | "cpc"
  | "cpm"
  | "results"
  | "costPerResult"
  | "conversations"
  | "costPerConversation"
  | "thruPlays"
  | "costPerThruPlay";

export type AdReportPreset =
  | "today"
  | "yesterday"
  | "todayAndYesterday"
  | "last7"
  | "last14"
  | "last28"
  | "last30"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "maximum"
  | "custom";

export interface AdReportDefinition {
  view: AdReportView;
  level: AdLevel;
  breakdowns: string[];
  metrics: AdReportMetric[];
  datePreset: AdReportPreset;
  since?: string;
  until?: string;
}

export interface AdReportTemplate {
  key: string;
  definition: AdReportDefinition;
}

export interface AdReportOptions {
  templates: AdReportTemplate[];
  views: AdReportView[];
  levels: AdLevel[];
  breakdowns: string[];
  metrics: AdReportMetric[];
  trendMetrics: AdReportMetric[];
  breakdownGroups: string[][];
}

export interface AdSavedReport {
  id: string;
  name: string;
  adAccountId: string;
  definition: AdReportDefinition;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
}

export interface AdSavedReportInput {
  name: string;
  adAccountId: string;
  definition: AdReportDefinition;
}

export type AdReportValues = Partial<Record<AdReportMetric, number | null>>;

export interface AdReportRunRow {
  key: string;
  objectId?: string;
  name?: string;
  dimensions: string[];
  share: number;
  values: AdReportValues;
}

export type AdMetricKind = "money" | "count" | "percent" | "decimal";

export interface AdReportRun {
  currency: string;
  view: AdReportView;
  breakdowns: string[];
  metrics: AdReportMetric[];
  metricKinds: Partial<Record<AdReportMetric, AdMetricKind>>;
  rows: AdReportRunRow[];
  totals: AdReportValues;
  series: { day: string; values: AdReportValues }[];
}

export interface AdReportRunRequest {
  definition: AdReportDefinition;
  range: AdRange;
  objectIds?: string[];
  windows?: AdAttributionWindow[];
}

export interface AdReportExportLabels {
  object: string;
  day: string;
  total: string;
  breakdowns: Record<string, string>;
  values: Record<string, Record<string, string>>;
  metrics: Partial<Record<AdReportMetric, string>>;
}

export interface AdReportExportRequest extends AdReportRunRequest {
  name: string;
  adAccountId: string;
  reportId?: string;
  labels: AdReportExportLabels;
}

export interface AdReportExport {
  id: string;
  name: string;
  adAccountId: string;
  reportId?: string;
  since: string;
  until: string;
  rows: number;
  sizeBytes: number;
  createdBy: string;
  createdAt: string;
}
