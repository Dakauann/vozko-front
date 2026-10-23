import type { RcsContentIssue } from "@/lib/rcs/types";

export function cardPath(card: number, field?: string): string {
  return field ? `cards[${card}].${field}` : `cards[${card}]`;
}

export function suggestionPath(card: number, index: number): string {
  return card < 0 ? `suggestions[${index}]` : `${cardPath(card)}.suggestions[${index}]`;
}

export function issuesAt(issues: readonly RcsContentIssue[], path: string): RcsContentIssue[] {
  return issues.filter((issue) => issue.path === path);
}

export function issuesUnder(issues: readonly RcsContentIssue[], prefix: string): RcsContentIssue[] {
  return issues.filter((issue) => issue.path === prefix || issue.path.startsWith(`${prefix}.`) || issue.path.startsWith(`${prefix}[`));
}

export function messageIssues(issues: readonly RcsContentIssue[]): RcsContentIssue[] {
  return issues.filter((issue) => issue.path === "");
}
