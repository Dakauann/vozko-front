import { apiClient, type ApiResult } from "@/lib/api/browser-client";
import { updateBodyOf } from "@/lib/mercadolivre/account";
import type {
  MercadoLivreAccount,
  MercadoLivreAccountChanges,
  MercadoLivreAccountListMeta,
  MercadoLivreAccountStatus,
  MercadoLivreActionError,
  MercadoLivreCommentRule,
  MercadoLivreCommentRulePayload,
  MercadoLivreDisconnectResult,
  MercadoLivreListing,
  MercadoLivreListingQuery,
  MercadoLivrePackSummary,
  MercadoLivrePage,
  MercadoLivreQuestion,
  MercadoLivreQuestionQuery,
  MercadoLivreReasonOption,
  MercadoLivreReasonSendBody,
  MercadoLivreResponseTime,
} from "@/lib/mercadolivre/types";

const DEFAULT_META: MercadoLivreAccountListMeta = { page: 1, pageSize: 15, totalPages: 1, totalItems: 0 };

const EMPTY_RESPONSE: MercadoLivreActionError = { error: "Empty response" };

function failure(result: ApiResult<unknown>): MercadoLivreActionError {
  const error: MercadoLivreActionError = { error: result.error?.message ?? "Request failed" };
  if (result.error?.code) error.code = result.error.code;
  if (result.error?.status) error.status = result.error.status;
  return error;
}

function segment(value: string): string {
  return encodeURIComponent(value);
}

function accountPath(accountId: string): string {
  return `/mercadolivre/accounts/${segment(accountId)}`;
}

interface AccountListResponse {
  data: MercadoLivreAccount[];
  meta: MercadoLivreAccountListMeta;
}

export async function listMercadoLivreAccountsAction(
  page = 1,
  pageSize = 15,
  search?: string,
  status?: MercadoLivreAccountStatus,
) {
  const params = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() });
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  const response = await apiClient<AccountListResponse>(`/mercadolivre/accounts?${params.toString()}`, { method: "GET" });
  if (response.error) return { accounts: [] as MercadoLivreAccount[], meta: DEFAULT_META, ...failure(response) };
  return { accounts: response.data?.data ?? [], meta: response.data?.meta ?? DEFAULT_META };
}

async function accountRequest(path: string, init: RequestInit): Promise<{ account: MercadoLivreAccount } | MercadoLivreActionError> {
  const response = await apiClient<MercadoLivreAccount>(path, init);
  if (response.error) return failure(response);
  if (!response.data) return EMPTY_RESPONSE;
  return { account: response.data };
}

export function getMercadoLivreAccountAction(accountId: string) {
  return accountRequest(accountPath(accountId), { method: "GET" });
}

export function updateMercadoLivreAccountAction(accountId: string, changes: MercadoLivreAccountChanges) {
  return accountRequest(accountPath(accountId), { method: "PATCH", body: JSON.stringify(updateBodyOf(changes)) });
}

export function checkMercadoLivreAccountHealthAction(accountId: string) {
  return accountRequest(`${accountPath(accountId)}/health-check`, { method: "POST" });
}

export async function disconnectMercadoLivreAccountAction(
  accountId: string,
): Promise<{ disconnected: MercadoLivreDisconnectResult } | MercadoLivreActionError> {
  const response = await apiClient<MercadoLivreDisconnectResult>(accountPath(accountId), { method: "DELETE" });
  if (response.error) return failure(response);
  if (!response.data) return EMPTY_RESPONSE;
  return { disconnected: response.data };
}

