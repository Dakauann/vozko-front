"use client";

import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { CaretDown, FileCsv, Queue, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProgressTrack } from "@/components/ui/progress-panel";
import type { TrackedLeadImport } from "@/lib/leads/import-tracker";
import { isLeadImportActive, leadImportPercent, type LeadImportSummary } from "@/lib/leads/imports";
import { cn } from "@/lib/utils";

import { importFailureLabel, type ImportTranslator } from "./import-messages";
import { useLeadImportSettled, useLeadImportTracker, useTrackedImports } from "./use-lead-imports";

function isRunning(entry: TrackedLeadImport): boolean {
  return isLeadImportActive(entry.summary.status) && !entry.gone;
}

export function LeadImportsStatus({
  onOpen,
  onImported,
  visibleJobId,
}: {
  onOpen: (id: string) => void;
  onImported: () => void;
  visibleJobId: string | null;
}) {
  const t = useTranslations("leadsPage.import") as unknown as ImportTranslator;
  const format = useFormatter();
  const tracker = useLeadImportTracker();
  const tracked = useTrackedImports(tracker);

  useLeadImportSettled(tracker, (job: LeadImportSummary) => {
    if (job.status === "done") onImported();
    if (job.id === visibleJobId) return;
    const action = { label: t("toast.open"), onClick: () => onOpen(job.id) };
    if (job.status === "done") {
      toast.success(t("toast.done", { file: job.fileName }), {
        description: t("toast.doneDescription", {
          created: job.result?.created ?? 0,
          enriched: job.result?.enriched ?? 0,
        }),
        action,
      });
    } else if (job.status === "failed") {
      toast.error(t("toast.failed", { file: job.fileName }), {
        description: importFailureLabel(t, job.failureCode),
        action,
      });
    } else if (job.status === "analyzed") {
      toast(t("toast.analyzed", { file: job.fileName }), { action });
    }
  });

  if (tracked.length === 0) return null;
  const running = tracked.filter(isRunning).length;

  const statusOf = (entry: TrackedLeadImport): string => {
    if (entry.gone) return t("status.gone");
    if (entry.pollError) return t("status.pollFailed");
    const job = entry.summary;
    switch (job.status) {
      case "importing":
        return t("status.importing", { processed: format.number(job.processed), total: format.number(job.totalRows) });
      case "done":
        return t("status.done", { created: job.result?.created ?? 0 });
      default:
        return t(`status.${job.status}`);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="secondary" size="sm" className="gap-1.5 [&_svg]:size-3.5">
          <Queue className="text-muted-foreground" aria-hidden />
          {t("status.button")}
          {running > 0 ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-foreground">
              {t("status.running", { count: running })}
            </span>
          ) : null}
          <CaretDown className="text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <p className="px-2 pb-1.5 pt-1 text-xs font-semibold text-muted-foreground">{t("status.title")}</p>
        <ul className="max-h-80 space-y-0.5 overflow-y-auto">
          {tracked.map((entry) => {
            const job = entry.summary;
            const active = isRunning(entry);
            const name = job.fileName || entry.id;
            return (
              <li key={entry.id} className="flex items-start gap-1">
                <button
                  type="button"
                  onClick={() => onOpen(entry.id)}
                  disabled={entry.gone}
                  className="min-w-0 flex-1 rounded-[--radius] px-2 py-1.5 text-left transition-colors duration-150 hover:bg-[hsl(var(--accent-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span className="flex min-w-0 items-center gap-1.5 text-sm text-foreground">
                    <FileCsv className="h-3.5 w-3.5 shrink-0 text-muted-foreground" weight="fill" aria-hidden />
                    <span className="truncate">{name}</span>
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block text-2xs tabular-nums",
                      job.status === "failed" || entry.pollError ? "text-warning-ink" : "text-muted-foreground",
                    )}
                  >
                    {statusOf(entry)}
                  </span>
                  {active ? (
                    <ProgressTrack label={t("progress.label")} percent={leadImportPercent(job)} className="mt-1 h-1" />
                  ) : null}
                </button>
                {!active ? (
                  <button
                    type="button"
                    onClick={() => tracker.forget(entry.id)}
                    aria-label={t("status.dismiss", { file: name })}
                    title={t("status.dismiss", { file: name })}
                    className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-3.5 w-3.5" weight="bold" aria-hidden />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
