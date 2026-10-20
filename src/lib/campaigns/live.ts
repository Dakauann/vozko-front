import type { CampaignMetrics, CampaignStatus } from "@/lib/campaigns/metrics";

export type CampaignChannel = "whatsapp" | "unofficial_whatsapp";

export type TimelineBucket = "minute" | "hour" | "day";

export const TIMELINE_BUCKETS: readonly TimelineBucket[] = ["minute", "hour", "day"];

export interface CampaignPace {
  processedPerMinute: number;
  remainingSeconds?: number;
}

export interface CampaignProgress {
  status: CampaignStatus;
  metrics: CampaignMetrics;
  pace?: CampaignPace;
  sampledAt: string;
  refreshAfterSeconds: number;
}

export interface CampaignTimelinePoint {
  at: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface CampaignTimeline {
  bucket: TimelineBucket;
  from?: string;
  to?: string;
  timezone: string;
  points: CampaignTimelinePoint[];
  refreshAfterSeconds: number;
}

const CAMPAIGN_PATH: Record<CampaignChannel, string> = {
  whatsapp: "/whatsapp/campaigns",
  unofficial_whatsapp: "/unofficial-whatsapp/campaigns",
};

export function campaignLivePath(channel: CampaignChannel, campaignId: string, section: "progress" | "timeline", bucket?: TimelineBucket): string {
  const path = `${CAMPAIGN_PATH[channel]}/${campaignId}/${section}`;
  return bucket ? `${path}?bucket=${bucket}` : path;
}

export function campaignLiveKey(channel: CampaignChannel, workspaceId: string, campaignId: string, section: "progress" | "timeline", bucket?: TimelineBucket) {
  return ["campaign-live", channel, workspaceId, campaignId, section, bucket ?? "auto"] as const;
}

export function liveRefetchInterval(data: { refreshAfterSeconds: number } | undefined): number | false {
  if (!data || data.refreshAfterSeconds <= 0) return false;
  return data.refreshAfterSeconds * 1000;
}
