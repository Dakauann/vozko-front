"use client";

import { ArrowClockwise, CheckCircle, CircleNotch, Warning } from "@/components/icons";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { getFacebookPublishJobAction } from "@/app/actions/facebook";
import { useFacebookError } from "@/components/facebook/use-facebook-error";
import { PUBLISH_JOB_POLL_MS, isTerminalJob, jobOutcome } from "@/lib/facebook/publish-job";
import type { FacebookPublishJob, FacebookPublishJobStatus } from "@/lib/facebook/types";
import { cn } from "@/lib/utils";

const STEPS: FacebookPublishJobStatus[] = ["QUEUED", "UPLOADING", "PROCESSING"];

export function PublishJobStatus({
  pageId,
  job: initial,
  pageLink,
  onSettled,
}: {
  pageId: string;
  job: FacebookPublishJob;
  pageLink?: string;
  onSettled: (job: FacebookPublishJob) => void;
}) {
  const t = useTranslations("facebook.publishJob");
  const describeError = useFacebookError();
  const [job, setJob] = useState(initial);
  const [pollError, setPollError] = useState<string | null>(null);
  const [pollKey, setPollKey] = useState(0);

  useEffect(() => {
    if (isTerminalJob(job.status) || pollError) return;
    const timer = window.setTimeout(() => {
      void getFacebookPublishJobAction(pageId, job.id).then((result) => {
        if ("error" in result) {
          setPollError(describeError(result));
          return;
        }
        if (!result.job) {
          setPollError(t("pollFailed"));
          return;
        }
        setJob(result.job);
        if (isTerminalJob(result.job.status)) onSettled(result.job);
      });
    }, PUBLISH_JOB_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [pageId, job.id, job.status, pollError, pollKey, describeError, onSettled, t]);

  const outcome = jobOutcome(job);

  if (outcome === "published" || outcome === "scheduled") {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-healthy-ink">
        <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" weight="fill" />
        {outcome === "published"
          ? t("published")
          : t("scheduled", { date: job.scheduledAt ? new Date(job.scheduledAt).toLocaleString() : "" })}
      </p>
    );
  }

  if (outcome === "ambiguous") {
    return (
      <div className="space-y-1 rounded-lg bg-muted p-3 text-xs text-warning-ink">
        <p className="flex items-start gap-2 font-medium">
          <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" weight="fill" />
          {t("ambiguous")}
        </p>
        {pageLink ? (
          <a href={pageLink} target="_blank" rel="noreferrer noopener" className="ml-5 inline-block text-primary-ink hover:underline">
            {t("openPage")}
          </a>
        ) : null}
      </div>
    );
  }

  if (outcome === "failed") {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-destructive-ink">
        <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" weight="fill" />
        {t("failed", { error: job.error?.message || t("noReason") })}
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <ol className="flex flex-wrap items-center gap-2 text-2xs">
        {STEPS.map((step) => {
          const index = STEPS.indexOf(step);
          const current = STEPS.indexOf(job.status);
          return (
            <li
              key={step}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                index < current
                  ? "bg-muted text-healthy-ink"
                  : index === current
                    ? "bg-muted font-semibold text-foreground"
                    : "text-muted-foreground",
              )}
            >
              {index === current && !pollError ? <CircleNotch className="h-3 w-3 animate-spin" /> : null}
              {t(`status.${step.toLowerCase()}`)}
            </li>
          );
        })}
      </ol>
      {pollError ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-destructive-ink">
          <Warning className="h-3.5 w-3.5" />
          {t("pollError", { error: pollError })}
          <button
            type="button"
            onClick={() => {
              setPollError(null);
              setPollKey((k) => k + 1);
            }}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-foreground hover:bg-muted"
          >
            <ArrowClockwise className="h-3 w-3" />
            {t("checkAgain")}
          </button>
        </div>
      ) : (
        <p className="text-2xs text-muted-foreground">{t("pendingHint")}</p>
      )}
    </div>
  );
}
