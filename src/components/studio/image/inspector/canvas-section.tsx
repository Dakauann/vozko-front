"use client";

import { useTranslations } from "next-intl";

import { DEFAULT_IMAGE_BACKGROUND } from "@/lib/studio/document";

import { ColorField, InspectorSection, SwitchToggle } from "../controls";
import { useImageDoc, useImageEditor } from "../editor-state";
import { ResizeForm } from "../resize-form";
import { GradientFields } from "./effects";

export function CanvasSection() {
  const t = useTranslations("studio.image.inspector.canvas");
  const { commands } = useImageEditor();
  const canvas = useImageDoc((s) => s.document.canvas);
  const transparent = canvas.background === "";
  return (
    <>
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
        </ul>
      </InspectorSection>
    </>
  );
}
