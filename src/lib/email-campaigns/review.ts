import type { AudienceSummary, LaunchIssue, LaunchIssueCode, SkipReason } from "./types";

export const WIZARD_STEPS = ["content", "audience", "review", "send"] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export function wizardStepOf(value: string | null | undefined): WizardStep {
  return WIZARD_STEPS.find((step) => step === value) ?? "content";
}

export type FunnelStageKey = "matched" | "with_email" | "sendable";

export interface FunnelStage {
  key: FunnelStageKey;
  value: number;
  dropped: { reason: SkipReason; count: number }[];
}

const DROPS: Record<FunnelStageKey, readonly SkipReason[]> = {
  matched: [],
  with_email: ["no_email"],
  sendable: [
    "invalid_address",
    "duplicate",
    "unsubscribed",
    "opted_out",
    "blocked",
    "suppressed",
    "bad_address",
    "no_mail_domain",
    "disposable",
    "domain_unknown",
    "domain_checking",
    "inactive",
    "missing_variable",
  ],
};

export function audienceFunnel(audience: AudienceSummary): FunnelStage[] {
  const skipped = audience.skipped ?? {};
  const dropped = (key: FunnelStageKey) =>
    DROPS[key].map((reason) => ({ reason, count: skipped[reason] ?? 0 })).filter((row) => row.count > 0);
  return [
    { key: "matched", value: audience.matched, dropped: dropped("matched") },
    { key: "with_email", value: audience.with_email, dropped: dropped("with_email") },
    { key: "sendable", value: audience.sendable, dropped: dropped("sendable") },
  ];
}

export type IssueFix = { kind: "link"; href: string } | { kind: "step"; step: WizardStep } | { kind: "wait" };

const FIXES: Record<LaunchIssueCode, IssueFix> = {
  sender_missing: { kind: "link", href: "/dashboard/email/senders" },
  sender_not_verified: { kind: "link", href: "/dashboard/email/senders" },
  account_paused: { kind: "link", href: "/dashboard/email/senders" },
  document_invalid: { kind: "step", step: "content" },
  subject_invalid: { kind: "step", step: "content" },
  audience_empty: { kind: "step", step: "audience" },
  balance_insufficient: { kind: "link", href: "/dashboard/balance" },
  schedule_in_past: { kind: "step", step: "send" },
  domains_checking: { kind: "wait" },
};

export const REVIEW_WAIT_POLL_MS = 3000;

export function reviewWaits(check: { blocking: readonly LaunchIssue[] } | undefined): boolean {
  return check?.blocking.some((issue) => issueFix(issue.code).kind === "wait") ?? false;
}

export function issueFix(code: LaunchIssueCode): IssueFix {
  return FIXES[code];
}

export function hasIssue(issues: readonly LaunchIssue[], code: LaunchIssueCode): boolean {
  return issues.some((issue) => issue.code === code);
}
