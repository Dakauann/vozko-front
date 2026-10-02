import type { AdBudgetMinimum } from "./types";

export type ExpectedIssues = Record<string, string>;

export interface FieldIssue {
  field: string;
  code: string;
  minimum?: AdBudgetMinimum;
}

export const BELOW_MINIMUM = "below_minimum";

export function withBudgetMinimum<I extends FieldIssue>(issues: I[], minimum: AdBudgetMinimum | null | undefined): I[] {
  if (!minimum) return issues;
  return issues.map((issue) => (issue.code === BELOW_MINIMUM ? { ...issue, minimum } : issue));
}

export function issueFieldKey(field: string): string {
  return field.replace(/\[\d+\]/g, "").replace(/\./g, "_");
}

export function issuesAt(expected: ExpectedIssues | undefined, field: string): FieldIssue[] {
  if (!expected) return [];
  return Object.entries(expected)
    .filter(([key]) => key === field)
    .map(([key, code]) => ({ field: key, code }));
}

export function issuesUnder(expected: ExpectedIssues | undefined, prefix: string): FieldIssue[] {
  if (!expected) return [];
  return Object.entries(expected)
    .filter(([key]) => key === prefix || key.startsWith(`${prefix}.`) || key.startsWith(`${prefix}[`))
    .map(([key, code]) => ({ field: key, code }));
}

export function withoutIssue(expected: ExpectedIssues, field: string): ExpectedIssues {
  if (!(field in expected)) return expected;
  const next = { ...expected };
  delete next[field];
  return next;
}
