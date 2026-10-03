import type { FieldIssue } from "@/lib/advertising/issues";

export type DraftIssue = FieldIssue;

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
