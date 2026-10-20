import type { LintIssue } from "./types";

export type LintSeverityKind = "blocking" | "advisory" | "info";

export function lintSeverityOf(issue: Pick<LintIssue, "severity">): LintSeverityKind {
  if (issue.severity === "blocking") return "blocking";
  if (issue.severity === "info") return "info";
  return "advisory";
}

const SEVERITY_ORDER: Record<LintSeverityKind, number> = { blocking: 0, advisory: 1, info: 2 };

export function lintCounts(issues: readonly LintIssue[]): Record<LintSeverityKind, number> {
  const counts: Record<LintSeverityKind, number> = { blocking: 0, advisory: 0, info: 0 };
  for (const issue of issues) counts[lintSeverityOf(issue)] += 1;
  return counts;
}

export function sortedLintIssues(issues: readonly LintIssue[]): LintIssue[] {
  return issues
    .map((issue, index) => ({ issue, index }))
    .sort((a, z) => SEVERITY_ORDER[lintSeverityOf(a.issue)] - SEVERITY_ORDER[lintSeverityOf(z.issue)] || a.index - z.index)
    .map(({ issue }) => issue);
}
