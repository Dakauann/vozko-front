import { parsedRequest } from "@/lib/api/parsed-request";
import { parseLeadCompany, parseLeadCompanyPage, type LeadCompanyChange, type LeadCompanyDraft } from "@/lib/leads/companies";

export interface LeadCompaniesQuery {
  page: number;
  pageSize: number;
  search?: string;
}

function companyPath(companyId: string): string {
  return `/lead-companies/${encodeURIComponent(companyId)}`;
}

export function listLeadCompaniesAction(query: LeadCompaniesQuery, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  const search = query.search?.trim();
  if (search) params.set("search", search);
  return parsedRequest(`/lead-companies?${params.toString()}`, { method: "GET", signal }, parseLeadCompanyPage);
}

export function getLeadCompanyAction(companyId: string, signal?: AbortSignal) {
  return parsedRequest(companyPath(companyId), { method: "GET", signal }, parseLeadCompany);
}

export function createLeadCompanyAction(draft: LeadCompanyDraft) {
  return parsedRequest("/lead-companies", { method: "POST", body: JSON.stringify(draft) }, parseLeadCompany);
}

export function updateLeadCompanyAction(companyId: string, change: LeadCompanyChange) {
  return parsedRequest(companyPath(companyId), { method: "PATCH", body: JSON.stringify(change) }, parseLeadCompany);
}

export function deleteLeadCompanyAction(companyId: string) {
  return parsedRequest(companyPath(companyId), { method: "DELETE" }, () => true as const);
}
