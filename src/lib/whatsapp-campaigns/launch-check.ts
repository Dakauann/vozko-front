export type LaunchLevel = "block" | "confirm" | "advice";

export type LaunchCode =
  | "nothing_pending"
  | "access_revoked"
  | "health_unreadable"
  | "template_not_ready"
  | "form_not_sendable"
  | "phone_unavailable"
  | "monthly_cap_full"
  | "template_red"
  | "template_yellow"
  | "template_flagged"
  | "template_reclassified"
  | "no_exit"
  | "last_run_failures"
  | "last_run_spam_limit"
  | "balance_short"
  | "last_run_engagement"
  | "last_run_undeliverable"
  | "opted_out_pending"
  | "cap_below_pending";

export interface LaunchFinding {
  code: LaunchCode;
  level: LaunchLevel;
  observed?: number;
  limit?: number;
}

export interface LaunchReport {
  findings: LaunchFinding[];
  fingerprint: string;
  blocks: boolean;
  needsConfirmation: boolean;
}

export const LAUNCH_LEVELS: readonly LaunchLevel[] = ["block", "confirm", "advice"];

export function findingsByLevel(report: LaunchReport): Record<LaunchLevel, LaunchFinding[]> {
  const grouped: Record<LaunchLevel, LaunchFinding[]> = { block: [], confirm: [], advice: [] };
  for (const finding of report.findings) grouped[finding.level].push(finding);
  return grouped;
}

export function launchAllowed(report: LaunchReport, confirmed: boolean): boolean {
  if (report.blocks) return false;
  return !report.needsConfirmation || confirmed;
}

export function hasFindings(report: LaunchReport): boolean {
  return report.findings.length > 0;
}

export const LAUNCH_REFUSAL_CODES = new Set(["campaign_launch_blocked", "campaign_launch_unconfirmed"]);
