"use client";

import { useCallback } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

import {
  conversationHoldingAction,
  leadHoldingAction,
  listPortfolioAction,
  type PortfolioListQuery,
} from "@/app/actions/customer-portfolio";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSectionQuery } from "@/hooks/use-section-query";
import { codedSectionError } from "@/lib/analytics/section-query";
import type { ParsedAnswer } from "@/lib/api/parsed-request";
import type { EntryType } from "@/lib/conversations/types";
import { holderParam, type PortfolioHolding, type PortfolioPage } from "@/lib/customer-portfolio/portfolio";

export const portfolioKeys = {
  all: (workspaceId: string) => ["customer-portfolio", workspaceId] as const,
  page: (workspaceId: string, query: PortfolioListQuery) =>
    ["customer-portfolio", workspaceId, "page", holderParam(query.scope) ?? "mine", query.page, query.pageSize, query.search?.trim() ?? ""] as const,
  conversation: (workspaceId: string, entryType: EntryType, entryId: string) => ["customer-portfolio", workspaceId, "conversation", entryType, entryId] as const,
  lead: (workspaceId: string, leadId: string) => ["customer-portfolio", workspaceId, "lead", leadId] as const,
};

function required<T>(answer: ParsedAnswer<T>, what: string): T {
  if (answer.error) throw codedSectionError(answer.error, what);
  return answer.data;
}

export function usePortfolioAccess() {
  const { currentWorkspace, can } = useWorkspace();
  const { user } = useAuth();
  const workspaceId = currentWorkspace?.id ?? "";
  const views = workspaceId !== "" && can("customer_portfolios", "read");
  return {
    workspaceId,
    userId: user?.id ?? "",
    views,
    uses: views && can("customer_portfolios", "use"),
    manages: views && can("customer_portfolios", "manage"),
  };
}

export function usePortfolioPage(query: PortfolioListQuery) {
  const { workspaceId, views } = usePortfolioAccess();
  const sameWorkspace = useCallback((previous: QueryKey) => previous[1] === workspaceId, [workspaceId]);
  return useSectionQuery<PortfolioPage>({
    queryKey: portfolioKeys.page(workspaceId, query),
    queryFn: async (signal) => required(await listPortfolioAction(query, signal), "customer portfolio"),
    enabled: views,
    keepPreviousWhen: sameWorkspace,
  });
}

export function useConversationHolding(entryType: EntryType, entryId: string, enabled: boolean) {
  const { workspaceId, views } = usePortfolioAccess();
  return useSectionQuery<PortfolioHolding>({
    queryKey: portfolioKeys.conversation(workspaceId, entryType, entryId),
    queryFn: async (signal) => required(await conversationHoldingAction(entryType, entryId, signal), "conversation carteira"),
    enabled: enabled && views && entryId !== "",
  });
}

export function useLeadHolding(leadId: string) {
  const { workspaceId, views } = usePortfolioAccess();
  return useSectionQuery<PortfolioHolding>({
    queryKey: portfolioKeys.lead(workspaceId, leadId),
    queryFn: async (signal) => required(await leadHoldingAction(leadId, signal), "lead carteira"),
    enabled: views && leadId !== "",
  });
}

export function useRefreshPortfolio() {
  const client = useQueryClient();
  const { workspaceId } = usePortfolioAccess();
  return useCallback(() => client.invalidateQueries({ queryKey: portfolioKeys.all(workspaceId) }), [client, workspaceId]);
}
