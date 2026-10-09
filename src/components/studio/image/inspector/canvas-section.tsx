"use client";

import { useTranslations } from "next-intl";

import { Copy, Plus } from "@/components/icons";
import { DEFAULT_IMAGE_BACKGROUND, STUDIO_LIMITS } from "@/lib/studio/document";

import { useArtboardNames } from "../artboard-names";
import { ColorField, InspectorSection, OUTLINE_BUTTON_CLASS, SwitchToggle, TextField } from "../controls";
import { useActiveArtboard, useImageEditor } from "../editor-state";
import { ResizeForm } from "../resize-form";
import { GradientFields } from "./effects";

export function CanvasSection() {
  const t = useTranslations("studio.image.inspector.canvas");
  const ta = useTranslations("studio.image.artboards");
  const { commands } = useImageEditor();
  const artboard = useActiveArtboard();
  const names = useArtboardNames();
  const { canvas } = artboard;
  const transparent = canvas.background === "";
  return (
    <>
      <InspectorSection title={ta("title")}>
        <TextField label={ta("name")} value={artboard.name ?? ""} placeholder={names.get(artboard.id)} maxLength={STUDIO_LIMITS.maxLayerNameRunes} onCommit={(name) => commands.renameArtboard(artboard.id, name)} />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => commands.duplicateArtboards([artboard.id])} className={OUTLINE_BUTTON_CLASS}>
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {ta("duplicateShort")}
          </button>
          <button type="button" onClick={() => commands.addArtboard(canvas)} className={OUTLINE_BUTTON_CLASS}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {ta("addShort")}
          </button>
        </div>
      </InspectorSection>
      <InspectorSection title={t("background")}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{t("transparent")}</span>
          <SwitchToggle label={t("transparent")} checked={transparent} onChange={(on) => commands.setBackground(on ? "" : DEFAULT_IMAGE_BACKGROUND)} />
        </div>
        {canvas.gradient ? null : transparent ? (
          <p className="text-2xs text-muted-foreground">{t("transparentHint")}</p>
        ) : (
          <ColorField label={t("color")} value={canvas.background} onCommit={commands.setBackground} />
        )}
        <GradientFields gradient={canvas.gradient} fallback={canvas.background} disabled={false} onChange={commands.setCanvasGradient} />
      </InspectorSection>
      <InspectorSection title={t("size", { width: canvas.width, height: canvas.height })}>
        <ResizeForm key={`${canvas.width}x${canvas.height}`} />
      </InspectorSection>
      <InspectorSection title={t("tipsTitle")}>
        <ul className="list-disc space-y-1 pl-4 text-2xs text-muted-foreground">
          <li>{t("tipSelect")}</li>
          <li>{t("tipPan")}</li>
          <li>{t("tipZoom")}</li>
          <li>{t("tipEdit")}</li>
          <li>{ta("tip")}</li>
        </ul>
      </InspectorSection>
    </>
  );
}
