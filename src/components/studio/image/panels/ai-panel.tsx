"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { Plus, Sparkle } from "@/components/icons";
import { MediaModelSelect } from "@/components/media-generation/media-model-select";
import { ReferenceThumbnails, type ReferenceThumbnail } from "@/components/media-generation/reference-thumbnails";
import { loadAssetImage } from "@/components/studio/canvas/asset-images";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { withReference } from "@/lib/media-generation/references";
import { IMAGE_ASPECTS, MAX_REFERENCE_IMAGES, type ImageAspect } from "@/lib/media-generation/types";
import { closestAspect } from "@/lib/studio/geometry";
import { cn } from "@/lib/utils";

import { FIELD_CLASS, Notice, OUTLINE_BUTTON_CLASS, PRIMARY_BUTTON_CLASS } from "../controls";
import { useImageDoc, useImageEditor } from "../editor-state";
import { ImageSourcePicker } from "../image-source-picker";
import { JobStatusList, useJobsFor } from "../jobs";
import { RemoveBackground } from "../remove-background";
import { PanelHeading } from "./panel-heading";

const MAX_PROMPT = 4000;
const BUTTON = OUTLINE_BUTTON_CLASS;

export function AiPanel() {
  const t = useTranslations("studio.image.panels.ai");
  const tAspect = useTranslations("studio.aspects");
  const { commands } = useImageEditor();
  const canvas = useImageDoc((s) => s.document.canvas);
  const layers = useImageDoc((s) => s.document.layers);
  const selection = useImageDoc((s) => s.selection);
  const jobs = useJobsFor("generate", null);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string | null>(null);
  const [aspect, setAspect] = useState<ImageAspect>(() => closestAspect(canvas.width, canvas.height));
  const [references, setReferences] = useState<ReferenceThumbnail[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [referenceError, setReferenceError] = useState(false);

  const selectedImages = useMemo(() => {
    const wanted = new Set(selection);
    return layers.filter((l) => wanted.has(l.id) && l.type === "image" && l.assetId);
  }, [layers, selection]);
  const single = selection.length === 1 ? (layers.find((l) => l.id === selection[0]) ?? null) : null;
  const running = jobs.some((job) => !job.error);
  const text = prompt.trim();

  const addFromSelection = async () => {
    setReferenceError(false);
    for (const layer of selectedImages) {
      const assetId = layer.assetId as string;
      try {
        const image = await loadAssetImage(assetId);
        setReferences((current) => withReference(current, { mediaId: assetId, url: image.src }));
      } catch {
        setReferenceError(true);
      }
    }
  };

  const generate = () => {
    if (!model || !text) return;
    void commands.startJob("generate", { kind: "image", model, prompt: text, aspect, referenceMediaIds: references.map((r) => r.mediaId) });
  };

  return (
    <div className="space-y-4" data-tour="studio-image-ai">
      <PanelHeading title={t("title")} hint={t("hint")} />
      <section className="space-y-2.5">
        <h3 className="legend text-muted-foreground">{t("generateTitle")}</h3>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">{t("prompt")}</span>
          <textarea
            value={prompt}
            maxLength={MAX_PROMPT}
            rows={4}
            placeholder={t("promptPlaceholder")}
            onChange={(event) => setPrompt(event.target.value)}
            className={cn(FIELD_CLASS, "h-auto resize-y py-1.5 leading-snug")}
          />
        </label>
        <div className="space-y-1">
          <span className="block text-xs text-muted-foreground">{t("aspect")}</span>
          <ElevatedPillToggle<ImageAspect> aria-label={t("aspect")} size="sm" value={aspect} onChange={setAspect} options={IMAGE_ASPECTS.map((value) => ({ value, label: tAspect(value), disabled: running }))} />
        </div>
        <MediaModelSelect kind="image" value={model} onChange={setModel} disabled={running} />
        <div className="space-y-1.5">
          <p className="legend text-muted-foreground">{t("references")}</p>
          {references.length > 0 ? (
            <ReferenceThumbnails items={references} removeLabel={t("removeReference")} onRemove={running ? undefined : (id) => setReferences((current) => current.filter((r) => r.mediaId !== id))} />
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={BUTTON} disabled={running || selectedImages.length === 0 || references.length >= MAX_REFERENCE_IMAGES} onClick={() => void addFromSelection()}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t("fromSelection")}
            </button>
            <Popover open={libraryOpen} onOpenChange={setLibraryOpen}>
              <PopoverTrigger asChild>
                <button type="button" className={BUTTON} disabled={running || references.length >= MAX_REFERENCE_IMAGES}>
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  {t("fromLibrary")}
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" align="start" className="w-80">
                <ImageSourcePicker
                  compact
                  uploadLabel={t("uploadReference")}
                  onPick={async (mediaId, url) => {
                    setReferences((current) => withReference(current, { mediaId, url }));
                    setLibraryOpen(false);
                    return true;
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          {referenceError ? (
            <Notice tone="fault" title={t("referenceFailed")} />
          ) : null}
          <p className="text-2xs text-muted-foreground">{t("referencesHint", { max: MAX_REFERENCE_IMAGES })}</p>
        </div>
        <p className="text-2xs text-muted-foreground">{t("costNote")}</p>
        <button
          type="button"
          disabled={running || !text || !model}
          onClick={generate}
          className={cn(PRIMARY_BUTTON_CLASS, "h-8 w-full")}
        >
          <Sparkle className="h-4 w-4" aria-hidden />
          {t("generate")}
        </button>
        <JobStatusList jobs={jobs} />
      </section>
      <section className="space-y-2 border-t border-border pt-3">
        <h3 className="legend text-muted-foreground">{t("removeBackgroundTitle")}</h3>
        <RemoveBackground layer={single} tourTarget />
      </section>
    </div>
  );
}
