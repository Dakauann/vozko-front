"use client";

import { useCallback } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { StatusChip, type StatusChipTone } from "@/components/elevated-design/status-chip";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { ProgressTrack } from "@/components/ui/progress-panel";
import { codedErrorMessage, type CodedError } from "@/lib/api/coded-error";
import { callListProgress, skippedReasons } from "@/lib/call-lists/progress";
import { CALL_LIST_FAILURES, type CallList, type CallListStatus } from "@/lib/call-lists/types";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<CallListStatus, StatusChipTone> = {
  building: "outline",
  active: "healthy",
  paused: "neutral",
  archived: "muted",
  failed: "warning",
};

export function callListStatusTone(status: CallListStatus): StatusChipTone {
  return STATUS_TONE[status];
}

export function CallListStatusChip({ status }: { status: CallListStatus }) {
  const t = useTranslations("callLists.status");
  return <StatusChip tone={callListStatusTone(status)} label={t(status)} />;
}

export function useCallListError() {
  const t = useTranslations("callLists");
  return useCallback((error: CodedError) => codedErrorMessage(t, error, t("errors.generic")), [t]);
}

export function useCallListFailure() {
  const t = useTranslations("callLists.failures");
  return useCallback(
    (code: string | undefined) => t((CALL_LIST_FAILURES as readonly string[]).includes(code ?? "") ? (code as string) : "unknown"),
    [t],
  );
}

export function useCallListPhoneLabel() {
  const t = useTranslations("callLists.phone");
  const tLabels = useTranslations("leadSheet.phones.labels");
  return useCallback(
    (list: CallList) => (list.phone.source === "contact" && list.phone.label ? t("contact", { label: tLabels(list.phone.label) }) : t("identity")),
    [t, tLabels],
  );
}

export function CallListProgressCell({ list }: { list: CallList }) {
  const t = useTranslations("callLists");
  const failure = useCallListFailure();
  if (list.status === "building") {
    return (
      <div className="flex min-w-[10rem] flex-col gap-1.5">
        <ProgressTrack label={t("progress.label")} />
        <span className="text-xs text-muted-foreground">{t("table.building", { selected: list.selected })}</span>
      </div>
    );
  }
  if (list.status === "failed") {
    return <span className="text-xs text-warning-ink">{failure(list.failureCode)}</span>;
  }
  const progress = callListProgress(list);
  return (
    <div className="flex min-w-[10rem] flex-col gap-1.5">
      <ProgressTrack label={t("progress.label")} percent={progress.percent} />
      <span className="text-xs tabular-nums text-muted-foreground">{t("table.progressValue", { closed: progress.closed, total: progress.total })}</span>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const format = useFormatter();
  const content = (
    <span className="flex items-baseline gap-1.5 text-xs text-muted-foreground">
      {label}
      <b className="text-sm font-semibold tabular-nums text-foreground">{format.number(value)}</b>
    </span>
  );
  return hint ? (
    <TooltipWrapper content={hint}>
      <span tabIndex={0} className="rounded-[--radius] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {content}
      </span>
    </TooltipWrapper>
  ) : (
    content
  );
}

export function CallListStats({ list, className }: { list: CallList; className?: string }) {
  const t = useTranslations("callLists");
  const format = useFormatter();
  const progress = callListProgress(list);
  const reasons = skippedReasons(list.skipped);
  const skippedHint = reasons.map(({ reason, count }) => `${t(`skipped.${reason}`)}: ${format.number(count)}`).join(" · ");
  return (
    <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[--radius] border border-border bg-card px-4 py-2.5", className)}>
      <Stat label={t("progress.total")} value={progress.total} />
      <Stat label={t("progress.open")} value={progress.open} />
      <Stat label={t("progress.called")} value={list.calledCount} />
      <Stat label={t("progress.callbacks")} value={list.callbackCount} />
      <Stat label={t("progress.closed")} value={progress.closed} />
      {progress.skipped > 0 ? <Stat label={t("progress.skipped")} value={progress.skipped} hint={skippedHint} /> : null}
      <span className="flex min-w-[12rem] flex-1 items-center gap-2 sm:ml-auto sm:max-w-xs">
        <ProgressTrack label={t("progress.label")} percent={list.status === "building" ? undefined : progress.percent} />
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{t("progress.percent", { percent: progress.percent })}</span>
      </span>
    </div>
  );
}
