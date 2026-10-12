"use client";

import { useTranslations } from "next-intl";

import { Sparkle } from "@/components/icons";
import { aiActionsFor } from "@/lib/studio/ai-actions";
import { artboardOfItem } from "@/lib/studio/artboards";
import type { Layer } from "@/lib/studio/document";
import { cn } from "@/lib/utils";

import { imageAiTarget, startCutout } from "./ai-actions";
import { OUTLINE_BUTTON_CLASS } from "./controls";
import { useEditorUi, useImageDoc, useImageEditor } from "./editor-state";
import { JobStatusList, useJobsFor } from "./jobs";

export function RemoveBackground({ layer, tourTarget }: { layer: Layer | null; tourTarget?: boolean }) {
  const t = useTranslations("studio.image.removeBackground");
  const { commands } = useImageEditor();
  const allJobs = useEditorUi((s) => s.jobs);
  const surface = useImageDoc((s) => (layer ? artboardOfItem(s.document, layer.id) : undefined));
  const target = surface && layer ? imageAiTarget(surface, [layer], allJobs, false) : null;
  const source = target?.source ?? null;
  const action = target ? aiActionsFor(target.subject).find((state) => state.definition.id === "removeBackground") : undefined;
  const jobs = useJobsFor("cutout", source?.layerId ?? null);
  return (
    <div className="space-y-2" data-tour={tourTarget ? "studio-image-remove-bg" : undefined}>
      <button type="button" className={cn(OUTLINE_BUTTON_CLASS, "w-full")} disabled={!action?.enabled || !source} onClick={() => source && startCutout(commands, source)}>
        <Sparkle className="h-3.5 w-3.5" aria-hidden />
        {t("run")}
      </button>
      <p className="text-2xs text-muted-foreground">{source ? (target?.subject.locked ? t("locked") : t("hint")) : t("pickImage")}</p>
      <JobStatusList jobs={jobs} />
    </div>
  );
}
