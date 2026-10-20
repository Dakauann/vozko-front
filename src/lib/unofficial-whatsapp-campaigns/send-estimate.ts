import type { CampaignSendEstimate, UnofficialWhatsAppCampaign } from "./types";

export type SendTimeParts =
  | { key: "underMinute" }
  | { key: "minutes"; minutes: number }
  | { key: "hours"; hours: number; minutes: number };

export function sendTimeParts(seconds: number): SendTimeParts {
  if (!Number.isFinite(seconds) || seconds < 60) return { key: "underMinute" };
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return { key: "minutes", minutes };
  return { key: "hours", hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

export function remainingToShow(campaign: Pick<UnofficialWhatsAppCampaign, "status" | "estimate">): CampaignSendEstimate | null {
  if (campaign.status !== "RUNNING" || !campaign.estimate || campaign.estimate.pending <= 0) return null;
  return campaign.estimate;
}

export type CampaignTarget = { kind: "leads"; count: number } | { kind: "groups"; names: string[]; more: number };

export function campaignTarget(campaign: Pick<UnofficialWhatsAppCampaign, "audience" | "targetNames" | "metrics">): CampaignTarget {
  const total = campaign.metrics?.totalNumbers ?? 0;
  if (campaign.audience !== "groups") return { kind: "leads", count: total };
  const names = campaign.targetNames ?? [];
  return { kind: "groups", names, more: Math.max(total - names.length, 0) };
}

export function anyCampaignRunning(campaigns: readonly Pick<UnofficialWhatsAppCampaign, "status">[]): boolean {
  return campaigns.some((campaign) => campaign.status === "RUNNING");
}
