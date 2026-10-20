"use client";

import { memo } from "react";
import { useLocale, useNow, useTranslations } from "next-intl";

import ElevatedButton from "@/components/elevated-design/button";
import { relativeSince } from "@/lib/format/relative-since";
import { draftStatusCopy, type DraftSaveStatus, type DraftStatusCopy } from "@/lib/workflows/draft-save";
import { cn } from "@/lib/utils";

const TICK_MS = 1000;

const DOT_CLASS: Record<DraftStatusCopy["tone"], string> = {
  muted: "bg-muted-foreground",
  healthy: "bg-healthy",
  fault: "bg-destructive",
  warning: "bg-warning",
};

function SavedAgo({ at }: { at: number }) {
  const t = useTranslations("workflowsPage.draftSave");
  const locale = useLocale();
  const now = useNow({ updateInterval: TICK_MS });
  const ago = relativeSince(new Date(at).toISOString(), now, locale);
  return <>{ago ? t("saved", { ago }) : t("savedNoTime")}</>;
}

function DraftSaveStatusView({
  status,
  onRetry,
  onResolve,
}: {
  status: DraftSaveStatus;
  onRetry: () => void;
  onResolve: () => void;
}) {
  const t = useTranslations("workflowsPage.draftSave");
  const copy = draftStatusCopy(status);
  if (!copy) return null;

  const failure = status.kind === "failed" ? t("failed", { reason: status.message || t("unknownError") }) : null;
  const label = status.kind === "saved" && status.at !== null ? <SavedAgo at={status.at} /> : (failure ?? t(copy.key));

  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-2 text-xs", failure ? "text-foreground" : "text-muted-foreground")}
      title={t("hint")}
    >
      <span role="status" aria-live="polite" title={failure ?? undefined} className="inline-flex min-w-0 items-center gap-1.5">
        <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASS[copy.tone])} />
        <span className={failure ? "line-clamp-2 max-w-[22rem] font-medium" : "max-w-[16rem] truncate whitespace-nowrap"}>{label}</span>
      </span>
      {copy.action === "retry" && <ElevatedButton variant="outline-subtle" size="sm" title={t("retry")} onClick={onRetry} />}
      {copy.action === "resolve" && <ElevatedButton variant="outline-subtle" size="sm" title={t("resolve")} onClick={onResolve} />}
    </span>
  );
}

export const DraftSaveStatusLine = memo(DraftSaveStatusView);
