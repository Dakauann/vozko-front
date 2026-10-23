"use client";

import { useCallback } from "react";
import { useQueries, useQueryClient, type QueryKey, type UseQueryResult } from "@tanstack/react-query";

import { getLeadCompanyAction, listLeadCompaniesAction, type LeadCompaniesQuery } from "@/app/actions/lead-companies";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSectionQuery } from "@/hooks/use-section-query";
import { codedSectionError } from "@/lib/analytics/section-query";
import type { ParsedAnswer } from "@/lib/api/parsed-request";
import type { LeadCompany, LeadCompanyPage } from "@/lib/leads/companies";

const leadCompanyKeys = {
  all: (workspaceId: string) => ["lead-companies", workspaceId] as const,
  page: (workspaceId: string, query: LeadCompaniesQuery) =>
    ["lead-companies", workspaceId, "page", query.page, query.pageSize, query.search?.trim() ?? ""] as const,
  company: (workspaceId: string, companyId: string) => ["lead-companies", workspaceId, "company", companyId] as const,
};

function required<T>(answer: ParsedAnswer<T>, what: string): T {
  if (answer.error) throw codedSectionError(answer.error, what);
  return answer.data;
}

function useCompanyReader() {
  const { currentWorkspace, can } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  return { workspaceId, readable: workspaceId !== "" && can("lead_companies", "read") };
}

export function useLeadCompaniesPage(query: LeadCompaniesQuery, enabled = true) {
  const { workspaceId, readable } = useCompanyReader();
  const sameWorkspace = useCallback((previous: QueryKey) => previous[1] === workspaceId, [workspaceId]);
  return useSectionQuery<LeadCompanyPage>({
    queryKey: leadCompanyKeys.page(workspaceId, query),
    queryFn: async (signal) => required(await listLeadCompaniesAction(query, signal), "lead companies"),
    enabled: enabled && readable,
    keepPreviousWhen: sameWorkspace,
  });
}

export function useLeadCompany(companyId: string) {
  const { workspaceId, readable } = useCompanyReader();
  return useSectionQuery<LeadCompany>({
    queryKey: leadCompanyKeys.company(workspaceId, companyId),
    queryFn: async (signal) => required(await getLeadCompanyAction(companyId, signal), "lead company"),
    enabled: readable && companyId !== "",
  });
}

function companyNamesOf(results: UseQueryResult<LeadCompany>[]): ReadonlyMap<string, string> {
  return new Map(results.flatMap((result) => (result.data ? [[result.data.id, result.data.name] as const] : [])));
}

export function useLeadCompanyNames(companyIds: readonly string[], enabled = true): ReadonlyMap<string, string> {
  const { workspaceId, readable } = useCompanyReader();
  return useQueries({
    combine: companyNamesOf,
    queries: companyIds.map((companyId) => ({
      queryKey: leadCompanyKeys.company(workspaceId, companyId),
      queryFn: async ({ signal }: { signal: AbortSignal }) => required(await getLeadCompanyAction(companyId, signal), "lead company"),
      enabled: enabled && readable && companyId !== "",
      refetchOnWindowFocus: false,
    })),
  });
}

export function useRefreshLeadCompanies() {
  const client = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  return useCallback(() => client.invalidateQueries({ queryKey: leadCompanyKeys.all(workspaceId) }), [client, workspaceId]);
}
