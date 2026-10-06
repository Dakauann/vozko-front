"use client";

import { useTranslations } from "next-intl";

import { CircleNotch, WarningCircle } from "@/components/icons";
import type { MediaGenerationError } from "@/hooks/use-media-generation";
import type { MediaKind } from "@/lib/media-generation/types";

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
  return null;
}
