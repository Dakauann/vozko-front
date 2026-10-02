import type { AdBid, AdBudget, AdCreativeDraftV2, AdDayPart, AdDraftTargeting, AdIdentity, AdPlacements } from "@/lib/advertising/draft-types";

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

export type AdInAppAction = "reconnect" | "sync" | "create_pixel";

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
  portalUrl: string;
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
