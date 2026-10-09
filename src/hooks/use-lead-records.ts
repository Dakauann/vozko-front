"use client";

import { useCallback } from "react";
import { useQueryClient, type InfiniteData, type QueryClient, type QueryKey } from "@tanstack/react-query";

import {
  getEntryLeadCardAction,
  getLeadByIdAction,
  getLeadSummaryAction,
  listLeadDealsAction,
  listLeadRelativesAction,
  listLeadTimelineAction,
} from "@/app/actions/leads";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSectionPagesQuery, useSectionQuery } from "@/hooks/use-section-query";
import { SectionError } from "@/lib/analytics/section-query";
import type { CodedError } from "@/lib/api/coded-error";
import type { LeadDetailSummary } from "@/lib/leads/detail-summary";
import type { ConversationEntryType, LeadDetail } from "@/lib/leads/types";

export const LEAD_RELATIVES_PAGE_SIZE = 50;

export const LEAD_HISTORY_PAGE_SIZE = 30;

export const leadQueryKeys = {
  lead: (workspaceId: string, leadId: string) => ["lead", workspaceId, leadId] as const,
  detail: (workspaceId: string, leadId: string) => ["lead", workspaceId, leadId, "detail"] as const,
  summary: (workspaceId: string, leadId: string) => ["lead", workspaceId, leadId, "summary"] as const,
  relatives: (workspaceId: string, leadId: string) => ["lead", workspaceId, leadId, "relatives"] as const,
  timeline: (workspaceId: string, leadId: string) => ["lead-timeline", workspaceId, leadId] as const,
  deals: (workspaceId: string, leadId: string) => ["lead-deals", workspaceId, leadId] as const,
  entryCard: (workspaceId: string, entryType: string, entryId: string, version: number | undefined) =>
    ["entry-lead-card", workspaceId, entryType, entryId, version ?? 0] as const,
};

function refetchFirstPage(client: QueryClient, queryKey: QueryKey) {
  client.setQueryData<InfiniteData<unknown, unknown>>(queryKey, (data) =>
    data && data.pages.length > 1 ? { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) } : data,
  );
  void client.invalidateQueries({ queryKey, exact: true });
}

export function refreshLeadQueries(client: QueryClient, workspaceId: string, leadId: string) {
  void client.invalidateQueries({ queryKey: leadQueryKeys.lead(workspaceId, leadId) });
  refetchFirstPage(client, leadQueryKeys.timeline(workspaceId, leadId));
}

export function refreshLeadDeals(client: QueryClient, workspaceId: string, leadId: string) {
  void client.invalidateQueries({ queryKey: leadQueryKeys.deals(workspaceId, leadId) });
  void client.invalidateQueries({ queryKey: leadQueryKeys.summary(workspaceId, leadId), exact: true });
  refetchFirstPage(client, leadQueryKeys.timeline(workspaceId, leadId));
}

export function forgetLeadQueries(client: QueryClient, workspaceId: string, leadId: string) {
  for (const queryKey of [leadQueryKeys.lead(workspaceId, leadId), leadQueryKeys.timeline(workspaceId, leadId), leadQueryKeys.deals(workspaceId, leadId)]) {
    client.removeQueries({ queryKey });
  }
}

function sectionErrorOf(error: CodedError, what: string): SectionError {
  return new SectionError(error.code ?? error.message ?? `${what} failed`, error.status);
}

export function isMissingSection(error: unknown): boolean {
  return error instanceof SectionError && error.status === 404;
}

export function isForbiddenSection(error: unknown): boolean {
  return error instanceof SectionError && error.status === 403;
}

export function useLeadDetail(leadId: string) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const client = useQueryClient();
  const key = leadQueryKeys.detail(workspaceId, leadId);

  const query = useSectionQuery<LeadDetail>({
    queryKey: key,
    queryFn: async (signal) => {
      const result = await getLeadByIdAction(leadId, signal);
      if (result.error) throw sectionErrorOf(result.error, "lead detail");
      return result.lead;
    },
    enabled: workspaceId !== "" && leadId !== "",
  });

  const update = useCallback(
    (change: (detail: LeadDetail) => LeadDetail) =>
      client.setQueryData<LeadDetail>(leadQueryKeys.detail(workspaceId, leadId), (current) => (current ? change(current) : current)),
    [client, workspaceId, leadId],
  );

  const reload = useCallback(() => refreshLeadQueries(client, workspaceId, leadId), [client, workspaceId, leadId]);

  return { query, update, reload };
}

export function useLeadSummary(leadId: string, enabled = true) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  return useSectionQuery<LeadDetailSummary>({
    queryKey: leadQueryKeys.summary(workspaceId, leadId),
    queryFn: async (signal) => {
      const result = await getLeadSummaryAction(leadId, signal);
      if (result.error) throw sectionErrorOf(result.error, "lead summary");
      return result.summary;
    },
    enabled: enabled && workspaceId !== "" && leadId !== "",
  });
}

export function useLeadRelatives(leadId: string, enabled: boolean) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  return useSectionPagesQuery({
    queryKey: leadQueryKeys.relatives(workspaceId, leadId),
    queryFn: async (after, signal) => {
      const { page, error } = await listLeadRelativesAction(leadId, { after: after || undefined, limit: LEAD_RELATIVES_PAGE_SIZE }, signal);
      if (!page) throw sectionErrorOf(error ?? {}, "lead relatives");
      return page;
    },
    nextCursor: (page) => page.next,
    enabled: enabled && workspaceId !== "" && leadId !== "",
  });
}

export function useLeadTimeline(leadId: string, enabled: boolean) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  return useSectionPagesQuery({
    queryKey: leadQueryKeys.timeline(workspaceId, leadId),
    queryFn: async (before, signal) => {
      const { page, error } = await listLeadTimelineAction(leadId, { before: before || undefined, limit: LEAD_HISTORY_PAGE_SIZE }, signal);
      if (!page) throw sectionErrorOf(error ?? {}, "lead timeline");
      return page;
    },
    nextCursor: (page) => page.next,
    enabled: enabled && workspaceId !== "" && leadId !== "",
  });
}

export function useLeadDeals(leadId: string, enabled: boolean) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  return useSectionPagesQuery({
    queryKey: leadQueryKeys.deals(workspaceId, leadId),
    queryFn: async (before, signal) => {
      const { page, error } = await listLeadDealsAction(leadId, { before: before || undefined, limit: LEAD_HISTORY_PAGE_SIZE }, signal);
      if (!page) throw sectionErrorOf(error ?? {}, "lead deals");
      return page;
    },
    nextCursor: (page) => page.next,
    enabled: enabled && workspaceId !== "" && leadId !== "",
  });
}

export function useEntryLeadCard({
  entryId,
  entryType,
  leadVersion,
  enabled,
}: {
  entryId: string;
  entryType: ConversationEntryType;
  leadVersion: number | undefined;
  enabled: boolean;
}) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const sameEntry = useCallback(
    (previousKey: QueryKey) => {
      const previous = leadQueryKeys.entryCard(workspaceId, entryType, entryId, undefined);
      return previous.slice(0, 4).every((part, index) => previousKey[index] === part);
    },
    [workspaceId, entryType, entryId],
  );
  return useSectionQuery({
    queryKey: leadQueryKeys.entryCard(workspaceId, entryType, entryId, leadVersion),
    queryFn: async (signal) => {
      const result = await getEntryLeadCardAction(entryId, entryType, signal);
      if (result.error) throw sectionErrorOf(result.error, "lead card");
      return result.card;
    },
    enabled: enabled && workspaceId !== "" && entryId !== "",
    keepPreviousWhen: sameEntry,
  });
}
