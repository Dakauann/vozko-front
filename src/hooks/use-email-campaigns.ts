"use client";

import { keepPreviousData, partialMatchKey, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  fetchEmailCampaign,
  fetchEmailCampaignDomains,
  fetchEmailCampaignLinks,
  fetchEmailCampaignMetrics,
  fetchEmailCampaignRecipients,
  fetchEmailCampaignReview,
  fetchEmailCampaigns,
  fetchEmailCampaignTimeline,
  fetchEmailDesign,
  fetchEmailDesigns,
  fetchEmailSenders,
  fetchEmailStarters,
} from "@/app/actions/email-campaigns";
import { campaignAudienceCountRoot } from "@/components/campaign-audience/use-audience-queries";
import { useWorkspace } from "@/contexts/workspace-context";
import { leadQueryKeys } from "@/hooks/use-lead-records";
import { sectionRetryDelay, shouldRetrySection } from "@/lib/analytics/section-query";
import { REVIEW_WAIT_POLL_MS, reviewWaits } from "@/lib/email-campaigns/review";
import type { CampaignListQuery, CampaignStatus, RecipientQuery } from "@/lib/email-campaigns/types";

const BASE_OPTIONS = {
  refetchOnWindowFocus: false,
  retry: shouldRetrySection,
  retryDelay: sectionRetryDelay,
} as const;

const LIVE_OPTIONS = {
  ...BASE_OPTIONS,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  staleTime: 0,
} as const;

const SENDING_POLL_MS = 15_000;

export function emailCampaignsRoot(workspaceId: string) {
  return ["email-campaigns", workspaceId] as const;
}

export function emailCampaignKey(workspaceId: string, campaignId: string) {
  return [...emailCampaignsRoot(workspaceId), "campaign", campaignId] as const;
}

export function emailDesignsRoot(workspaceId: string) {
  return ["email-designs", workspaceId] as const;
}

function useWorkspaceId(): string {
  const { currentWorkspace } = useWorkspace();
  return currentWorkspace?.id ?? "";
}

export function campaignPollInterval(status: CampaignStatus | undefined): number | false {
  if (status === "running" || status === "held") return SENDING_POLL_MS;
  return false;
}

export function metricsPollInterval(data: { refresh_after_seconds: number } | undefined): number | false {
  if (!data || data.refresh_after_seconds <= 0) return false;
  return data.refresh_after_seconds * 1000;
}

export function useEmailCampaigns(params: CampaignListQuery) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    ...BASE_OPTIONS,
    queryKey: [...emailCampaignsRoot(workspaceId), "list", params],
    queryFn: ({ signal }) => fetchEmailCampaigns(params, signal),
    enabled: workspaceId !== "",
    placeholderData: keepPreviousData,
  });
}

export function useEmailCampaign(campaignId: string) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    ...LIVE_OPTIONS,
    queryKey: emailCampaignKey(workspaceId, campaignId),
    queryFn: ({ signal }) => fetchEmailCampaign(campaignId, signal),
    enabled: workspaceId !== "" && campaignId !== "",
    refetchInterval: (query) => campaignPollInterval(query.state.data?.status),
  });
}

export function emailCampaignReviewKey(workspaceId: string, campaignId: string) {
  return [...emailCampaignKey(workspaceId, campaignId), "review"] as const;
}

function useReviewFollowsAudience(workspaceId: string, campaignId: string, enabled: boolean) {
  const client = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const triggers = [campaignAudienceCountRoot(workspaceId, "email"), leadQueryKeys.all(workspaceId)];
    return client.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "invalidate") return;
      if (!triggers.some((key) => partialMatchKey(event.query.queryKey, key))) return;
      void client.invalidateQueries({ queryKey: emailCampaignReviewKey(workspaceId, campaignId) });
    });
  }, [client, workspaceId, campaignId, enabled]);
}

