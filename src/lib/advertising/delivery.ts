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

export type AccountNotice = "reconnect" | "readOnly" | "funding" | "metaStatus";

export function accountNotices(account: AdAccount): AccountNotice[] {
  if (account.connection !== "CONNECTED") return ["reconnect"];
  if (!account.canManage) return ["readOnly"];
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

export type ManageBlocker = "reconnect" | "readOnly" | "unknown";

export function manageBlockerKey(account: AdAccount): ManageBlocker | null {
  if (account.canManage) return null;
  const notice = accountNotices(account)[0];
  return notice === "reconnect" || notice === "readOnly" ? notice : "unknown";
}

export function accountWritePermissions<P extends { [K in keyof P]: boolean }>(permissions: P, account: AdAccount): P {
  if (manageBlockerKey(account) === null) return permissions;
  return Object.fromEntries(Object.keys(permissions).map((key) => [key, false])) as P;
}

export type SpendCapBlocker = ManageBlocker | "adminRequired";

export function spendCapBlockerKey(account: AdAccount): SpendCapBlocker | null {
  if (account.canSetSpendCap) return null;
  return manageBlockerKey(account) ?? "adminRequired";
}

export type ToggleBlocker = "locked" | "permission" | AccountNotice | "unknown";

export function toggleBlockerKey(
  row: Pick<AdRow, "isOn" | "canToggle">,
  account: AdAccount,
  permissions: { canStart: boolean; canStop: boolean },
): ToggleBlocker | null {
  if (!row.canToggle) return "locked";
  const manage = manageBlockerKey(account);
  if (manage) return manage;
  if (row.isOn) return permissions.canStop ? null : "permission";
  if (!permissions.canStart) return "permission";
  return spendBlockerKey(account);
}

export function isRejected(row: Pick<AdRow, "delivery">): boolean {
  return deliveryKey(row.delivery) === "rejected";
}

export function partitionBySpend(accounts: AdAccount[]): { ready: AdAccount[]; blocked: AdAccount[] } {
  return {
    ready: accounts.filter((account) => spendBlockerKey(account) === null),
    blocked: accounts.filter((account) => spendBlockerKey(account) !== null),
  };
}
