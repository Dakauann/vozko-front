import { apiClient } from "@/lib/api/browser-client";
import { requireSectionData } from "@/lib/analytics/section-query";
import {
  campaignLivePath,
  type CampaignChannel,
  type CampaignProgress,
  type CampaignTimeline,
  type TimelineBucket,
} from "@/lib/campaigns/live";

export async function fetchCampaignProgress(channel: CampaignChannel, campaignId: string, signal?: AbortSignal) {
  const response = await apiClient<CampaignProgress>(campaignLivePath(channel, campaignId, "progress"), { method: "GET", signal });
  return requireSectionData(response, "campaign progress");
}

export async function fetchCampaignTimeline(channel: CampaignChannel, campaignId: string, bucket: TimelineBucket | undefined, signal?: AbortSignal) {
  const response = await apiClient<CampaignTimeline>(campaignLivePath(channel, campaignId, "timeline", bucket), { method: "GET", signal });
  return requireSectionData(response, "campaign timeline");
}
