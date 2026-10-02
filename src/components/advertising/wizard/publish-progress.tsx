"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ArrowClockwise, ArrowLeft, CheckCircle, Circle, CircleNotch } from "@/components/icons";
import { META_ADS_MANAGER_URL } from "@/lib/advertising/connect";
import { jobOutcome, jobSteps, type JobPlan } from "@/lib/advertising/publish";
import type { AdPublishJob } from "@/lib/advertising/types";

import { JobStatus } from "../status-dot";
import { useAdsErrorText } from "../use-ads-error";
import { ExternalLink } from "./choice-row";

export function PublishProgress({
  job,
  plan,
  pollError,
  onRetryPoll,
  onBackToDraft,
  onOpenJobs,
}: {
  job: AdPublishJob;
  plan: JobPlan;
  pollError: string | null;
  onRetryPoll: () => void;
  onBackToDraft: () => void;
  onOpenJobs: () => void;
}) {
  const t = useTranslations("adsWizard.job");
  const errorText = useAdsErrorText();
  const outcome = jobOutcome(job.status);
  const steps = jobSteps(job.progress, plan);
  const firstPending = steps.findIndex((step) => !step.done);

  return (
    <div className="space-y-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-foreground">{t("title")}</span>
        <JobStatus status={job.status} />
      </div>

      <ol className="space-y-1.5">
        {steps.map((step, index) => {
          const active = outcome === "working" && index === firstPending;
          return (
            <li key={step.key} className="flex items-center gap-2 text-sm">
              {step.done ? (
                <CheckCircle className="h-4 w-4 text-healthy-ink" weight="fill" aria-hidden />
              ) : active ? (
                <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />
              )}
              <span className={step.done ? "text-foreground" : "text-muted-foreground"}>
                {step.key === "ads" ? t("steps.ads", { created: step.created ?? 0, total: step.total ?? 0 }) : t(`steps.${step.key}`)}
              </span>
            </li>
          );
        })}
      </ol>

      {outcome === "working" ? <p className="text-xs text-muted-foreground">{plan.activates ? t("running") : t("runningPaused")}</p> : null}
      {outcome === "published" ? <p className="text-xs text-healthy-ink">{t("published")}</p> : null}

      {outcome === "failed" ? (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-destructive-ink">{t("failedTitle")}</p>
          {job.errorMessage ? (
            <p className="break-words text-xs text-destructive-ink">{errorText({ error: job.errorMessage, code: job.errorCode })}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">{job.fee === "refunded" ? t("failedRefunded") : t("failedHint")}</p>
        </div>
      ) : null}

      {outcome === "needsReview" ? (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-warning-ink">{t("needsReviewTitle")}</p>
          <p className="text-xs text-warning-ink">{t("needsReview")}</p>
          {job.errorMessage ? <p className="break-words text-2xs text-muted-foreground">{job.errorMessage}</p> : null}
          <ExternalLink href={META_ADS_MANAGER_URL}>{t("openMeta")}</ExternalLink>
        </div>
      ) : null}

      {pollError ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-warning-ink">
          <span>{t("pollFailed", { message: pollError })}</span>
          <button type="button" onClick={onRetryPoll} className="inline-flex items-center gap-1 font-semibold text-primary-ink hover:underline">
            <ArrowClockwise className="h-3.5 w-3.5" aria-hidden />
            {t("pollRetry")}
          </button>
        </div>
      ) : null}

      {outcome !== "published" ? (
        <div className="flex flex-wrap items-center gap-2">
          {outcome === "failed" || outcome === "needsReview" ? (
            <Button
              variant="primary"
              title={t("backToDraft")}
              icon={<ArrowLeft className="h-4 w-4" />}
              iconVisible
              iconSide="left"
              onClick={onBackToDraft}
            />
          ) : null}
          <Button variant="secondary" title={t("openJobs")} onClick={onOpenJobs} />
        </div>
      ) : null}
    </div>
  );
}
