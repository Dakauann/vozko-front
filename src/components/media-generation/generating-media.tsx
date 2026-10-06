"use client";

import { useTranslations } from "next-intl";

import { WarningCircle } from "@/components/icons";
import { ProgressPanel } from "@/components/ui/progress-panel";
import { useEstimatedProgress } from "@/hooks/use-estimated-progress";
import type { ImageAspect } from "@/lib/image-generation/types";
import { cn } from "@/lib/utils";

export const IMAGE_ASPECT_CLASS: Record<ImageAspect, string> = {
  square: "aspect-square",
  portrait: "aspect-[4/5]",
  story: "aspect-[9/16]",
};

function GeneratingProgress({ aspect, className }: { aspect: ImageAspect; className?: string }) {
  const t = useTranslations("imageGeneration");
  const progress = useEstimatedProgress();
  return <ProgressPanel label={t("generating")} progress={progress} className={cn(IMAGE_ASPECT_CLASS[aspect], className)} />;
}

export function GeneratingImage({ aspect, failed = false, className }: { aspect: ImageAspect; failed?: boolean; className?: string }) {
  const t = useTranslations("imageGeneration");
  if (!failed) return <GeneratingProgress aspect={aspect} className={className} />;
  return (
    <div
      role="alert"
      className={cn(
        IMAGE_ASPECT_CLASS[aspect],
        "flex flex-col items-center justify-center gap-2 rounded-[--radius] border border-destructive/30 bg-destructive/5 px-6 text-center",
        className,
      )}
    >
      <WarningCircle weight="bold" className="h-5 w-5 text-destructive-ink" aria-hidden />
      <span className="text-xs font-medium text-destructive-ink">{t("failed")}</span>
    </div>
  );
}
