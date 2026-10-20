import {
  MERCADOLIVRE_CONNECT_ERRORS,
  type MercadoLivreConnectError,
  type MercadoLivreConnectResult,
  type MercadoLivreConnectStatus,
} from "@/lib/mercadolivre/types";

export const MERCADOLIVRE_POPUP_SOURCE = "mercadolivre-login";
export const MERCADOLIVRE_ACCOUNTS_PATH = "/dashboard/mercadolivre-accounts";
export const MERCADOLIVRE_CONNECT_PATH = `${MERCADOLIVRE_ACCOUNTS_PATH}/connect`;
export const MERCADOLIVRE_OAUTH_START_PATH = "/oauth/mercadolivre/start";

export const MERCADOLIVRE_CONNECT_FACTS = ["nothingToEnable", "afterPurchase", "questionsFinal", "fullAi", "moderation", "password"] as const;

const RESULT_STATUSES: readonly MercadoLivreConnectStatus[] = ["connected", "reconnected", "error"];

export function mercadoLivreAccountPath(accountId: string): string {
  return `${MERCADOLIVRE_ACCOUNTS_PATH}/${accountId}`;
}

function isResultStatus(value: unknown): value is Exclude<MercadoLivreConnectStatus, "cancelled"> {
  return typeof value === "string" && (RESULT_STATUSES as readonly string[]).includes(value);
}

function filled(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function connectErrorOf(reason: unknown): MercadoLivreConnectError {
  return typeof reason === "string" && (MERCADOLIVRE_CONNECT_ERRORS as readonly string[]).includes(reason)
    ? (reason as MercadoLivreConnectError)
    : "connect_failed";
}

function resultOf(status: unknown, nickname: unknown, accountId: unknown, reason: unknown): MercadoLivreConnectResult | null {
  if (!isResultStatus(status)) return null;
  if (status === "error") return { status, reason: connectErrorOf(reason) };
  const result: MercadoLivreConnectResult = { status };
  const name = filled(nickname);
  const id = filled(accountId);
  if (name) result.nickname = name;
  if (id) result.accountId = id;
  return result;
}

export function connectResultFromMessage(data: Record<string, unknown>): MercadoLivreConnectResult | null {
  return resultOf(data.status, data.nickname, data.accountId, data.reason);
}

export function connectResultFromQuery(params: URLSearchParams): MercadoLivreConnectResult | null {
  return resultOf(params.get("mercadolivre"), params.get("nickname"), params.get("accountId"), params.get("reason"));
}
