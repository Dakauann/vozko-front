import type { MetaAdsConnectResult, MetaAdsConnectStatus } from "@/lib/advertising/types";

export const META_ADS_POPUP_SOURCE = "meta-ads-login";
export const ADVERTISING_PATH = "/dashboard/advertising";
export const ADVERTISING_NEW_PATH = "/dashboard/advertising/new";
export const META_BILLING_URL = "https://business.facebook.com/billing_hub/payment_settings";
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

export type WizardEntry = { accountId: string } & ({ campaignId: string } | { adSetId: string } | { adId: string });

export function wizardHref(entry: WizardEntry): string {
  return `${ADVERTISING_NEW_PATH}?${new URLSearchParams(entry).toString()}`;
}
