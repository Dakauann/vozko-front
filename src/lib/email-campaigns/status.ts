import type { StatusChipTone } from "@/components/elevated-design/status-chip";

import type { ResourceAction } from "@/lib/workspace/types";

import type { CampaignAction, CampaignStatus, HoldReason } from "./types";

export const STATUS_TONE: Record<CampaignStatus, StatusChipTone> = {
  draft: "outline",
  ready: "neutral",
  scheduled: "neutral",
  running: "healthy",
  paused: "warning",
  held: "fault",
  completed: "muted",
  stopped: "muted",
};

export type CampaignCommand = "start" | "pause" | "resume" | "stop" | "unschedule";

export const ACTION_PERMISSION: Record<CampaignAction, ResourceAction> = {
  edit: "update",
  delete: "delete",
  ready: "start",
  schedule: "start",
  unschedule: "start",
  launch: "start",
  start: "start",
  resume: "start",
  pause: "stop",
  stop: "stop",
};

const COMMAND_ORDER: readonly CampaignCommand[] = ["start", "unschedule", "resume", "pause", "stop"];

type Allowed = (action: ResourceAction) => boolean;

export function canRun(actions: readonly string[] | undefined, action: CampaignAction, allowed: Allowed): boolean {
  return (actions ?? []).includes(action) && allowed(ACTION_PERMISSION[action]);
}

export function campaignCommands(actions: readonly string[] | undefined, allowed: Allowed): CampaignCommand[] {
  return COMMAND_ORDER.filter((command) => canRun(actions, command, allowed));
}

export function isWizardStatus(status: CampaignStatus): boolean {
  return status === "draft";
}

export function isLaunched(status: CampaignStatus): boolean {
  return status === "running" || status === "paused" || status === "held" || status === "completed" || status === "stopped";
}

export function isSending(status: CampaignStatus): boolean {
  return status === "running" || status === "held";
}

export function holdReasonOf(reason: string | undefined | null): HoldReason | null {
  switch (reason) {
    case "daily_cap":
    case "account_paused":
    case "sender_unavailable":
    case "balance_insufficient":
      return reason;
  }
  return null;
}

export function campaignHref(id: string, status: CampaignStatus): string {
  return isWizardStatus(status) ? wizardHref(id) : `/dashboard/email/campaigns/${id}`;
}

export function wizardHref(id: string, step?: string): string {
  const params = new URLSearchParams({ campaign: id });
  if (step) params.set("step", step);
  return `/dashboard/email/campaigns/new?${params.toString()}`;
}
