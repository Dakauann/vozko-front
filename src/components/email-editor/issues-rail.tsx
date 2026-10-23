"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { CheckCircle } from "@/components/icons";
import { findBlock } from "@/lib/email-design/document";
import type { Document, Hint, Issue } from "@/lib/email-design/types";
import { cn } from "@/lib/utils";

import { blockSummary } from "./block-meta";

export type RailEntry = { kind: "issue"; item: Issue } | { kind: "hint"; item: Hint };

interface IssuesRailProps {
  document: Document;
  issues?: readonly Issue[];
  hints?: readonly Hint[];
  onJump: (entry: RailEntry) => void;
}

export function useIssueText() {
  const t = useTranslations("emailEditor");
  return (entry: RailEntry): string => {
    const key = `${entry.kind === "issue" ? "issues" : "hints"}.${entry.item.code}`;
    return t.has(key) ? t(key) : t(entry.kind === "issue" ? "rail.unknownIssue" : "rail.unknownHint", { code: entry.item.code });
  };
}

export function IssuesRail({ document, issues, hints, onJump }: IssuesRailProps) {
  const t = useTranslations("emailEditor");
  const text = useIssueText();
  const titleId = useId();
  const issueList = issues ?? [];
  const hintList = hints ?? [];
  const checked = issues !== undefined || hints !== undefined;
  const entries: RailEntry[] = [...issueList.map((item): RailEntry => ({ kind: "issue", item })), ...hintList.map((item): RailEntry => ({ kind: "hint", item }))];

  const place = (entry: RailEntry): string => {
    const id = entry.item.block_id;
    if (id) {
      const found = findBlock(document, id);
      if (!found) return t("rail.placeMissing");
      const kind = t(`palette.kinds.${found.block.kind}.label`);
      const summary = blockSummary(found.block);
      return summary ? `${kind} \u00b7 ${summary}` : kind;
    }
    if ("field" in entry.item && entry.item.field === "subject") return t("rail.placeSubject");
    if (entry.kind === "hint" && entry.item.code.startsWith("subject_")) return t("rail.placeSubject");
    return t("rail.placeDocument");
  };

  return (
    <section aria-labelledby={titleId} className="flex min-h-0 flex-col">
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
        <h2 id={titleId} className="legend">
          {t("rail.title")}
        </h2>
        {entries.length > 0 ? (
          <span className="flex items-center gap-2.5 text-2xs text-muted-foreground">
            {issueList.length > 0 ? (
              <span className="inline-flex items-center gap-1" title={t("rail.issuesCount", { count: issueList.length })}>
                <span aria-hidden className="h-2 w-2 rounded-full bg-destructive" />
                <span className="readout font-semibold text-foreground">{issueList.length}</span>
                <span className="sr-only">{t("rail.issuesCount", { count: issueList.length })}</span>
              </span>
            ) : null}
            {hintList.length > 0 ? (
              <span className="inline-flex items-center gap-1" title={t("rail.hintsCount", { count: hintList.length })}>
                <span aria-hidden className="h-2 w-2 rounded-full bg-warning" />
                <span className="readout font-semibold text-foreground">{hintList.length}</span>
                <span className="sr-only">{t("rail.hintsCount", { count: hintList.length })}</span>
              </span>
            ) : null}
          </span>
        ) : null}
      </header>
      {entries.length === 0 ? (
        <p className="flex items-start gap-2 px-4 pb-4 text-xs leading-relaxed text-muted-foreground">
          {checked ? <CheckCircle className="mt-px h-4 w-4 shrink-0 text-healthy" weight="fill" /> : null}
          {checked ? t("rail.clear") : t("rail.waiting")}
        </p>
      ) : (
        <ul className="min-h-0 space-y-0.5 overflow-y-auto px-2 pb-3">
          {entries.map((entry, index) => (
            <li key={`${entry.kind}-${entry.item.code}-${entry.item.block_id ?? ""}-${"field" in entry.item ? (entry.item.field ?? "") : ""}-${index}`}>
              <button
                type="button"
                onClick={() => onJump(entry)}
                className="flex w-full items-start gap-2.5 rounded-[--radius] px-2 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span aria-hidden className={cn("mt-[5px] h-2 w-2 shrink-0 rounded-full", entry.kind === "issue" ? "bg-destructive" : "bg-warning")} />
                <span className="min-w-0">
                  <span className="sr-only">{entry.kind === "issue" ? t("rail.issueLabel") : t("rail.hintLabel")}</span>
                  <span className="block text-xs leading-snug text-foreground">{text(entry)}</span>
                  <span className="mt-0.5 block truncate text-2xs text-muted-foreground">{place(entry)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
