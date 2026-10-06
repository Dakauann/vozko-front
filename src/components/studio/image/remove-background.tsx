"use client";

import { useTranslations } from "next-intl";

import { Sparkle } from "@/components/icons";
import type { Layer } from "@/lib/studio/document";
import { cn } from "@/lib/utils";

import { OUTLINE_BUTTON_CLASS } from "./controls";
import { useImageEditor } from "./editor-state";
import { JobStatusList, useJobsFor } from "./jobs";

export function RemoveBackground({ layer, tourTarget }: { layer: Layer | null; tourTarget?: boolean }) {
  const t = useTranslations("studio.image.removeBackground");
  const { commands } = useImageEditor();
  const jobs = useJobsFor("cutout", layer?.id ?? null);
  const running = jobs.some((job) => !job.error);
  const usable = layer?.type === "image" && Boolean(layer.assetId) && !layer.locked;
  return (
    <div className="space-y-2" data-tour={tourTarget ? "studio-image-remove-bg" : undefined}>
      <button
        type="button"
        className={cn(OUTLINE_BUTTON_CLASS, "w-full")}
        disabled={running || !usable}
        onClick={() => layer?.assetId && void commands.startJob("cutout", { kind: "cutout", sourceMediaId: layer.assetId }, layer.id)}
      >
        <Sparkle className="h-3.5 w-3.5" aria-hidden />
        {t("run")}
      </button>
      <p className="text-2xs text-muted-foreground">{layer?.type === "image" ? (layer.locked ? t("locked") : t("hint")) : t("pickImage")}</p>
      <JobStatusList jobs={jobs} />
    </div>
  );
}
