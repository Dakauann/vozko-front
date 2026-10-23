"use client";

import { useQuery } from "@tanstack/react-query";

import { isDraftActionError, listCampaignDraftsAction } from "@/app/actions/campaign-drafts";
import { useWorkspace } from "@/contexts/workspace-context";
import type { DraftChannel } from "@/lib/campaign-drafts/types";

export function campaignDraftsRoot(workspaceId: string) {
  return ["campaign-drafts", workspaceId] as const;
}

export function campaignDraftsKey(workspaceId: string, channel: DraftChannel) {
  return [...campaignDraftsRoot(workspaceId), channel] as const;
}

export function useCampaignDraftsWorkspace(): string {
  const { currentWorkspace } = useWorkspace();
  return currentWorkspace?.id ?? "";
}

export function useCampaignDrafts(channel: DraftChannel) {
  const workspaceId = useCampaignDraftsWorkspace();
  return useQuery({
    queryKey: campaignDraftsKey(workspaceId, channel),
    enabled: workspaceId !== "",
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const result = await listCampaignDraftsAction(channel, signal);
      if (isDraftActionError(result)) throw new Error(result.code ?? result.error);
      return result.data.items;
    },
  });
}
