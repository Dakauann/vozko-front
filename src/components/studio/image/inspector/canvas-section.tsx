"use client";

import { useTranslations } from "next-intl";

import { Copy, Plus } from "@/components/icons";
import { DEFAULT_IMAGE_BACKGROUND, STUDIO_LIMITS } from "@/lib/studio/document";

import { useArtboardNames } from "../artboard-names";
import { ColorField, InspectorSection, NumberField, OUTLINE_BUTTON_CLASS, SwitchToggle, TextField } from "../controls";
import { useActiveArtboard, useImageEditor } from "../editor-state";
import { ResizeForm } from "../resize-form";
import { ArtboardArrangeSection } from "./artboard-arrange-section";
import { ComponentFlag } from "./component-flag";
import { DocumentStylesSection } from "./styles-section";
import { GradientFields } from "./effects";
import { StillVfxSection } from "./still-vfx-section";

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
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={ta("position")}>
          <NumberField label={ta("positionX")} short="X" value={artboard.x} min={-STUDIO_LIMITS.maxArtboardCoordinate} max={STUDIO_LIMITS.maxArtboardCoordinate} suffix="px" onCommit={(x) => commands.moveArtboard(artboard.id, { x })} />
          <NumberField label={ta("positionY")} short="Y" value={artboard.y} min={-STUDIO_LIMITS.maxArtboardCoordinate} max={STUDIO_LIMITS.maxArtboardCoordinate} suffix="px" onCommit={(y) => commands.moveArtboard(artboard.id, { y })} />
        </div>
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
      <ArtboardArrangeSection />
      <ComponentFlag />
      <DocumentStylesSection />
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
      <StillVfxSection target={{ kind: "canvas" }} vfx={canvas.vfx} disabled={false} />
      <InspectorSection id="canvas-size" title={t("size", { width: canvas.width, height: canvas.height })}>
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
