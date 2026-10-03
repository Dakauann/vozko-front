import type { AdInAppAction, AdReadiness, AdReadinessItem, AdReadinessKey, AdReadinessState } from "@/lib/advertising/types";

export const READINESS_KEYS: AdReadinessKey[] = [
  "connection",
  "advertiser_role",
  "account_status",
  "account_details",
  "payment_method",
  "page",
  "phone_verification",
  "email_verification",
  "custom_audience_terms",
  "pixel",
];

const IN_APP_ACTIONS: AdInAppAction[] = ["reconnect", "sync", "create_pixel"];

export function readinessKey(key: string): AdReadinessKey | null {
  return (READINESS_KEYS as string[]).includes(key) ? (key as AdReadinessKey) : null;
}

export function readinessState(state: string): AdReadinessState {
  return state === "ready" || state === "missing" ? state : "unknown";
}

export function accountIsReady(readiness: Pick<AdReadiness, "ready" | "blocking"> | null | undefined): boolean {
  return !!readiness && readiness.ready === true && readiness.blocking.length === 0;
}

export function blockingItems(readiness: Pick<AdReadiness, "blocking" | "items">): AdReadinessItem[] {
  return readiness.items.filter((item) => readiness.blocking.includes(item.key));
}

export type ItemAction = { kind: "inApp"; key: AdInAppAction } | { kind: "portal"; url: string };

export function metaPortalUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const meta = url.protocol === "https:" && (url.hostname === "facebook.com" || url.hostname.endsWith(".facebook.com"));
    return meta ? raw : null;
  } catch {
    return null;
  }
}

export function itemAction(item: Pick<AdReadinessItem, "action">): ItemAction | null {
  const action = item.action;
  if (!action) return null;
  if (action.kind === "in_app" && (IN_APP_ACTIONS as (string | undefined)[]).includes(action.key)) {
    return { kind: "inApp", key: action.key as AdInAppAction };
  }
  const portal = action.kind === "portal" ? metaPortalUrl(action.url) : null;
  if (portal) return { kind: "portal", url: portal };
  return null;
}
