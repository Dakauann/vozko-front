import { parsedRequest } from "@/lib/api/parsed-request";
import type { EntryType } from "@/lib/conversations/types";
import { holderParam, parsePortfolioHolding, parsePortfolioPage, type PortfolioHolderScope } from "@/lib/customer-portfolio/portfolio";

export interface PortfolioListQuery {
  scope: PortfolioHolderScope;
  page: number;
  pageSize: number;
  search?: string;
}

const ROOT = "/customer-portfolio";

function conversationPath(entryType: EntryType, entryId: string): string {
  return `${ROOT}/conversations/${encodeURIComponent(entryType)}/${encodeURIComponent(entryId)}`;
}

function leadPath(leadId: string): string {
  return `${ROOT}/leads/${encodeURIComponent(leadId)}`;
}

function entryPath(entryId: string): string {
  return `${ROOT}/entries/${encodeURIComponent(entryId)}`;
}

function placeBody(holderId?: string): string {
  return JSON.stringify(holderId ? { holderId } : {});
}

export function listPortfolioAction(query: PortfolioListQuery, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  const holder = holderParam(query.scope);
  if (holder) params.set("holderId", holder);
  const search = query.search?.trim();
  if (search) params.set("search", search);
  return parsedRequest(`${ROOT}/entries?${params.toString()}`, { method: "GET", signal }, parsePortfolioPage);
}

export function conversationHoldingAction(entryType: EntryType, entryId: string, signal?: AbortSignal) {
  return parsedRequest(conversationPath(entryType, entryId), { method: "GET", signal }, parsePortfolioHolding);
}

export function leadHoldingAction(leadId: string, signal?: AbortSignal) {
  return parsedRequest(leadPath(leadId), { method: "GET", signal }, parsePortfolioHolding);
}

export function placeConversationAction(entryType: EntryType, entryId: string, holderId?: string) {
  return parsedRequest(conversationPath(entryType, entryId), { method: "POST", body: placeBody(holderId) }, parsePortfolioHolding);
}

export function placeLeadAction(leadId: string, holderId?: string) {
  return parsedRequest(leadPath(leadId), { method: "POST", body: placeBody(holderId) }, parsePortfolioHolding);
}

export function movePortfolioEntryAction(entryId: string, holderId: string) {
  return parsedRequest(entryPath(entryId), { method: "PUT", body: JSON.stringify({ holderId }) }, parsePortfolioHolding);
}

export function removePortfolioEntryAction(entryId: string) {
  return parsedRequest(entryPath(entryId), { method: "DELETE" }, () => true as const);
}
