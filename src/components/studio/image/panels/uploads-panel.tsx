"use client";

import { useTranslations } from "next-intl";

import { useImageEditor } from "../editor-state";
import { ImageSourcePicker } from "../image-source-picker";
import { PanelHeading } from "./panel-heading";

export function UploadsPanel() {
  const t = useTranslations("studio.image.panels.uploads");
  const { commands } = useImageEditor();
  return (
    <div className="space-y-3">
      <PanelHeading title={t("title")} hint={t("hint")} />
      <ImageSourcePicker uploadLabel={t("upload")} onPick={(mediaId) => commands.insertImage(mediaId)} />
    </div>
  );
}
