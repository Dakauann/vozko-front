import type { CrmFilter } from "@/lib/crm/board";
import type { Document, Hint, Issue, Starter } from "@/lib/email-design/types";

export const CAMPAIGN_STATUSES = ["draft", "ready", "scheduled", "running", "paused", "held", "completed", "stopped"] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const HOLD_REASONS = ["daily_cap", "account_paused", "sender_unavailable", "balance_insufficient", "test_batch_bounces", "test_batch_complaints"] as const;

export type HoldReason = (typeof HOLD_REASONS)[number];

export const SKIP_REASONS = [
  "no_email",
  "invalid_address",
  "duplicate",
  "opted_out",
  "blocked",
  "unsubscribed",
  "suppressed",
  "missing_variable",
  "bad_address",
  "no_mail_domain",
  "domain_unknown",
  "domain_checking",
  "disposable",
  "inactive",
] as const;

export type SkipReason = (typeof SKIP_REASONS)[number];

export const RECIPIENT_STATUSES = ["pending", "skipped", "sent", "failed"] as const;

export type RecipientStatus = (typeof RECIPIENT_STATUSES)[number];

export const VARIANTS = ["a", "b", "winner"] as const;

export type Variant = (typeof VARIANTS)[number];

export const WINNER_METRICS = ["opens", "clicks"] as const;

export type WinnerMetric = (typeof WINNER_METRICS)[number];

export const LAUNCH_ISSUE_CODES = [
  "sender_missing",
  "sender_not_verified",
  "account_paused",
  "document_invalid",
  "subject_invalid",
  "audience_empty",
  "balance_insufficient",
  "schedule_in_past",
  "domains_checking",
] as const;

export type LaunchIssueCode = (typeof LAUNCH_ISSUE_CODES)[number];

export const MAILBOX_FAMILIES = ["gmail", "microsoft", "yahoo", "apple", "uol", "other"] as const;

export type MailboxFamily = (typeof MAILBOX_FAMILIES)[number];

export const TEST_OUTCOMES = ["sent", "suppressed", "daily_cap", "failed"] as const;

export type TestOutcome = (typeof TEST_OUTCOMES)[number];

export type SelectionMode = "ids" | "all_matching" | "first_n" | "everyone";

export interface SelectionSort {
  field: string;
  key?: string;
  desc?: boolean;
}

export interface Selection {
  mode: SelectionMode;
  ids?: string[];
  filter?: CrmFilter;
  sort?: SelectionSort[];
  limit?: number;
  exclude_ids?: string[];
}

export interface MergePolicy {
  key: string;
  missing: "text" | "exclude";
  text?: string;
}

export interface ABTest {
  variant_b_subject: string;
  test_percent: number;
  winner_metric: WinnerMetric;
  decide_after_minutes: number;
  winner?: "a" | "b";
}

export interface UTM {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
}

export const CAMPAIGN_ACTIONS = ["edit", "delete", "ready", "schedule", "unschedule", "launch", "start", "resume", "pause", "stop"] as const;

export type CampaignAction = (typeof CAMPAIGN_ACTIONS)[number];

export interface CampaignHold {
  reason: string;
  resume_at?: string;
  account_status_reason?: string;
}

export interface CampaignBilling {
  batch_size: number;
  current_batch: number;
  charged_units: number;
  charged_micros: number;
  sent_units: number;
  refunded_units: number;
  refunded_micros: number;
  final_micros: number;
  settled_at: string | null;
  refund_pending_micros: number;
  exchange_rate: number | null;
  charged_brl: number | null;
  refunded_brl: number | null;
  final_brl: number | null;
  refund_pending_brl: number | null;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  hold_reason?: HoldReason;
  hold?: CampaignHold;
  test_batch?: CampaignTestBatch;
  actions: CampaignAction[];
  billing: CampaignBilling;
  time_zone: string;
  sender_id?: string;
  subject: string;
  preheader?: string;
  document: Document;
  selection?: Selection;
  list_id?: string;
  merge_policies?: MergePolicy[];
  ab_test?: ABTest;
  utm?: UTM;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  created_by?: string;
  launched_by?: string;
  created_at: string;
  updated_at: string;
}

export const TEST_BATCH_STATES = ["testing", "passed", "failed"] as const;

export type TestBatchState = (typeof TEST_BATCH_STATES)[number];

export interface CampaignTestBatch {
  size: number;
  state: TestBatchState;
  drained_at: string | null;
  decided_at: string | null;
}

export interface CampaignRequest {
  name: string;
  sender_id?: string;
  subject: string;
  preheader?: string;
  document?: Document;
  selection?: Selection;
  list_id?: string;
  merge_policies?: MergePolicy[];
  ab_test?: ABTest;
  utm?: UTM;
}

export interface CampaignSummary {
  id: string;
  name: string;
  status: CampaignStatus;
  hold_reason?: HoldReason;
  subject: string;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  ab_test: boolean;
  created_at: string;
  metrics: CampaignListMetrics;
  actions: CampaignAction[];
}

