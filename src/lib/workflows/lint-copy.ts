import type { CodedTranslator } from "@/lib/api/coded-error";

import type { LintIssue } from "./types";

export function localizedLintIssues(t: CodedTranslator, issues: LintIssue[]): LintIssue[] {
  return issues.map((issue) => {
    const key = `lint.${issue.code}`;
    return t.has(key) ? { ...issue, message: t(key) } : issue;
  });
}
