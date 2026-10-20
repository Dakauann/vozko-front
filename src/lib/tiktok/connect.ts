import {
  TIKTOK_CONNECT_ERRORS,
  type TiktokConnectError,
  type TiktokConnectResult,
  type TiktokConnectStatus,
} from "@/lib/tiktok/types";

export const TIKTOK_POPUP_SOURCE = "tiktok-login";
export const TIKTOK_ACCOUNTS_PATH = "/dashboard/tiktok-accounts";
export const TIKTOK_CONNECT_PATH = `${TIKTOK_ACCOUNTS_PATH}/connect`;
export const TIKTOK_OAUTH_START_PATH = "/oauth/tiktok/start";
export const TIKTOK_QUERY_MARKER = "tiktok";

export const TIKTOK_CONNECT_FACTS = ["region", "messageBudget", "noHistory", "yearlyReconnect", "comments"] as const;

const KNOWN_STATUSES: readonly TiktokConnectStatus[] = ["connected", "reconnected", "error", "cancelled"];

export function tiktokAccountPath(accountId: string): string {
  return `${TIKTOK_ACCOUNTS_PATH}/${accountId}`;
}

function isKnownStatus(value: unknown): value is TiktokConnectStatus {
  return typeof value === "string" && (KNOWN_STATUSES as readonly string[]).includes(value);
}

function filled(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function connectErrorOf(reason: unknown): TiktokConnectError {
  return typeof reason === "string" && (TIKTOK_CONNECT_ERRORS as readonly string[]).includes(reason)
    ? (reason as TiktokConnectError)
    : "connect_failed";
}

function resultOf(status: unknown, username: unknown, accountId: unknown, reason: unknown): TiktokConnectResult | null {
  if (!isKnownStatus(status)) return null;
  if (status === "cancelled") return { status };
  if (status === "error") return { status, reason: connectErrorOf(reason) };
  const result: TiktokConnectResult = { status };
  const name = filled(username);
  const id = filled(accountId);
  if (name) result.username = name;
  if (id) result.accountId = id;
  return result;
}

export function connectResultFromMessage(data: Record<string, unknown>): TiktokConnectResult | null {
  return resultOf(data.status, data.username, data.accountId, data.reason);
}

export function connectResultFromQuery(params: URLSearchParams): TiktokConnectResult | null {
  return resultOf(params.get(TIKTOK_QUERY_MARKER), params.get("username"), params.get("accountId"), params.get("reason"));
}
