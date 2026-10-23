export type EmailMode = "probation" | "trusted" | "own_domain";

export type EmailAccountStatus = "active" | "paused_by_provider" | "paused_by_platform" | "dormant";

export type EmailDomainKind = "shared_probation" | "shared_trusted" | "own";

export type EmailDomainStatus = "pending" | "verifying" | "verified" | "failed";

export type EmailSetupState = "in_progress" | "failed" | "done";

export type EmailDomainLifecycle = "active" | "releasing" | "retired";

export interface EmailDomainActions {
  recheck: boolean;
  remove: boolean;
}

export interface EmailSetupProgress {
  state: EmailSetupState;
  error_code?: string;
}

export type EmailConnectMethod = "automatic" | "manual";

export type EmailRecordPurpose = "dkim" | "mail_from_mx" | "mail_from_spf" | "reply_mx" | "dmarc";

export type EmailPromotionOutcome = "granted" | "not_eligible" | "too_soon" | "low_volume" | "bounces" | "complaints" | "findings";

export type EmailSuppressionReason = "hard_bounce" | "complaint" | "manual" | "soft_bounce";

export type EmailRecordStatus = "verified" | "pending" | "unknown";

export type EmailReputationLevel = "ok" | "warning" | "over";

export type EmailDailyLimit = "capped" | "unlimited" | "blocked";

export interface EmailAccount {
  id: string;
  workspace_id: string;
  provider: string;
  tenant_name: string;
  mode: EmailMode;
  status: EmailAccountStatus;
  status_reason: string;
  slug: string;
  probation_started_at: string | null;
  promoted_at: string | null;
}

export interface EmailProbationTargets {
  days: number;
  min_delivered: number;
  max_bounce_per_mil: number;
  max_complaint_per_10k: number;
}

export interface EmailProbation {
  days: number;
  required_days: number;
  delivered: number;
  hard_bounces: number;
  complaints: number;
  outcome: EmailPromotionOutcome;
  targets: EmailProbationTargets;
}

export interface EmailDnsRecord {
  purpose: EmailRecordPurpose;
  type: string;
  name: string;
  host: string;
  status: EmailRecordStatus;
  value: string;
  priority: number;
  ttl: number;
}

export interface EmailDomain {
  id: string;
  domain: string;
  kind: EmailDomainKind;
  status: EmailDomainStatus;
  connect_method: EmailConnectMethod;
  mail_from_domain: string;
  reply_domain: string;
  records: EmailDnsRecord[];
  failure_reason: string;
  verified_at: string | null;
  last_checked_at: string | null;
  retired: boolean;
  sendable: boolean;
  lifecycle: EmailDomainLifecycle;
  actions: EmailDomainActions;
  replies_paused: boolean;
  replies_paused_at: string | null;
  setup: EmailSetupProgress;
  used_today?: number;
  cap_today?: number;
  daily_limit?: EmailDailyLimit;
}

export interface EmailSender {
  id: string;
  domain_id: string;
  address: string;
  local_part: string;
  display_name: string;
  reply_forward_to: string;
  is_default: boolean;
  domain_lifecycle: EmailDomainLifecycle;
}

export interface EmailSetup {
  provisioned: boolean;
  account: EmailAccount | null;
  probation: EmailProbation | null;
  domains: EmailDomain[];
  senders: EmailSender[];
  replies_paused: boolean;
  setup: EmailSetupProgress;
  subdomain: EmailSubdomain;
  activation: EmailActivationVerdict;
}

export type EmailActivationRefusal = "email_plan_required" | "email_plan_unavailable";

export interface EmailActivationVerdict {
  allowed: boolean;
  error_code?: EmailActivationRefusal;
}

export interface EmailSubdomain {
  slug: string;
  address: string;
  locked: boolean;
}

export interface EmailSubdomainCheck {
  slug: string;
  available: boolean;
  error_code?: string;
  address?: string;
}

export interface CreateEmailSenderInput {
  domain_id: string;
  local_part: string;
  display_name: string;
  reply_forward_to: string;
  is_default: boolean;
}

export type UpdateEmailSenderInput = Partial<CreateEmailSenderInput>;

export interface EmailSuppression {
  address: string;
  reason: EmailSuppressionReason;
  source_message_id: string;
  suppressed_at: string;
  removable: boolean;
}

export interface EmailPageMeta {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export interface EmailPage<T> {
  data: T[];
  meta: EmailPageMeta;
}

export interface EmailPrice {
  service: string;
  metric: string;
  unitMicros: number;
  unitBRL: number;
  thousandBRL: number;
}

export interface EmailReceivePricing {
  perMessage: EmailPrice;
  perChunk: EmailPrice;
  chunkBytes: number;
}

export interface EmailChunkPricing {
  perChunk: EmailPrice;
  chunkBytes: number;
}

export interface EmailPricing {
  exchangeRate: number;
  exchangeRateUpdatedAt: string;
  send: EmailPrice;
  sendAttachments: EmailChunkPricing;
  receive: EmailReceivePricing;
}

export interface EmailTotals {
  recipients: number;
  pending: number;
  sent: number;
  failed: number;
  skipped: Record<string, number> | null;
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
}

export interface EmailDailyPoint {
  bucket: string;
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  bounces: number;
}

export interface EmailCampaignSummary {
  id: string;
  name: string;
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  open_rate: number;
  click_rate: number;
}

export interface EmailReputation {
  bounce_rate: number;
  bounce_warning: number;
  bounce_limit: number;
  bounce_level: EmailReputationLevel;
  bounce_over_limit: boolean;
  complaint_rate: number;
  complaint_warning: number;
  complaint_limit: number;
  complaint_level: EmailReputationLevel;
  complaint_over_limit: boolean;
}

export interface EmailOverview {
  days: number;
  time_zone: string;
  totals: EmailTotals;
  daily: EmailDailyPoint[];
  top: EmailCampaignSummary[];
  reputation: EmailReputation;
}

export interface EmailAdminFinding {
  impact: string;
  type: string;
  description: string;
}

export interface EmailAdminAccount {
  workspace_name: string;
  account: EmailAccount;
  sending: string;
  findings: EmailAdminFinding[];
  health_error: string;
  health_checked_at: string | null;
}

export interface EmailSendQuota {
  read: boolean;
  read_at: string | null;
  fresh: boolean;
  production_access: boolean;
  max_send_rate: number;
  max_24_hour_send: number;
  unlimited_24_hours: boolean;
  sent_last_24_hours: number;
  sent_since_read: number;
  used_24_hours: number;
  usage_basis_points: number;
  priority_reserve: number;
  near_limit: boolean;
}

export type EmailOverviewDays = 7 | 30 | 90;

export const EMAIL_ADDRESS_VERDICTS = [
  "valid",
  "suppressed",
  "bad_address",
  "no_mail_domain",
  "disposable",
  "domain_unknown",
  "domain_pending",
  "inactive",
  "typo",
  "role",
] as const;

export type EmailAddressVerdict = (typeof EMAIL_ADDRESS_VERDICTS)[number];

export interface EmailAddressStatus {
  address: string;
  verdict: EmailAddressVerdict;
  blocks_campaigns: boolean;
  domain: { state: "pending" | "accepts" | "no_mail" | "unknown"; stale: boolean };
  disposable: boolean;
  role: boolean;
  suggestion: string;
  suggested_address: string;
  suppression: { reason: string; scope: "workspace" | "shared"; suppressed_at: string | null } | null;
  soft_bounces: number;
  first_delivered_at: string | null;
  last_engaged_at: string | null;
  inactive: boolean;
  never_mailed: boolean;
}
