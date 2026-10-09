import { parsedRequest } from "@/lib/api/parsed-request";
import {
  parseCallList,
  parseCallListItem,
  parseCallListItemPage,
  parseCallListNext,
  parseCallListPage,
  type CallListChange,
  type CallListClosing,
  type CallListItemsCursor,
  type CallListItemState,
  type CallListStatus,
} from "@/lib/call-lists/types";

export interface CallListsQuery {
  page: number;
  pageSize: number;
  status?: CallListStatus;
}

export interface CallListItemsQuery {
  state?: CallListItemState;
  limit?: number;
  cursor?: CallListItemsCursor;
}

function listPath(listId: string): string {
  return `/call-lists/${encodeURIComponent(listId)}`;
}

function itemPath(itemId: string): string {
  return `/call-list-items/${encodeURIComponent(itemId)}`;
}

export function listCallListsAction(query: CallListsQuery, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.status) params.set("status", query.status);
  return parsedRequest(`/call-lists?${params.toString()}`, { method: "GET", signal }, parseCallListPage);
}

export function getCallListAction(listId: string, signal?: AbortSignal) {
  return parsedRequest(listPath(listId), { method: "GET", signal }, parseCallList);
}

export function updateCallListAction(listId: string, change: CallListChange) {
  return parsedRequest(listPath(listId), { method: "PATCH", body: JSON.stringify(change) }, parseCallList);
}

export function deleteCallListAction(listId: string) {
  return parsedRequest(listPath(listId), { method: "DELETE" }, () => true as const);
}

export function listCallListItemsAction(listId: string, query: CallListItemsQuery, signal?: AbortSignal) {
  const params = new URLSearchParams();
  if (query.state) params.set("state", query.state);
  if (query.limit) params.set("limit", String(query.limit));
  if (query.cursor) {
    params.set("after", String(query.cursor.after));
    if (query.cursor.afterAt) params.set("afterAt", query.cursor.afterAt);
    if (query.cursor.asOf) params.set("asOf", query.cursor.asOf);
  }
  const qs = params.toString();
  return parsedRequest(`${listPath(listId)}/items${qs ? `?${qs}` : ""}`, { method: "GET", signal }, parseCallListItemPage);
}

export function nextCallListItemAction(listId: string) {
  return parsedRequest(`${listPath(listId)}/next`, { method: "POST" }, parseCallListNext);
}

export function releaseCallListItemAction(itemId: string) {
  return parsedRequest(`${itemPath(itemId)}/release`, { method: "POST" }, parseCallListItem);
}

export function closeCallListItemAction(itemId: string, closing: CallListClosing) {
  return parsedRequest(`${itemPath(itemId)}/close`, { method: "POST", body: JSON.stringify(closing) }, parseCallListItem);
}
