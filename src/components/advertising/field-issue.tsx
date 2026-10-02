"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { WarningCircle } from "@/components/icons";
import { issueFieldKey, type FieldIssue } from "@/lib/advertising/issues";

export type IssueNamespace = "adsManager" | "adsAudiences" | "adsForms" | "adsRules" | "adsConversions";

export function useIssueText(namespace: IssueNamespace) {
  const t = useTranslations(namespace);
  return useCallback(
    (issue: FieldIssue) => {
      const specific = `issues.${issueFieldKey(issue.field)}.${issue.code}`;
      if (t.has(specific)) return t(specific);
      const generic = `issues.generic.${issue.code}`;
      if (t.has(generic)) return t(generic);
      return t("issues.generic.unknown", { field: issue.field, code: issue.code });
    },
    [t],
  );
}

export function IssueList({ namespace, issues }: { namespace: IssueNamespace; issues: FieldIssue[] }) {
  const text = useIssueText(namespace);
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-1" role="alert">
      {issues.map((issue) => (
        <li key={`${issue.field}-${issue.code}`} className="flex items-start gap-1.5 text-xs text-destructive-ink">
          <WarningCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {text(issue)}
        </li>
      ))}
    </ul>
  );
}
