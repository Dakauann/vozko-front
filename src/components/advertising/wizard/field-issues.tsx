"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { WarningCircle } from "@/components/icons";
import { issueMessageKey, issuesForField, issuesUnder, type DraftIssue } from "@/lib/advertising/wizard-issues";

import { useBudgetMinimumText } from "../budget-minimum";

export function useIssueMessage() {
  const t = useTranslations("adsWizard.issues");
  const minimumText = useBudgetMinimumText();
  return useCallback(
    (issue: DraftIssue) => {
      if (issue.minimum) return minimumText("below", issue.minimum);
      const specific = issueMessageKey(issue);
      if (t.has(specific)) return t(specific);
      if (t.has(`generic.${issue.code}`)) return t(`generic.${issue.code}`);
      return t("generic.unknown", { field: issue.field, code: issue.code });
    },
    [t, minimumText],
  );
}

export function IssueList({ issues }: { issues: DraftIssue[] }) {
  const message = useIssueMessage();
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-1" role="alert">
      {issues.map((issue) => (
        <li key={`${issue.field}-${issue.code}`} className="flex items-start gap-1.5 text-xs text-destructive-ink">
          <WarningCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {message(issue)}
        </li>
      ))}
    </ul>
  );
}

export function FieldIssues({ issues, field, nested = false }: { issues: DraftIssue[]; field: string; nested?: boolean }) {
  return <IssueList issues={nested ? issuesUnder(issues, field) : issuesForField(issues, field)} />;
}
