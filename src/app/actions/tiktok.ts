import { apiClient, type ApiResult } from "@/lib/api/browser-client";
import { updateBodyOf } from "@/lib/tiktok/account";
import type {
  TiktokAccount,
  TiktokAccountChanges,
  TiktokAccountListMeta,
  TiktokAccountStatus,
  TiktokActionError,
  TiktokComment,
  TiktokCommentPage,
  TiktokCommentRule,
  TiktokCommentRulePayload,
  TiktokDisconnectResult,
  TiktokVideoPage,
} from "@/lib/tiktok/types";

const DEFAULT_META: TiktokAccountListMeta = { page: 1, pageSize: 15, totalPages: 1, totalItems: 0 };

const EMPTY_RESPONSE: TiktokActionError = { error: "Empty response" };

const EMPTY_VIDEO_PAGE: TiktokVideoPage = { videos: [], hasMore: false };

const EMPTY_COMMENT_PAGE: TiktokCommentPage = { comments: [], hasMore: false };

function failure(result: ApiResult<unknown>): TiktokActionError {
  const error: TiktokActionError = { error: result.error?.message ?? "Request failed" };
  if (result.error?.code) error.code = result.error.code;
  if (result.error?.status) error.status = result.error.status;
  return error;
}

function accountPath(accountId: string): string {
  return `/tiktok/accounts/${encodeURIComponent(accountId)}`;
}

function commentPath(accountId: string, commentId: string): string {
  return `${accountPath(accountId)}/comments/${encodeURIComponent(commentId)}`;
}

function rulesPath(accountId: string): string {
  return `${accountPath(accountId)}/comment-rules`;
}

function withQuery(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

interface AccountListResponse {
  data: TiktokAccount[];
  meta: TiktokAccountListMeta;
}

export async function listTiktokAccountsAction(page = 1, pageSize = 15, search?: string, status?: TiktokAccountStatus) {
  const params = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() });
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  const response = await apiClient<AccountListResponse>(`/tiktok/accounts?${params.toString()}`, { method: "GET" });
  if (response.error) return { accounts: [] as TiktokAccount[], meta: DEFAULT_META, ...failure(response) };
  return { accounts: response.data?.data ?? [], meta: response.data?.meta ?? DEFAULT_META };
}

async function accountRequest(path: string, init: RequestInit): Promise<{ account: TiktokAccount } | TiktokActionError> {
  const response = await apiClient<TiktokAccount>(path, init);
  if (response.error) return failure(response);
  if (!response.data) return EMPTY_RESPONSE;
  return { account: response.data };
}

export function getTiktokAccountAction(accountId: string) {
  return accountRequest(accountPath(accountId), { method: "GET" });
}

export function updateTiktokAccountAction(accountId: string, changes: TiktokAccountChanges) {
  return accountRequest(accountPath(accountId), { method: "PUT", body: JSON.stringify(updateBodyOf(changes)) });
}

export function checkTiktokAccountHealthAction(accountId: string) {
  return accountRequest(`${accountPath(accountId)}/health-check`, { method: "POST" });
}

export async function disconnectTiktokAccountAction(
  accountId: string,
): Promise<{ disconnected: TiktokDisconnectResult } | TiktokActionError> {
  const response = await apiClient<TiktokDisconnectResult>(accountPath(accountId), { method: "DELETE" });
  if (response.error) return failure(response);
  if (!response.data) return EMPTY_RESPONSE;
  return { disconnected: response.data };
}

export async function listTiktokVideosAction(accountId: string, cursor?: string) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  const response = await apiClient<TiktokVideoPage>(withQuery(`${accountPath(accountId)}/videos`, params), { method: "GET" });
  if (response.error) return { page: EMPTY_VIDEO_PAGE, ...failure(response) };
  return { page: response.data ?? EMPTY_VIDEO_PAGE };
}

export async function listTiktokCommentsAction(accountId: string, videoId: string, cursor?: string, includeHidden = false) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("includeHidden", includeHidden ? "true" : "false");
  const path = withQuery(`${accountPath(accountId)}/videos/${encodeURIComponent(videoId)}/comments`, params);
  const response = await apiClient<TiktokCommentPage>(path, { method: "GET" });
  if (response.error) return { page: EMPTY_COMMENT_PAGE, ...failure(response) };
  return { page: response.data ?? EMPTY_COMMENT_PAGE };
}

async function commentRequest(path: string, init: RequestInit): Promise<{ comment: TiktokComment } | TiktokActionError> {
  const response = await apiClient<TiktokComment>(path, init);
  if (response.error) return failure(response);
  if (!response.data) return EMPTY_RESPONSE;
  return { comment: response.data };
}

export function replyTiktokCommentAction(accountId: string, commentId: string, text: string) {
  return commentRequest(`${commentPath(accountId, commentId)}/replies`, { method: "POST", body: JSON.stringify({ text }) });
}

export function setTiktokCommentHiddenAction(accountId: string, commentId: string, hidden: boolean) {
  return commentRequest(`${commentPath(accountId, commentId)}/${hidden ? "hide" : "unhide"}`, { method: "POST" });
}

export function setTiktokCommentLikedAction(accountId: string, commentId: string, liked: boolean) {
  return commentRequest(`${commentPath(accountId, commentId)}/${liked ? "like" : "unlike"}`, { method: "POST" });
}

export async function listTiktokCommentRulesAction(accountId: string) {
  const response = await apiClient<TiktokCommentRule[]>(rulesPath(accountId), { method: "GET" });
  if (response.error) return { rules: [] as TiktokCommentRule[], ...failure(response) };
  return { rules: response.data ?? [] };
}

async function ruleRequest(path: string, init: RequestInit): Promise<{ rule: TiktokCommentRule } | TiktokActionError> {
  const response = await apiClient<TiktokCommentRule>(path, init);
  if (response.error) return failure(response);
  if (!response.data) return EMPTY_RESPONSE;
  return { rule: response.data };
}

export function createTiktokCommentRuleAction(accountId: string, payload: TiktokCommentRulePayload) {
  return ruleRequest(rulesPath(accountId), { method: "POST", body: JSON.stringify(payload) });
}

export function updateTiktokCommentRuleAction(accountId: string, ruleId: string, payload: TiktokCommentRulePayload) {
  return ruleRequest(`${rulesPath(accountId)}/${encodeURIComponent(ruleId)}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function deleteTiktokCommentRuleAction(accountId: string, ruleId: string): Promise<{ deleted: true } | TiktokActionError> {
  const response = await apiClient<unknown>(`${rulesPath(accountId)}/${encodeURIComponent(ruleId)}`, { method: "DELETE" });
  if (response.error) return failure(response);
  return { deleted: true };
}
