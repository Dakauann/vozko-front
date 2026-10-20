"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { fetchCampaignProgress, fetchCampaignTimeline } from "@/app/actions/campaign-live";
import { useWorkspace } from "@/contexts/workspace-context";
import { sectionRetryDelay, shouldRetrySection } from "@/lib/analytics/section-query";
import { campaignLiveKey, liveRefetchInterval, type CampaignChannel, type TimelineBucket } from "@/lib/campaigns/live";

const LIVE_OPTIONS = {
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  staleTime: 0,
  retry: shouldRetrySection,
  retryDelay: sectionRetryDelay,
} as const;

export function useCampaignProgress(channel: CampaignChannel, campaignId: string) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  return useQuery({
    ...LIVE_OPTIONS,
    queryKey: campaignLiveKey(channel, workspaceId, campaignId, "progress"),
    queryFn: ({ signal }) => fetchCampaignProgress(channel, campaignId, signal),
    enabled: workspaceId !== "" && campaignId !== "",
    refetchInterval: (query) => liveRefetchInterval(query.state.data),
  });
}

export function useCampaignTimeline(channel: CampaignChannel, campaignId: string, bucket: TimelineBucket | undefined) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  return useQuery({
    ...LIVE_OPTIONS,
    queryKey: campaignLiveKey(channel, workspaceId, campaignId, "timeline", bucket),
    queryFn: ({ signal }) => fetchCampaignTimeline(channel, campaignId, bucket, signal),
    enabled: workspaceId !== "" && campaignId !== "",
    refetchInterval: (query) => liveRefetchInterval(query.state.data),
    placeholderData: keepPreviousData,
  });
}

const FOLLOW_UP_MIN_MS = 15_000;

export function useLiveFollowUp({
  sampledAt,
  liveStatus,
  campaignStatus,
  onSample,
  onStatusChange,
}: {
  sampledAt: string | undefined;
  liveStatus: string | undefined;
  campaignStatus: string;
  onSample: () => void;
  onStatusChange: () => void;
}) {
  const lastFollowUpRef = useRef(0);
  const running = liveStatus === "RUNNING";

  useEffect(() => {
    if (!running || !sampledAt) return;
    if (Date.now() - lastFollowUpRef.current < FOLLOW_UP_MIN_MS) return;
    const timer = window.setTimeout(() => {
      lastFollowUpRef.current = Date.now();
      onSample();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sampledAt, running, onSample]);

  useEffect(() => {
    if (!liveStatus || liveStatus === campaignStatus) return;
    const timer = window.setTimeout(onStatusChange, 0);
    return () => window.clearTimeout(timer);
  }, [liveStatus, campaignStatus, onStatusChange]);
}
