import type { StatusChipTone } from "@/components/elevated-design/status-chip";

import type { EmailAccountStatus, EmailDomain, EmailDomainStatus, EmailMode, EmailProbation, EmailSender, EmailSetup } from "./types";

export const SENDING_LADDER: readonly EmailMode[] = ["probation", "trusted", "own_domain"];

export type LadderStepState = "done" | "current" | "next";

export interface LadderStep {
  mode: EmailMode;
  state: LadderStepState;
}

export function ladderSteps(mode: EmailMode): LadderStep[] {
  const current = SENDING_LADDER.indexOf(mode);
  return SENDING_LADDER.map((step, index) => ({
    mode: step,
    state: index < current ? "done" : index === current ? "current" : "next",
  }));
}

export function probationShare(probation: EmailProbation): number {
  if (probation.required_days <= 0) return 0;
  return Math.min(Math.max(probation.days / probation.required_days, 0), 1);
}

export function probationDaysLeft(probation: EmailProbation): number {
  return Math.max(probation.required_days - probation.days, 0);
}

export function isPausedAccount(status: EmailAccountStatus): boolean {
  return status === "paused_by_provider" || status === "paused_by_platform";
}

export function isDormantAccount(status: EmailAccountStatus): boolean {
  return status === "dormant";
}

const ACCOUNT_TONE: Record<EmailAccountStatus, StatusChipTone> = {
  active: "healthy",
  paused_by_provider: "fault",
  paused_by_platform: "fault",
  dormant: "neutral",
};

export function accountStatusTone(status: EmailAccountStatus): StatusChipTone {
  return ACCOUNT_TONE[status] ?? "muted";
}

const DOMAIN_TONE: Record<EmailDomainStatus, StatusChipTone> = {
  verified: "healthy",
  verifying: "warning",
  pending: "muted",
  failed: "fault",
};

export function domainStatusTone(status: EmailDomainStatus): StatusChipTone {
  return DOMAIN_TONE[status] ?? "muted";
}

export function usageShare(domain: EmailDomain): number | null {
  if (domain.daily_limit !== "capped" || domain.cap_today === undefined || domain.used_today === undefined || domain.cap_today <= 0) return null;
  return Math.min(Math.max(domain.used_today / domain.cap_today, 0), 1);
}

export function activeDomains(setup: EmailSetup): EmailDomain[] {
  return setup.domains.filter((domain) => domain.lifecycle === "active");
}

export function sendableDomains(setup: EmailSetup): EmailDomain[] {
  return setup.domains.filter((domain) => domain.sendable);
}

export function sendableSenders(setup: EmailSetup): EmailSender[] {
  const domains = new Set(sendableDomains(setup).map((domain) => domain.id));
  return setup.senders.filter((sender) => domains.has(sender.domain_id));
}

export function preferredSender(senders: readonly EmailSender[]): EmailSender | null {
  return senders.find((sender) => sender.is_default) ?? senders[0] ?? null;
}

export function hasOwnDomain(setup: EmailSetup): boolean {
  return activeDomains(setup).some((domain) => domain.kind === "own");
}