function withQuery(path: string, entries: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

async function request<T>(path: string, init: RequestInit): Promise<{ data: T } | MercadoLivreActionError> {
  const response = await apiClient<T>(path, init);
  if (response.error) return failure(response);
  if (response.data === undefined || response.data === null) return EMPTY_RESPONSE;
  return { data: response.data };
}

async function pageRequest<T>(path: string): Promise<{ page: MercadoLivrePage<T> } | MercadoLivreActionError> {
  const result = await request<MercadoLivrePage<T>>(path, { method: "GET" });
  if ("error" in result) return result;
  return { page: result.data };
}

export function listMercadoLivreListingsAction(accountId: string, query: MercadoLivreListingQuery) {
  return pageRequest<MercadoLivreListing>(
    withQuery(`${accountPath(accountId)}/listings`, {
      search: query.search?.trim(),
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    }),
  );
}

export function listMercadoLivreQuestionsAction(accountId: string, query: MercadoLivreQuestionQuery) {
  const base = query.itemId
    ? `${accountPath(accountId)}/listings/${segment(query.itemId)}/questions`
    : `${accountPath(accountId)}/questions`;
  return pageRequest<MercadoLivreQuestion>(withQuery(base, { status: query.status, cursor: query.cursor, limit: query.limit }));
}

function questionPath(accountId: string, questionId: string): string {
  return `${accountPath(accountId)}/questions/${segment(questionId)}`;
}

export async function answerMercadoLivreQuestionAction(
  accountId: string,
  questionId: string,
  text: string,
): Promise<{ question: MercadoLivreQuestion } | MercadoLivreActionError> {
  const result = await request<MercadoLivreQuestion>(`${questionPath(accountId, questionId)}/answer`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  if ("error" in result) return result;
  return { question: result.data };
}

export async function deleteMercadoLivreQuestionAction(
  accountId: string,
  questionId: string,
): Promise<{ status: "deleted" } | MercadoLivreActionError> {
  const result = await request<{ status: "deleted" }>(questionPath(accountId, questionId), { method: "DELETE" });
  if ("error" in result) return result;
  return { status: result.data.status };
}

export async function setMercadoLivreQuestionAuthorBlockedAction(
  accountId: string,
  questionId: string,
  blocked: boolean,
): Promise<{ status: "blocked" | "unblocked" } | MercadoLivreActionError> {
  const result = await request<{ status: "blocked" | "unblocked" }>(`${questionPath(accountId, questionId)}/block-author`, {
    method: blocked ? "POST" : "DELETE",
  });
  if ("error" in result) return result;
  return { status: result.data.status };
}

export async function getMercadoLivreResponseTimeAction(
  accountId: string,
): Promise<{ responseTime: MercadoLivreResponseTime } | MercadoLivreActionError> {
  const result = await request<MercadoLivreResponseTime>(`${accountPath(accountId)}/questions/response-time`, { method: "GET" });
  if ("error" in result) return result;
  return { responseTime: result.data };
}

function rulesPath(accountId: string): string {
  return `${accountPath(accountId)}/comment-rules`;
}

export async function listMercadoLivreCommentRulesAction(
  accountId: string,
): Promise<{ rules: MercadoLivreCommentRule[] } & Partial<MercadoLivreActionError>> {
  const result = await request<MercadoLivreCommentRule[]>(rulesPath(accountId), { method: "GET" });
  if ("error" in result) return { rules: [], ...result };
  return { rules: result.data };
}

async function ruleRequest(path: string, init: RequestInit): Promise<{ rule: MercadoLivreCommentRule } | MercadoLivreActionError> {
  const result = await request<MercadoLivreCommentRule>(path, init);
  if ("error" in result) return result;
  return { rule: result.data };
}

export function createMercadoLivreCommentRuleAction(accountId: string, payload: MercadoLivreCommentRulePayload) {
  return ruleRequest(rulesPath(accountId), { method: "POST", body: JSON.stringify(payload) });
}

export function updateMercadoLivreCommentRuleAction(accountId: string, ruleId: string, payload: MercadoLivreCommentRulePayload) {
  return ruleRequest(`${rulesPath(accountId)}/${segment(ruleId)}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function deleteMercadoLivreCommentRuleAction(
  accountId: string,
  ruleId: string,
): Promise<{ status: "deleted" } | MercadoLivreActionError> {
  const result = await request<{ status: "deleted" }>(`${rulesPath(accountId)}/${segment(ruleId)}`, { method: "DELETE" });
  if ("error" in result) return result;
  return { status: result.data.status };
}

function reasonsPath(entryId: string): string {
  return `/mercadolivre/conversations/${segment(entryId)}/reasons`;
}

export async function listMercadoLivreReasonsAction(
  entryId: string,
): Promise<{ options: MercadoLivreReasonOption[] } | MercadoLivreActionError> {
  const result = await request<{ data: MercadoLivreReasonOption[] }>(reasonsPath(entryId), { method: "GET" });
  if ("error" in result) return result;
  return { options: result.data.data ?? [] };
}

export async function sendMercadoLivreReasonAction(
  entryId: string,
  body: MercadoLivreReasonSendBody,
): Promise<{ providerMessageId: string } | MercadoLivreActionError> {
  const result = await request<{ providerMessageId: string }>(reasonsPath(entryId), { method: "POST", body: JSON.stringify(body) });
  if ("error" in result) return result;
  return { providerMessageId: result.data.providerMessageId };
}

export async function getMercadoLivrePackSummaryAction(
  entryId: string,
): Promise<{ pack: MercadoLivrePackSummary } | MercadoLivreActionError> {
  const result = await request<MercadoLivrePackSummary>(`/mercadolivre/conversations/${segment(entryId)}/pack`, { method: "GET" });
  if ("error" in result) return result;
  return { pack: result.data };
}
