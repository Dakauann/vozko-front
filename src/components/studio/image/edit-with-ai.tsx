"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { ElevatedDialog, ElevatedDialogBody, ElevatedDialogContent, ElevatedDialogDescription, ElevatedDialogHeader, ElevatedDialogTitle } from "@/components/elevated-design/elevated-dialog";
import { PencilSimple } from "@/components/icons";
import { MediaModelSelect } from "@/components/media-generation/media-model-select";
import { artboardOfItem } from "@/lib/studio/artboards";
import type { CanvasSize, Layer } from "@/lib/studio/document";
import { closestAspect } from "@/lib/studio/geometry";
import { slotAsset, type AssetSlot } from "@/lib/studio/image-sources";
import { cn } from "@/lib/utils";

import { FIELD_CLASS, OUTLINE_BUTTON_CLASS } from "./controls";
import { useEditorUi, useImageDoc, useImageEditor } from "./editor-state";
import { JobStatusList, useJobsFor } from "./jobs";
import { useLayerLabeler } from "./use-layer-label";

const MAX_PROMPT = 4000;

export function EditWithAiForm({ layer, canvas, slot = "asset", autoFocus }: { layer: Layer; canvas: CanvasSize; slot?: AssetSlot; autoFocus?: boolean }) {
  const t = useTranslations("studio.image.inspector.image");
  const { commands } = useImageEditor();
  const jobs = useJobsFor("edit", layer.id);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string | null>(null);
  const running = jobs.some((job) => !job.error);
  const text = prompt.trim();
  const assetId = slotAsset(layer, slot);

  const run = () => {
    if (!assetId || !model || !text) return;
    const aspect = closestAspect(layer.transform.w * canvas.width, layer.transform.h * canvas.height);
    void commands.startJob("edit", { kind: "image", model, prompt: text, aspect, referenceMediaIds: [assetId] }, layer.id, slot);
  };

  return (
    <>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">{t("editPrompt")}</span>
        <textarea
          value={prompt}
          maxLength={MAX_PROMPT}
          rows={3}
          autoFocus={autoFocus}
          placeholder={t("editPlaceholder")}
          onChange={(event) => setPrompt(event.target.value)}
          className={cn(FIELD_CLASS, "h-auto resize-y py-1.5 leading-snug")}
        />
      </label>
      <MediaModelSelect kind="image" value={model} onChange={setModel} disabled={running} />
      <button type="button" className={cn(OUTLINE_BUTTON_CLASS, "w-full")} disabled={running || !text || !model || !assetId} onClick={run}>
        <PencilSimple className="h-3.5 w-3.5" aria-hidden />
        {t("editRun")}
      </button>
      <p className="text-2xs text-muted-foreground">{t("editHint")}</p>
      <JobStatusList jobs={jobs} />
    </>
  );
}

export function EditWithAiDialog() {
  const t = useTranslations("studio.image.inspector.image");
  const { ui } = useImageEditor();
  const label = useLayerLabeler();
  const source = useEditorUi((s) => s.aiEditSource);
  const artboard = useImageDoc((s) => (source ? artboardOfItem(s.document, source.layerId) : undefined));
  const layer = source ? artboard?.layers.find((l) => l.id === source.layerId && slotAsset(l, source.slot) !== null) : undefined;
  return (
    <ElevatedDialog open={Boolean(layer)} onOpenChange={(open) => !open && ui.setState({ aiEditSource: null })}>
      <ElevatedDialogContent className="max-w-md">
        {layer && artboard && source ? (
          <>
            <ElevatedDialogHeader>
              <ElevatedDialogTitle>{t("editWithAi")}</ElevatedDialogTitle>
              <ElevatedDialogDescription>{label(layer)}</ElevatedDialogDescription>
            </ElevatedDialogHeader>
            <ElevatedDialogBody className="space-y-2.5">
              <EditWithAiForm layer={layer} canvas={artboard.canvas} slot={source.slot} autoFocus />
            </ElevatedDialogBody>
          </>
        ) : null}
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
