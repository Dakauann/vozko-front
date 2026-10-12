"use client";

import { useTranslations } from "next-intl";

import type { ImageSurface, Layer } from "@/lib/studio/document";
import { pathOpsPatch } from "@/lib/studio/path-op-edits";
import { MERGE_MODES, takesPathOps, type PathOp } from "@/lib/studio/path-ops";
import { vectorLayerOf } from "@/lib/studio/vector-layer";
import { cn } from "@/lib/utils";

import { useShapeOpFeedback } from "../../canvas/vector/use-shape-op-feedback";
import { PathOpsFields } from "../../inspector/path-ops-fields";
import { InspectorSection, OUTLINE_BUTTON_CLASS } from "../controls";
import { useImageEditor } from "../editor-state";

export function PathOpsSection({ artboard, layers }: { artboard: ImageSurface; layers: Layer[] }) {
  const t = useTranslations("studio.pathOps");
  const { commands } = useImageEditor();
  const feedback = useShapeOpFeedback();
  const single = layers.length === 1 ? layers[0] : null;
  const locked = layers.some((layer) => layer.locked);
  const mergeable = layers.length > 1 && takesPathOps(layers[0]) && layers.every((layer) => vectorLayerOf(layer, artboard.canvas) !== null);

  if (single && takesPathOps(single)) {
    const change = (build: (ops: readonly PathOp[]) => PathOp[]) => commands.patchLayers([single.id], (layer) => pathOpsPatch(build(layer.pathOps ?? [])));
    return <PathOpsFields ops={single.pathOps ?? []} disabled={locked} onChange={change} />;
  }
  if (!mergeable) return null;
  return (
    <InspectorSection id="pathOpsLive" group="effects" title={t("live.title")}>
      <p className="text-2xs text-muted-foreground">{t("live.hint")}</p>
      <div role="group" aria-label={t("live.title")} className="flex flex-wrap gap-1">
        {MERGE_MODES.map((mode) => (
          <button key={mode} type="button" className={cn(OUTLINE_BUTTON_CLASS, "h-7")} disabled={locked} onClick={() => feedback(commands.liveMerge(mode))}>
            {t(`modes.${mode}`)}
          </button>
        ))}
      </div>
    </InspectorSection>
  );
}
