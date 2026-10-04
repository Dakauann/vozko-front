import type { MetaAdsConnectResult, MetaAdsConnectStatus } from "@/lib/advertising/types";

export const META_ADS_POPUP_SOURCE = "meta-ads-login";
export const ADVERTISING_PATH = "/dashboard/advertising";
export const ADVERTISING_NEW_PATH = "/dashboard/advertising/new";
export const ADVERTISING_OVERVIEW_PATH = "/dashboard/advertising/overview";
export const ADVERTISING_EDITOR_PATH = "/dashboard/advertising/editor";
export const ADVERTISING_REPORTS_PATH = "/dashboard/advertising/reports";
export const META_ADS_MANAGER_URL = "https://adsmanager.facebook.com/adsmanager/manage/campaigns";

const STATUSES: MetaAdsConnectStatus[] = ["connected", "partial", "error", "cancelled"];

function isStatus(value: unknown): value is MetaAdsConnectStatus {
  return typeof value === "string" && (STATUSES as string[]).includes(value);
}

export function metaAdsResultFromMessage(data: Record<string, unknown>): MetaAdsConnectResult | null {
  if (!isStatus(data.status)) return null;
  const count = typeof data.count === "number" && Number.isFinite(data.count) ? data.count : undefined;
  return {
    status: data.status,
    reason: typeof data.reason === "string" && data.reason !== "" ? data.reason : undefined,
    count,
  };
}

export function accountStorageKey(workspaceId: string): string {
  return `advertising:account:${workspaceId}`;
}

export const COLUMNS_STORAGE_KEY = "advertising:columns";
export const RANGE_STORAGE_KEY = "advertising:range";

export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

export function pickAccountId(accountIds: string[], ...preferred: (string | null | undefined)[]): string | null {
  for (const candidate of preferred) {
    if (candidate && accountIds.includes(candidate)) return candidate;
  }
  return accountIds[0] ?? null;
}

export interface ManagerFocus {
  accountId: string;
  campaignId?: string | null;
  published?: boolean;
  jobId?: string;
  jobs?: boolean;
}

export function managerHref(focus: ManagerFocus): string {
  const params = new URLSearchParams({ account: focus.accountId });
  if (focus.campaignId) params.set("selected_campaign_ids", focus.campaignId);
  if (focus.published) params.set("published", "1");
  if (focus.jobId) params.set("job", focus.jobId);
  if (focus.jobs) params.set("jobs", "1");
  return `${ADVERTISING_PATH}?${params.toString()}`;
}

export function overviewHref(accountId: string): string {
  return `${ADVERTISING_OVERVIEW_PATH}?${new URLSearchParams({ account: accountId }).toString()}`;
}

export function newAdHref(accountId: string | null | undefined): string {
  return accountId ? `${ADVERTISING_NEW_PATH}?${new URLSearchParams({ accountId }).toString()}` : ADVERTISING_NEW_PATH;
}

export function draftEditorHref(draftId: string): string {
  return `${ADVERTISING_EDITOR_PATH}?${new URLSearchParams({ draft: draftId }).toString()}`;
}

export function objectEditorHref(accountId: string, metaId: string): string {
  return `${ADVERTISING_EDITOR_PATH}?${new URLSearchParams({ object: metaId, account: accountId }).toString()}`;
}

export function objectsEditorHref(accountId: string, metaIds: string[]): string {
  return `${ADVERTISING_EDITOR_PATH}?${new URLSearchParams({ objects: metaIds.join(","), account: accountId }).toString()}`;
}

export function reportHref(reportId: string): string {
  return `${ADVERTISING_REPORTS_PATH}/${encodeURIComponent(reportId)}`;
}

export function reportTemplateHref(templateKey: string, accountId: string): string {
  return `${ADVERTISING_REPORTS_PATH}/new?${new URLSearchParams({ template: templateKey, account: accountId }).toString()}`;
}
