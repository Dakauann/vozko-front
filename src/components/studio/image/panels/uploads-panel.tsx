"use client";

import { useTranslations } from "next-intl";

import { artboardOfItem } from "@/lib/studio/artboards";
import { fillTargetOf } from "@/lib/studio/frame-fill";

import { useImageDoc, useImageEditor } from "../editor-state";
import { ImageSourcePicker } from "../image-source-picker";
import { useProcessingMedia } from "../jobs";
import { PanelHeading } from "./panel-heading";

export function UploadsPanel() {
  const t = useTranslations("studio.image.panels.uploads");
  const { commands } = useImageEditor();
  const processing = useProcessingMedia();
  const framing = useImageDoc((s) => {
    if (s.selection.length !== 1) return false;
    const board = artboardOfItem(s.document, s.selection[0]);
    return board ? fillTargetOf(board, s.selection[0]) !== null : false;
  });
  return (
    <div className="space-y-3">
      <PanelHeading title={t("title")} hint={t("hint")} />
      <p className="text-2xs leading-snug text-muted-foreground">{framing ? t("fillHint") : t("dragHint")}</p>
      <ImageSourcePicker uploadLabel={t("upload")} draggable processing={processing} onPick={(mediaId) => commands.placePhoto(mediaId)} />
    </div>
  );
}
