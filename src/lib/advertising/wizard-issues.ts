import type { WizardMode } from "@/lib/advertising/draft";
import type { FieldIssue } from "@/lib/advertising/issues";

export type DraftIssue = FieldIssue;

export type WizardStep = "objective" | "campaign" | "adSet" | "ads" | "review";

export function stepsFor(mode: WizardMode): WizardStep[] {
  switch (mode) {
    case "creative":
      return ["ads", "review"];
    case "adSet":
      return ["objective", "ads", "review"];
    case "campaign":
      return ["objective", "adSet", "ads", "review"];
  }
  return ["objective", "campaign", "adSet", "ads", "review"];
}

function rootOf(field: string): string {
  return field.split(/[.[]/, 1)[0];
}

function preferred(step: WizardStep, mode: WizardMode): WizardStep {
  const steps = stepsFor(mode);
  return steps.includes(step) ? step : steps[0];
}

export function stepOfIssue(field: string, mode: WizardMode): WizardStep {
  if (field === "campaign.objective" || field === "adAccountId") return preferred("objective", mode);
  switch (rootOf(field)) {
    case "campaign":
      return preferred("campaign", mode);
    case "adSet":
      return preferred("adSet", mode);
    case "identity":
    case "ads":
      return "ads";
  }
  return "review";
}

export function adIndexOfIssue(field: string): number | null {
  const match = /^ads\[(\d+)\]/.exec(field);
  return match ? Number(match[1]) : null;
}

export function issuesForField(issues: DraftIssue[], field: string): DraftIssue[] {
  return issues.filter((issue) => issue.field === field);
}

export function issuesUnder(issues: DraftIssue[], prefix: string): DraftIssue[] {
  return issues.filter((issue) => issue.field === prefix || issue.field.startsWith(`${prefix}.`) || issue.field.startsWith(`${prefix}[`));
}

export function issuesForStep(issues: DraftIssue[], step: WizardStep, mode: WizardMode): DraftIssue[] {
  return issues.filter((issue) => stepOfIssue(issue.field, mode) === step);
}

export function adHasIssues(issues: DraftIssue[], index: number): boolean {
  return issues.some((issue) => adIndexOfIssue(issue.field) === index);
}

export function issueMessageKey(issue: DraftIssue): string {
  const path = issue.field.replace(/\[\d+\]/g, "").replace(/\./g, "_");
  return `${path}.${issue.code}`;
}

export function issuesFromExpected(expected: Record<string, string> | undefined): DraftIssue[] {
  return Object.entries(expected ?? {}).map(([field, code]) => ({ field, code }));
}

export function issuesFromCreativeEdit(expected: Record<string, string> | undefined): DraftIssue[] {
  return issuesFromExpected(expected).map((issue) => ({
    ...issue,
    field: issue.field === "creative" || issue.field.startsWith("creative.") ? `ads[0].${issue.field}` : issue.field,
  }));
}
