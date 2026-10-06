"use client";

import { useTranslations } from "next-intl";

import { WarningCircle } from "@/components/icons";
import { ProgressPanel } from "@/components/ui/progress-panel";
import { useEstimatedProgress } from "@/hooks/use-estimated-progress";
import type { MediaFrame, MediaKind } from "@/lib/media-generation/types";
import { cn } from "@/lib/utils";

export const MEDIA_FRAME_CLASS: Record<MediaFrame, string> = {
  square: "aspect-square",
  portrait: "aspect-[4/5]",
  story: "aspect-[9/16]",
  landscape: "aspect-video",
  audio: "h-[60px] w-[260px] max-w-full",
};

interface GeneratingMediaProps {
  kind: MediaKind;
  frame: MediaFrame;
  failed?: boolean;
  settling?: boolean;
  className?: string;
}

function GeneratingProgress({ kind, frame, settling, className }: Omit<GeneratingMediaProps, "failed">) {
  const t = useTranslations("mediaGeneration");
  const progress = useEstimatedProgress();
  const label = settling ? t("finalizing") : t(`generating.${kind}`);
  return <ProgressPanel label={label} progress={progress} className={cn(MEDIA_FRAME_CLASS[frame], className)} />;
}

export function GeneratingMedia({ kind, frame, failed = false, settling = false, className }: GeneratingMediaProps) {
  const t = useTranslations("mediaGeneration");
  if (!failed) return <GeneratingProgress kind={kind} frame={frame} settling={settling} className={className} />;
  return (
    <div
      role="alert"
      className={cn(
        MEDIA_FRAME_CLASS[frame],
        "notice notice-fault flex flex-col items-center justify-center gap-2 px-6 text-center",
        className,
      )}
    >
      <WarningCircle weight="bold" className="notice-ink h-5 w-5" aria-hidden />
      <span className="notice-ink text-xs font-medium">{t(`failed.${kind}`)}</span>
    </div>
  );
}