export function useEmailCampaignReview(campaignId: string, enabled: boolean, version: string) {
  const workspaceId = useWorkspaceId();
  useReviewFollowsAudience(workspaceId, campaignId, enabled && workspaceId !== "" && campaignId !== "");
  return useQuery({
    ...BASE_OPTIONS,
    refetchOnWindowFocus: true,
    queryKey: [...emailCampaignReviewKey(workspaceId, campaignId), version],
    queryFn: ({ signal }) => fetchEmailCampaignReview(campaignId, signal),
    enabled: enabled && workspaceId !== "" && campaignId !== "",
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchInterval: (query) => (reviewWaits(query.state.data?.check) ? REVIEW_WAIT_POLL_MS : false),
  });
}

export function useEmailCampaignMetrics(campaignId: string, enabled = true) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    ...LIVE_OPTIONS,
    queryKey: [...emailCampaignKey(workspaceId, campaignId), "metrics"],
    queryFn: ({ signal }) => fetchEmailCampaignMetrics(campaignId, signal),
    enabled: enabled && workspaceId !== "" && campaignId !== "",
    refetchInterval: (query) => metricsPollInterval(query.state.data),
  });
}

export function useEmailCampaignTimeline(campaignId: string, enabled = true) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    ...LIVE_OPTIONS,
    queryKey: [...emailCampaignKey(workspaceId, campaignId), "timeline"],
    queryFn: ({ signal }) => fetchEmailCampaignTimeline(campaignId, signal),
    enabled: enabled && workspaceId !== "" && campaignId !== "",
    refetchInterval: (query) => metricsPollInterval(query.state.data),
    placeholderData: keepPreviousData,
  });
}

export function useEmailCampaignSection<T>(campaignId: string, section: "links" | "domains", interval: number | false, enabled = true) {
  const workspaceId = useWorkspaceId();
  const fetchers = { links: fetchEmailCampaignLinks, domains: fetchEmailCampaignDomains };
  return useQuery({
    ...LIVE_OPTIONS,
    queryKey: [...emailCampaignKey(workspaceId, campaignId), section],
    queryFn: ({ signal }) => fetchers[section](campaignId, signal) as Promise<T>,
    enabled: enabled && workspaceId !== "" && campaignId !== "",
    refetchInterval: interval,
    placeholderData: keepPreviousData,
  });
}

export function useEmailCampaignRecipients(campaignId: string, params: RecipientQuery, interval: number | false) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    ...LIVE_OPTIONS,
    queryKey: [...emailCampaignKey(workspaceId, campaignId), "recipients", params],
    queryFn: ({ signal }) => fetchEmailCampaignRecipients(campaignId, params, signal),
    enabled: workspaceId !== "" && campaignId !== "",
    refetchInterval: interval,
    placeholderData: keepPreviousData,
  });
}

export function useEmailSenders(enabled = true) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    ...BASE_OPTIONS,
    queryKey: ["email-senders", workspaceId],
    queryFn: ({ signal }) => fetchEmailSenders(signal),
    enabled: enabled && workspaceId !== "",
    staleTime: 60_000,
  });
}

export function useEmailStarters(enabled = true) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    ...BASE_OPTIONS,
    queryKey: ["email-starters", workspaceId],
    queryFn: ({ signal }) => fetchEmailStarters(signal),
    enabled: enabled && workspaceId !== "",
    staleTime: 10 * 60_000,
  });
}

export function useEmailDesigns(params: { kind?: "template" | "campaign"; page?: number; pageSize?: number }, enabled = true) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    ...BASE_OPTIONS,
    queryKey: [...emailDesignsRoot(workspaceId), "list", params],
    queryFn: ({ signal }) => fetchEmailDesigns(params, signal),
    enabled: enabled && workspaceId !== "",
    placeholderData: keepPreviousData,
  });
}

export function useEmailDesign(designId: string) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    ...BASE_OPTIONS,
    queryKey: [...emailDesignsRoot(workspaceId), "design", designId],
    queryFn: ({ signal }) => fetchEmailDesign(designId, signal),
    enabled: workspaceId !== "" && designId !== "",
  });
}
