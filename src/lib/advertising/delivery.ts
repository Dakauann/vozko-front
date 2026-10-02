import type { AdAccount, AdDelivery, AdJobStatus, AdMetrics, AdRow } from "@/lib/advertising/types";

export type DeliveryTone = "healthy" | "warning" | "fault" | "info" | "neutral";

const DELIVERY_TONES: Record<AdDelivery, DeliveryTone> = {
  active: "healthy",
  scheduled: "info",
  completed: "neutral",
  off: "neutral",
  campaign_off: "neutral",
  adset_off: "neutral",
  in_review: "info",
  rejected: "fault",
  with_issues: "warning",
  pending_billing: "warning",
  archived: "neutral",
  deleted: "neutral",
  unknown: "neutral",
};

export function deliveryKey(delivery: string): AdDelivery {
  return delivery in DELIVERY_TONES ? (delivery as AdDelivery) : "unknown";
}

export function deliveryTone(delivery: string): DeliveryTone {
  return DELIVERY_TONES[deliveryKey(delivery)];
}

export type ResultKind = "conversations" | "leads" | "linkClicks" | "landingPageViews" | "engagement" | "impressions";

const RESULT_KINDS: Record<string, ResultKind> = {
  "onsite_conversion.messaging_conversation_started_7d": "conversations",
  lead: "leads",
  link_click: "linkClicks",
  landing_page_view: "landingPageViews",
  post_engagement: "engagement",
  impressions: "impressions",
};

export function resultKind(metrics: Pick<AdMetrics, "resultAction" | "mixedResults">): ResultKind | null {
  if (metrics.mixedResults) return null;
  return RESULT_KINDS[metrics.resultAction] ?? null;
}

export function resultCount(metrics: AdMetrics): number | null {
  return resultKind(metrics) ? metrics.results : null;
}

export type IssueEntry = { title: string; message: string };

export function rowIssues(row: Pick<AdRow, "issues" | "reviewFeedback">): IssueEntry[] {
  const issues = (row.issues ?? []).map((issue) => ({ title: issue.summary, message: issue.message }));
  const feedback = Object.entries(row.reviewFeedback ?? {}).map(([title, message]) => ({ title, message }));
  return [...issues, ...feedback].filter((entry) => entry.title || entry.message);
}

export type AccountNotice = "reconnect" | "funding" | "metaStatus";

export function accountNotices(account: AdAccount): AccountNotice[] {
  if (account.connection !== "CONNECTED") return ["reconnect"];
  const notices: AccountNotice[] = [];
  if (account.metaStatus !== "active" && account.metaStatus !== "in_grace_period") notices.push("metaStatus");
  if (!account.hasFunding) notices.push("funding");
  return notices;
}

export function spendBlockerKey(account: AdAccount): AccountNotice | "unknown" | null {
  if (account.canSpend) return null;
  return accountNotices(account)[0] ?? "unknown";
}

const JOB_STATUSES: AdJobStatus[] = ["QUEUED", "RUNNING", "PUBLISHED", "FAILED", "NEEDS_REVIEW"];

export function jobStatusKey(status: string): AdJobStatus | "unknown" {
  return (JOB_STATUSES as string[]).includes(status) ? (status as AdJobStatus) : "unknown";
}

export function jobTone(status: string): DeliveryTone {
  switch (jobStatusKey(status)) {
    case "PUBLISHED":
      return "healthy";
    case "FAILED":
      return "fault";
    case "NEEDS_REVIEW":
      return "warning";
    case "QUEUED":
    case "RUNNING":
      return "info";
    default:
      return "neutral";
  }
}

export function jobIsTerminal(status: string): boolean {
  const key = jobStatusKey(status);
  return key === "PUBLISHED" || key === "FAILED" || key === "NEEDS_REVIEW";
}