export interface CampaignListMetrics {
  sent: number;
  delivered: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface CampaignListQuery {
  status?: CampaignStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface DesignRequest {
  name: string;
  kind: "template" | "campaign";
  thumbnail_url?: string;
  document: Document;
}

export interface Design {
  id: string;
  name: string;
  kind: "template" | "campaign";
  thumbnail_url?: string;
  document: Document;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface StarterList {
  items: Starter[];
}

export interface Personalization {
  first_name?: string;
  name?: string;
  email?: string;
  company?: string;
  fields?: Record<string, string>;
}

export interface RenderRequest {
  document: Document;
  subject?: string;
  sample?: Personalization;
}

export interface Preview {
  subject: string;
  html: string;
  text: string;
  hints: Hint[];
}

export interface TestResult {
  address: string;
  message_id?: string;
  outcome: TestOutcome;
}

export interface TestSendResponse {
  results: TestResult[];
}

export interface Quote {
  units: number;
  unit_micros: number;
  unit_cost_micros: number;
  total_micros: number;
  unit_brl: number;
  total_brl: number;
}

export interface MergeTagCount {
  key: string;
  missing: number;
  policy: "text" | "exclude" | "";
  text?: string;
  fallback?: string;
}

export interface AudienceListSummary {
  id: string;
  rows: number;
  existing: number;
  new: number;
}

export interface AudienceSummary {
  matched: number;
  with_email: number;
  sendable: number;
  never_mailed: number;
  skipped: Partial<Record<SkipReason, number>> | null;
  variables?: MergeTagCount[];
  list?: AudienceListSummary;
}

export interface LaunchIssue {
  code: LaunchIssueCode;
  missing_micros?: number;
  addresses?: number;
  issues?: Issue[];
}

export interface LaunchReport {
  blocking: LaunchIssue[];
  hints: Hint[];
}

export interface Review {
  audience: AudienceSummary;
  send: Quote;
  first_batch: Quote;
  batch_size: number;
  balance_micros: number;
  missing_micros: number;
  exchange_rate: number;
  balance_brl: number;
  missing_brl: number;
  after_first_batch_micros: number;
  after_first_batch_brl: number;
  test_batch: number;
  time_zone: string;
  check: LaunchReport;
}

export interface VariantResult {
  delivered: number;
  opens: number;
  clicks: number;
}

export interface Metrics {
  recipients: number;
  pending: number;
  sent: number;
  failed: number;
  skipped: Partial<Record<SkipReason, number>> | null;
  delivered: number;
  opens: number;
  clicks: number;
  hard_bounces: number;
  soft_bounces: number;
  complaints: number;
  unsubscribes: number;
  skipped_total: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  click_to_open_rate: number;
  bounce_rate: number;
  complaint_rate: number;
  unsubscribe_rate: number;
  status: CampaignStatus;
  hold_reason: HoldReason | "";
  variants?: Partial<Record<Variant, VariantResult>>;
  winner?: "a" | "b";
  refresh_after_seconds: number;
}

export type TimelineBucket = "hour" | "day";

export interface TimelinePoint {
  bucket: string;
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  bounces: number;
}

export interface Timeline {
  bucket: TimelineBucket;
  points: TimelinePoint[];
  refresh_after_seconds: number;
  time_zone: string;
}

export interface LinkStat {
  url: string;
  clicks: number;
  unique_clickers: number;
}

export interface DomainStat {
  family: MailboxFamily;
  sent: number;
  delivered: number;
  opens: number;
  bounces: number;
  open_rate: number;
  bounce_rate: number;
}

export interface ItemList<T> {
  items: T[];
}

export interface Recipient {
  id: string;
  lead_id?: string;
  lead_name?: string;
  address: string;
  variant?: Variant;
  status: RecipientStatus;
  skip_reason?: SkipReason;
  failure_code?: string;
  sent_at?: string;
  message_status?: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
  bounced_at?: string;
  bounce_kind?: string;
  complained_at?: string;
  unsubscribed_at?: string;
}

export interface RecipientQuery {
  status?: RecipientStatus;
  skipReason?: SkipReason;
  variant?: Variant;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface Sender {
  id: string;
  domain_id: string;
  address: string;
  local_part: string;
  display_name: string;
  reply_forward_to: string;
  is_default: boolean;
}

export interface SubscribeRequest {
  address: string;
  lead_id?: string;
  source: "operator" | "form" | "api";
  ip?: string;
  consented_at?: string;
}

export interface Subscription {
  address: string;
  lead_id?: string;
  status: "subscribed" | "unsubscribed";
  source?: string;
  consented_at?: string;
  consent_ip?: string;
  unsubscribed_at?: string;
  unsubscribe_source?: string;
}

export interface ImportRow {
  address: string;
  lead_id?: string;
  ip?: string;
  consented_at: string;
}

export interface ImportRowError {
  row: number;
  code: string;
}

export interface ImportResult {
  subscribed: number;
  unchanged: number;
  kept_unsubscribed: number;
  duplicates: number;
  invalid: ImportRowError[] | null;
}
