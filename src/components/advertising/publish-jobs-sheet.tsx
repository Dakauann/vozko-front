"use client";

import { useTranslations } from "next-intl";

import { ArrowClockwise, ArrowSquareOut } from "@/components/icons";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { jobStatusKey } from "@/lib/advertising/delivery";
import { META_ADS_MANAGER_URL } from "@/lib/advertising/connect";
import type { AdAccount, AdPublishJob } from "@/lib/advertising/types";
import { cn } from "@/lib/utils";

import { JobStatus } from "./status-dot";
import { useAdsFormat } from "./use-ads-format";

export function PublishJobsSheet({
  open,
  onOpenChange,
  jobs,
  loading,
  error,
  accounts,
  onRefresh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: AdPublishJob[];
  loading: boolean;
  error: string | null;
  accounts: AdAccount[];
  onRefresh: () => void;
}) {
  const t = useTranslations("adsManager.jobs");
  const fmt = useAdsFormat();
  const accountName = (id: string) => accounts.find((account) => account.id === id)?.name ?? id;
  const dateFormat = new Intl.DateTimeFormat(fmt.tag, { dateStyle: "short", timeStyle: "short" });

  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent side="right" className="w-full sm:max-w-md">
        <ElevatedSheetHeader>
          <ElevatedSheetTitle className="text-xl">{t("title")}</ElevatedSheetTitle>
          <ElevatedSheetDescription>{t("description")}</ElevatedSheetDescription>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-primary-ink hover:underline disabled:opacity-50"
          >
            <ArrowClockwise className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
            {t("refresh")}
          </button>
        </ElevatedSheetHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {error ? <p className="text-sm text-destructive-ink">{error}</p> : null}
          {!error && !loading && jobs.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
          {loading && jobs.length === 0 ? <div className="h-24 animate-pulse rounded-md bg-muted" /> : null}
          <ul className="divide-y divide-border">
            {jobs.map((job) => {
              const status = jobStatusKey(job.status);
              return (
                <li key={job.id} className="space-y-1.5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{job.campaignName}</p>
                      <p className="truncate text-2xs text-muted-foreground">
                        {accountName(job.adAccountId)} · <span className="tabular-nums">{dateFormat.format(new Date(job.createdAt))}</span>
                      </p>
                    </div>
                    <JobStatus status={job.status} />
                  </div>
                  {status === "NEEDS_REVIEW" ? (
                    <p className="text-xs text-warning-ink">
                      {t("needsReview")}{" "}
                      <a
                        href={META_ADS_MANAGER_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 font-semibold text-primary-ink hover:underline"
                      >
                        {t("openMeta")}
                        <ArrowSquareOut className="h-3 w-3" aria-hidden />
                      </a>
                    </p>
                  ) : null}
                  {job.errorMessage && status !== "PUBLISHED" ? (
                    <p className="break-words text-xs text-destructive-ink">{job.errorMessage}</p>
                  ) : null}
                  {job.fee === "refunded" ? <p className="text-2xs text-muted-foreground">{t("feeRefunded")}</p> : null}
                  {job.fee === "charged" && status === "NEEDS_REVIEW" ? (
                    <p className="text-2xs text-muted-foreground">{t("feeKept")}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
