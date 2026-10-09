"use client";

import { useTranslations } from "next-intl";

import { CheckCircle, CircleNotch, WarningCircle, X } from "@/components/icons";
import type { MediaGenerationError } from "@/hooks/use-media-generation";
import { ceilingFor } from "@/lib/media-generation/limits";
import type { MediaKind } from "@/lib/media-generation/types";

import { useVideoEditor } from "../editor-context";
import { jobStatusOf } from "../jobs";
import type { VideoJob } from "../view-store";

const KNOWN_ERRORS = new Set(["insufficient_funds", "too_many_jobs", "timed_out", "invalid_request", "wrong_type", "not_image", "cost_unreported"]);

interface JobStatusProps {
  kind: MediaKind;
  status: "idle" | "generating" | "done" | "failed";
  settling: boolean;
  error?: MediaGenerationError;
}

export function JobStatus({ kind, status, settling, error }: JobStatusProps) {
  const t = useTranslations("mediaGeneration");
  const tj = useTranslations("studio.video.jobs");
  if (status === "generating") {
    return (
      <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CircleNotch className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {settling ? t("finalizing") : t(`generating.${kind}`)}
      </p>
    );
  }
  if (status === "failed") {
    return (
      <p role="alert" className="notice notice-fault flex items-start gap-1.5 px-2 py-1.5 text-xs">
        <WarningCircle className="notice-ink mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="text-foreground">
          {t(`failed.${kind}`)}
          {error && KNOWN_ERRORS.has(error.code) ? `. ${tj(`errors.${error.code}`)}` : ""}
        </span>
      </p>
    );
  }
  if (status === "done") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle className="h-3.5 w-3.5 text-healthy-ink" aria-hidden />
        {tj("placed")}
      </p>
    );
  }
  return null;
}

export function JobList({ kind, jobs, blocked }: { kind: MediaKind; jobs: VideoJob[]; blocked: boolean }) {
  const tj = useTranslations("studio.video.jobs");
  const { commands } = useVideoEditor();
  if (jobs.length === 0 && !blocked) return null;
  return (
    <div className="space-y-1.5">
      {blocked ? <p className="text-2xs text-muted-foreground">{tj("ceiling", { count: ceilingFor(kind) })}</p> : null}
      <ul className="space-y-1.5" aria-label={tj("list")}>
        {jobs.map((job) => {
          const view = jobStatusOf(job);
          return (
            <li key={job.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <JobStatus kind={kind} status={view.status} settling={view.settling} error={view.error} />
              </div>
              {job.byAgent ? <span className="mt-px shrink-0 rounded-[--radius] border border-border px-1.5 text-2xs font-medium text-muted-foreground">{tj("byElo")}</span> : null}
              {job.state !== "running" ? (
                <button
                  type="button"
                  aria-label={tj("dismiss")}
                  title={tj("dismiss")}
                  onClick={() => commands.dismissJob(job.id)}
                  className="-m-0.5 shrink-0 rounded-[--radius] p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
